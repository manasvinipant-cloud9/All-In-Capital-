import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pdfPages, parseForm } from "../src/lib/pipeline/ingest.ts";
import { reconcile } from "../src/lib/pipeline/reconcile.ts";
import { g1, g2Offline, g3, g4 } from "../src/lib/pipeline/gates.ts";
import { parseInr, toCr } from "../src/lib/pipeline/units.ts";
import { validateClaim, validateScore, missing, total } from "../src/lib/pipeline/validate.ts";
import { rank, recommend, lane, bucketOf } from "../src/lib/pipeline/rank.ts";
import { extractClaims, scoreCriterion } from "../src/lib/pipeline/steps.ts";

const load = async (slug: string) => ({ deck: await pdfPages(`seed/decks/${slug}.pdf`), form: parseForm(readFileSync(`seed/forms/${slug}.json`, "utf8")) });
const portfolio = JSON.parse(readFileSync("seed/portfolio.json", "utf8"));

test("Indian units", () => { assert.equal(parseInr("INR 1.5 Cr"), 15e6); assert.equal(parseInr("INR 9.4 L"), 940000); assert.equal(toCr(parseInr("INR 2 L")!), 0.02); });
test("EarnWise: TAM x10, team, live customers, credentials all flagged", async () => {
  const { deck, form } = await load("earnwise"); const c = reconcile(form, deck);
  for (const k of [/TAM/, /Team size/, /Live customers/, /Credentials differ/]) assert.ok(c.some(x => k.test(x.name)), String(k));
});
test("clean apps get no invented red flags", async () => {
  for (const s of ["greenloop", "dronedrishti", "ruralroots", "lendkart", "capilot", "notelycalls", "coinlane"]) { const { deck, form } = await load(s); assert.deepEqual(reconcile(form, deck).filter(c => c.severity === "red"), [], s); }
});
test("CAPilot 31 vs 24 paying is flagged", async () => { const { deck, form } = await load("capilot"); assert.ok(reconcile(form, deck).some(c => /Paying/.test(c.name))); });
test("gates: G1 later-stage, G2 crypto, G3 Notely->MeetRecord, G4 EarnWise", async () => {
  assert.equal(g1((await load("laterstage")).form).tripped, true);
  assert.equal(g1((await load("greenloop")).form).tripped, false);
  assert.equal(g2Offline((await load("coinlane")).deck).tripped, true);
  assert.equal(g2Offline((await load("dronedrishti")).deck).tripped, false);
  const n = await load("notelycalls"); const r = g3(n.deck[0].text, portfolio);
  assert.equal(r.tripped, true); assert.equal(r.matches[0].name, "MeetRecord");
  const e = await load("earnwise"); assert.equal(g4(reconcile(e.form, e.deck)).tripped, true);
});
test("G1 flags unreadable amounts with the text", () => assert.match(g1({ Stage: "Seed", "Round size": "a few crores", "Valuation (post-money)": "INR 10 Cr" }).reason, /a few crores/));
test("claim quotes must be verbatim", () => {
  const pages = [{ page: 1, text: "Revenue INR 1.1 Cr a month." }];
  assert.equal(validateClaim({ metric: "rev", value: 1, quote: "Revenue INR 1.1 Cr a month", page: 1 }, pages), null);
  assert.ok(validateClaim({ metric: "rev", value: 1, quote: "Revenue INR 9 Cr", page: 1 }, pages));
});
test("score validation: uncited above 2 rejected; missing = 2 low with gap", () => {
  assert.ok(validateScore({ criterion: "C3", score: 7, confidence: "med", claim_ids: [], rationale: "" }));
  assert.equal(validateScore(missing("C4")), null);
  assert.equal(total({ C1: 8, C2: 8, C3: 8, C4: 8, C5: 8, C6: 8 }), 8);
  assert.equal(total({}), 2);
});
test("rank: bucket, score, coverage, oldest", () => {
  const r = rank([{ id: "a", score: 9, bucket: "flagged" as const, coverage: 1, createdAt: "1" }, { id: "b", score: 6, bucket: "clear" as const, coverage: 1, createdAt: "2" }, { id: "c", score: 6, bucket: "clear" as const, coverage: 1, createdAt: "1" }]);
  assert.deepEqual(r.map(x => x.id), ["c", "b", "a"]);
  assert.equal(bucketOf(true, true), "outside");
});
test("recommendation and lanes", () => {
  assert.equal(recommend(8, false, true), "Take the call"); assert.equal(recommend(8, true, true), "Dig first"); assert.equal(recommend(5, false, true), "Pass");
  assert.equal(lane(4, "Pass", false, false).lane, "no"); assert.equal(lane(5.5, "Pass", false, false).lane, "your_call");
  assert.equal(lane(7.6, "Dig first", false, true).leans, "yes");
});
test("model steps: bad quote rejected, retried once with the reason", async () => {
  const pages = [{ page: 1, text: "We have 40 paying teams." }]; let n = 0, sawReason = false;
  const transport = async (_m: string, r: any) => { n++; if (r.system.includes("rejected")) sawReason = true;
    return { text: JSON.stringify([n === 1 ? { metric: "teams", value: 40, quote: "We have 400 paying teams", page: 1 } : { metric: "teams", value: 40, quote: "We have 40 paying teams", page: 1 }]) }; };
  const out = await extractClaims(pages, { transport, primary: "p", fallback: "f", founders: [] });
  assert.equal(out.accepted.length, 1); assert.ok(sawReason);
});
test("scoreCriterion: uncited twice falls to 2 low with the gap", async () => {
  const transport = async () => ({ text: JSON.stringify({ criterion: "C3", score: 8, confidence: "high", claim_ids: [], rationale: "great" }) });
  const s = await scoreCriterion("C3", "evidence", { transport, primary: "p", fallback: "f", founders: [] });
  assert.equal(s.score, 2); assert.equal(s.confidence, "low");
});
