import { test } from "node:test";
import assert from "node:assert/strict";
import { listMeta, loadFiles } from "../src/lib/apps.ts";
import { offlineInvite, isDeeptech, pickFact } from "../src/lib/email/offline.ts";
import { lint } from "../src/lib/email/lint.ts";
import { fillSlots, candidateSlots } from "../src/lib/email/slots.ts";
import { draftEmail } from "../src/lib/email/draft.ts";
import { clearCache } from "../src/lib/gateway/index.ts";
import { fromIST } from "../src/lib/ist.ts";

const NOW = fromIST(2026, 10, 24, 10, 0);
test("offline invite passes the linter for all 10 real applications (before and after the times are filled in)", async () => {
  for (const m of listMeta()) {
    const { form } = await loadFiles(m.slug), d = offlineInvite(form, m.stage, m.sector, isDeeptech(m.sector));
    assert.deepEqual(lint({ template: "invite", subject: d.subject, body: d.body, deeptech: isDeeptech(m.sector) }), [], m.slug);
    assert.deepEqual(lint({ template: "invite", subject: d.subject, body: fillSlots(d.body, candidateSlots({ now: NOW })), deeptech: isDeeptech(m.sector) }), [], m.slug);
  }
});
test("the opening fact is a short number from the form, not a whole paragraph", async () => {
  const f = async (s: string) => pickFact((await loadFiles(s)).form).fact;
  assert.equal(await f("capilot"), "24 paying CA firms"); assert.equal(await f("talkbook"), "16 paying teams"); assert.match(await f("grainkind"), /^90-day repeat rate was 31%/); assert.ok((await f("rentroute")).split(" ").length <= 12);
});
test("model draft: a failing draft is regenerated with the failures named, three generations at most", async () => {
  clearCache(); const bad = { subject: "Hi", body: "Hi A,\nImpressive work! Chat?\nBest regards" }, good = offlineInvite({ "Founder name": "Asha", Revenue: "INR 9 L" }, "Pre-seed", "Fintech", false);
  const seen: string[] = []; let n = 0;
  const transport = async (_m: string, r: any) => { seen.push(r.system); return { text: JSON.stringify(++n < 3 ? bad : good) }; };
  const out = await draftEmail({ template: "invite", facts: "Revenue INR 9 L", examples: [], founders: [], transport, primary: "p", fallback: "f" });
  assert.equal(out.passed, true); assert.equal(out.attempts, 3); assert.match(seen[1], /failed these checks/);
  clearCache(); const fail = await draftEmail({ template: "invite", facts: "x", examples: [], founders: [], transport: async () => ({ text: JSON.stringify(bad) }), primary: "p2", fallback: "f" });
  assert.equal(fail.passed, false); assert.equal(fail.attempts, 3);
});
test("deeptech (Pumpwise) invites name Aditya", async () => {
  const m = listMeta().find(x => x.slug === "pumpwise")!, { form } = await loadFiles("pumpwise");
  assert.equal(isDeeptech(m.sector), true); assert.match(offlineInvite(form, m.stage, m.sector, true).body, /Aditya/);
});
