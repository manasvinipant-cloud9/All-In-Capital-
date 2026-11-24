import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { NextRequest } from "next/server";
import { COOKIE, authRequired, roleFor, signSession, verifySession } from "../src/lib/session.ts";
import { calls, callModel, clearCache, setLedger, type CallLog } from "../src/lib/gateway/index.ts";
import { isPaused, istDay, spentOn } from "../src/lib/spend.ts";
import { costReport } from "../src/lib/costreport.ts";
import { enqueue, jobs, processNext, PLAIN_ERROR } from "../src/lib/queue.ts";
import { runCron } from "../src/lib/cron.ts";
import { Store } from "../src/lib/schedule/store.ts";
import { fromIST } from "../src/lib/ist.ts";

const SECRET = "test-secret-0123456789abcdef";
const inTmp = async (f: () => void | Promise<void>) => { const old = process.cwd(); process.chdir(mkdtempSync(`${tmpdir()}/aic-`)); try { await f(); } finally { process.chdir(old); } };
const log = (o: Partial<CallLog>): CallLog => ({ at: fromIST(2026, 10, 24, 12).toISOString(), step: "s", model: "m", tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: 0, retries: 0, fellBack: false, cached: false, ok: true, ...o });

test("sessions: sign, verify, tamper, expiry, short secret", async () => {
  const exp = Date.now() + 60000, tok = await signSession({ email: "a@x.test", role: "partner", exp }, SECRET);
  assert.equal((await verifySession(tok, SECRET))?.email, "a@x.test");
  assert.equal(await verifySession(tok.replace(/.$/, c => (c === "A" ? "B" : "A")), SECRET), null);
  assert.equal(await verifySession(tok, "another-secret-0123456789"), null);
  assert.equal(await verifySession(tok, SECRET, exp + 1), null);
  assert.equal(await verifySession(tok, "short"), null);
  assert.equal(await verifySession(undefined, SECRET), null);
  const forged = Buffer.from(JSON.stringify({ email: "a@x.test", role: "partner", exp })).toString("base64url") + ".AAAA";
  assert.equal(await verifySession(forged, SECRET), null);
});
test("allowlist and roles", () => {
  const env = { ALLOWED_EMAILS: "Riya@fund.test, analyst@fund.test", PARTNER_EMAILS: "kushal@fund.test,aditya@fund.test", MAILBOX_EMAIL: "riya@fund.test" };
  assert.equal(roleFor("RIYA@fund.test", env), "associate"); assert.equal(roleFor("kushal@fund.test", env), "partner");
  assert.equal(roleFor("stranger@x.test", env), null); assert.equal(roleFor("", env), null);
  assert.equal(authRequired({ NODE_ENV: "production" }), true); assert.equal(authRequired({ NODE_ENV: "development" }), false); assert.equal(authRequired({ REQUIRE_AUTH: "1" }), true);
});
test("middleware: production blocks everything except login, OAuth and cron; signed-in users pass", async () => {
  const old = { e: process.env.REQUIRE_AUTH, s: process.env.SESSION_SECRET };
  process.env.REQUIRE_AUTH = "1"; process.env.SESSION_SECRET = SECRET;
  try {
    const { middleware } = await import("../src/middleware.ts");
    const at = (p: string, cookie?: string) => middleware(new NextRequest(`http://localhost${p}`, cookie ? { headers: { cookie: `${COOKIE}=${cookie}` } } : {}));
    assert.equal((await at("/")).status, 307); assert.equal((await at("/apps/earnwise")).status, 307);
    assert.equal((await at("/api/send")).status, 401); assert.equal((await at("/api/decision")).status, 401);
    for (const open of ["/login", "/api/auth/google", "/api/auth/callback", "/api/cron/queue"]) assert.equal((await at(open)).headers.get("location"), null, open);
    const tok = await signSession({ email: "a@x.test", role: "associate", exp: Date.now() + 60000 }, SECRET);
    assert.equal((await at("/", tok)).headers.get("location"), null); assert.equal((await at("/", "garbage")).status, 307);
  } finally { process.env.REQUIRE_AUTH = old.e; process.env.SESSION_SECRET = old.s; if (old.e === undefined) delete process.env.REQUIRE_AUTH; if (old.s === undefined) delete process.env.SESSION_SECRET; }
});
test("cron route rejects missing or wrong secrets", async () => {
  const old = process.env.CRON_SECRET; process.env.CRON_SECRET = "right-secret-value"; delete process.env.SUPABASE_URL;
  try {
    const { GET } = await import("../src/app/api/cron/queue/route.ts");
    assert.equal((await GET(new Request("http://x/api/cron/queue"))).status, 401);
    assert.equal((await GET(new Request("http://x/api/cron/queue", { headers: { authorization: "Bearer wrong-secret-value" } }))).status, 401);
    assert.equal((await GET(new Request("http://x/api/cron/queue", { headers: { authorization: "Bearer short" } }))).status, 401);
  } finally { if (old === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = old; }
});

test("spend cap pauses, and resumes on its own after midnight IST; no cap never pauses", () => {
  const day1 = fromIST(2026, 10, 24, 23, 50), day2 = fromIST(2026, 10, 25, 0, 5);
  const calls1 = [log({ at: fromIST(2026, 10, 24, 20).toISOString(), costUsd: 4 }), log({ at: fromIST(2026, 10, 24, 22).toISOString(), costUsd: 1.5 })];
  assert.equal(isPaused(day1, calls1, 5), true); assert.equal(isPaused(day1, calls1, 6), false);
  assert.equal(isPaused(day2, calls1, 5), false, "new IST day starts at zero");
  assert.equal(isPaused(day1, calls1, NaN), false); assert.equal(isPaused(day1, calls1, 0), false);
  assert.equal(istDay(fromIST(2026, 10, 24, 0, 1)), "2026-11-24"); assert.equal(istDay(fromIST(2026, 10, 24, 23, 59)), "2026-11-24");
  assert.equal(spentOn("2026-11-24", calls1), 5.5);
});
test("gateway ledger gets every call with application, cost and cached flag; a broken ledger never breaks a call", async () => {
  clearCache(); const seen: CallLog[] = []; setLedger(c => seen.push(c));
  const opts = { transport: async () => ({ text: "ok", costUsd: 0.002, tokensIn: 100, tokensOut: 10 }), primary: "p", fallback: "f" };
  await callModel({ step: "extract", system: "s", user: "u", application: "earnwise" }, opts); await callModel({ step: "extract", system: "s", user: "u", application: "earnwise" }, opts);
  assert.equal(seen.length, 2); assert.equal(seen[0].application, "earnwise"); assert.equal(seen[0].costUsd, 0.002); assert.equal(seen[1].cached, true); assert.equal(seen[1].costUsd, 0);
  setLedger(() => { throw new Error("disk full"); }); await callModel({ step: "x", system: "s", user: "u2" }, opts); setLedger(null); assert.ok(calls.length >= 3);
  await assert.rejects(callModel({ step: "x", system: "s", user: "u3" }, { ...opts, transport: async () => { throw { status: 400, message: "bad" }; } }));
  assert.equal(calls.at(-1)!.ok, false); assert.match(calls.at(-1)!.error!, /400/);
});
test("cost report: per call, application, day, month; cached rows cost nothing; terminal text only", () => {
  const r = costReport([log({ application: "a", costUsd: 0.01, step: "score" }), log({ application: "a", costUsd: 0, cached: true, step: "score" }), log({ application: "b", costUsd: 0.03, step: "extract", ok: false })]);
  assert.match(r, /Calls: 3 \(1 from cache/); assert.match(r, /per paid call: \$0.02000/); assert.match(r, /per application: \$0.0200 across 2/);
  assert.match(r, /2026-11-24/); assert.match(r, /2026-11/); assert.equal(costReport([]), "No model calls recorded yet.");
});

test("queue: no duplicates; one retry then Needs a look with a plain reason; blocked is not a failure; stale running job is reclaimed", async () => inTmp(async () => {
  enqueue("a"); enqueue("a"); assert.equal(jobs().length, 1);
  let n = 0; const flaky = async () => { n++; throw new Error("pdf exploded"); };
  assert.equal((await processNext(flaky))!.status, "queued"); const j = (await processNext(flaky))!;
  assert.equal(j.status, "needs_look"); assert.equal(j.reason, PLAIN_ERROR); assert.equal(n, 2); assert.equal(await processNext(flaky), null);
  enqueue("b"); const b = (await processNext(async () => ({ steps: { ingest: "done" }, blocked: "No model key yet" })))!;
  assert.equal(b.status, "blocked"); assert.equal(b.attempts, 0);
  enqueue("c"); const all = jobs(); all.find(x => x.slug === "c")!.status = "running"; all.find(x => x.slug === "c")!.updatedAt = new Date(Date.now() - 3600000).toISOString();
  (await import("node:fs")).writeFileSync(".local/queue.json", JSON.stringify(all));
  assert.equal((await processNext(async () => ({ steps: { ingest: "done" } })))!.status, "done");
}));
test("cron: the scheduler runs even when the spend cap has paused the queue; the queue does not", async () => inTmp(async () => {
  enqueue("x"); let handled = 0, scheduled = 0;
  const store = new Store(false), mail = { async newReplies() { scheduled++; return []; }, async sendInThread() {} }, cal = { async freeBusy() { return []; }, async createEvent() { return { id: "", meetLink: "", calendarLink: "" }; } };
  store.put({ id: "t", slug: "s", company: "C", founderName: "F", founderEmail: "f@x.test", deeptech: false, state: "sent", offered: [new Date().toISOString()], reoffers: 0, sentAt: new Date().toISOString(), processed: [] });
  const handler = async () => { handled++; return { steps: {} }; };
  const paused = await runCron({ now: new Date(), store, mail, cal, handler, paused: true });
  assert.equal(scheduled, 1); assert.equal(handled, 0); assert.match(String(paused.queue), /paused/);
  const open = await runCron({ now: new Date(), store, mail, cal, handler, paused: false });
  assert.equal(handled, 1); assert.equal((open.queue as any).status, "done");
  const none = await runCron({ now: new Date(), store, handler, paused: false }); assert.match(String(none.scheduler), /not connected/);
}));
