import { test } from "node:test";
import assert from "node:assert/strict";
import { loadFiles } from "../src/lib/apps.ts";
import { reconcile, tamChecks, type Check } from "../src/lib/pipeline/reconcile.ts";
import { describe, g1, g2Offline, g3, g4 } from "../src/lib/pipeline/gates.ts";
import { parseInr, toCr } from "../src/lib/pipeline/units.ts";
import { validateClaim, validateScore, missing, total } from "../src/lib/pipeline/validate.ts";
import { rank, recommend, lane, bucketOf } from "../src/lib/pipeline/rank.ts";
import { extractClaims, scoreCriterion } from "../src/lib/pipeline/steps.ts";
import { getPortfolio } from "../src/lib/seedData.ts";

const run = async (slug: string) => { const { form, deck } = await loadFiles(slug); const checks = reconcile(form, deck); return { form, deck, checks, gates: [g1(form), g2Offline(deck), g3(describe(form, deck), getPortfolio()), g4(checks)] }; };
const names = (c: Check[]) => c.map(x => x.name);
const has = (c: Check[], re: RegExp) => c.find(x => re.test(x.name) || re.test(x.formula));

test("Indian units", () => { assert.equal(parseInr("INR 1.5 Cr"), 15e6); assert.equal(parseInr("INR 9.4 L"), 940000); assert.equal(toCr(parseInr("INR 2 L")!), 0.02); });

// The known traps in the fund's ten applications (from the master prompt), as a table. Each row names what must be found.
test("EarnWise: market size x10, team 5 vs 12, live clients 1 vs 3, inflated credentials; credit funding not invented", async () => {
  const { checks, gates } = await run("earnwise");
  assert.match(has(checks, /^TAM/)!.formula, /10M x INR 12000 x 12|10M x INR 12,000 x 12/); assert.match(has(checks, /^TAM/)!.formula, /10\.0x smaller/);
  assert.match(has(checks, /Team size/)!.formula, /form 5 .* vs deck "Team of 12"/); assert.match(has(checks, /live enterprise clients/)!.formula, /form 1 vs deck 3/);
  const cred = has(checks, /Credentials/)!; assert.match(cred.formula, /Ex-Goldman Sachs\. Ex-Google\. MBA, IIM Ahmedabad/); assert.match(cred.formula, /internship/); assert.match(cred.formula, /tier-2/);
  assert.equal(gates[3].tripped, true); assert.equal(gates[0].tripped, false);
});
test("StockSathi: 42 vs 38 retailers, CAC under 2,000 vs 2,860, credit funding (red), INR 1.2 L assumed vs about 10,000 actual, possible SuperK overlap", async () => {
  const { checks, gates } = await run("stocksathi");
  assert.match(has(checks, /retailers onboarded/)!.formula, /form 42 vs deck 38/); assert.match(has(checks, /^CAC differs/)!.formula, /under INR 2,000.*2,860/);
  const credit = has(checks, /credit is funded/)!; assert.equal(credit.severity, "red"); assert.match(credit.formula, /NBFC partner/); assert.match(credit.formula, /own capital/);
  assert.match(has(checks, /per store/)!.formula, /1\.2 L a month per store.*INR 10,000 a month/); assert.equal(gates[2].tripped, true); assert.match(gates[2].reason, /SuperK/);
  assert.ok(!has(checks, /loss or default/), "the form says defaults to date: none, so no missing-loss flag");
});
test("CAPilot: 31 paying in the deck vs 24 paying plus 7 on trial in the form; the 12-month target is not read as actual revenue", async () => {
  const { checks } = await run("capilot");
  assert.match(has(checks, /paying customers/)!.formula, /form 24 vs deck 31 \(24 \+ 7 on trial = 31/); assert.ok(!has(checks, /Monthly recurring revenue differs/), "INR 7 L is a target");
  assert.deepEqual(checks.filter(c => c.severity === "red"), []);
});
test("Talkbook: MRR 1.9 L vs 2.1 L, and 340 seats x INR 500 = 1.7 L matches neither; overlaps MeetRecord", async () => {
  const { checks, gates } = await run("talkbook");
  assert.match(has(checks, /Monthly recurring revenue differs/)!.formula, /INR 1\.9 L vs deck INR 2\.1 L/); assert.match(has(checks, /Seats times price/)!.formula, /340 seats x INR 500 = INR 1,70,000/);
  assert.equal(gates[2].tripped, true); assert.match(gates[2].reason, /MeetRecord/);
});
test("Settlr: payback 7 stated vs 3.7 computed, no loss figure, out of range (Series A, INR 30 Cr)", async () => {
  const { checks, gates } = await run("settlr");
  assert.match(has(checks, /Payback/)!.formula, /14,500 \/ \(INR 6,800 x 58%\) = 3\.7 months, deck says 7/); assert.ok(has(checks, /loss or default/));
  assert.equal(gates[0].tripped, true); assert.match(gates[0].reason, /Series A.*30 Cr.*180 Cr/); assert.ok(has(checks, /^TAM/), "its market size is also x10 off its own inputs");
});
test("RentRoute: no direct competitors, gross shown as revenue (net is half), single-partner dependence left out", async () => {
  const { checks } = await run("rentroute");
  assert.ok(has(checks, /no direct competitors/i)); assert.match(has(checks, /gross revenue/)!.formula, /INR 11 L gross, INR 5\.5 L net/); assert.ok(has(checks, /Single-partner/)); assert.equal(checks.filter(c => c.severity === "red").length, 0);
});
test("Yatrika: 'thousands' vs about 1,300, '3x growth' with no numbers, manual operations not disclosed", async () => {
  const { checks } = await run("yatrika");
  assert.match(has(checks, /thousands/)!.formula, /about 1,300 travellers/); assert.ok(has(checks, /Growth multiple/)); assert.ok(has(checks, /Manual operations/));
});
test("Pumpwise: market assumes 60 sensors per customer, actual average is 23 (and nothing else is invented)", async () => {
  const { checks } = await run("pumpwise");
  assert.equal(checks.length, 1); assert.match(checks[0].formula, /assumes 60 sensors per customer; actual average is 23/); assert.equal(checks[0].kind, "assumption_vs_actual");
});
test("GrainKind: market and serviceable market are each x10 off their own inputs; the rest is consistent", async () => {
  const { checks } = await run("grainkind");
  assert.deepEqual(names(checks).sort(), ["SAM does not follow from its own inputs", "TAM does not follow from its own inputs"]);
  assert.match(checks.find(c => /^TAM/.test(c.name))!.formula, /38M x INR 2,400 = INR 9,120 Cr, but the deck says INR 91,200 Cr/);
});
test("CareCorner: consistent, no flags, no gates", async () => { const { checks, gates } = await run("carecorner"); assert.deepEqual(checks, []); assert.ok(gates.every(g => !g.tripped)); });

test("market size arithmetic: units, multipliers, tolerance, and plain correct sums stay quiet", () => {
  const deck = (t: string) => [{ page: 1, text: t }];
  assert.deepEqual(tamChecks(deck("TAM INR 4,200 Cr 7M sales reps in India x INR 6,000 per seat a year SAM INR 660 Cr 1.1M reps x INR 6,000")), []);
  assert.deepEqual(tamChecks(deck("TAM INR 17 lakh Cr 12M kirana stores x INR 1.2 L monthly purchases x 12")), [], "17.28 lakh Cr is within 5% of 17");
  assert.equal(tamChecks(deck("TAM INR 1.14 lakh Cr 190M Indian households x INR 6,000 a year on primary care")).length, 0);
  assert.equal(tamChecks(deck("TAM INR 9,000 Cr 5M households x INR 2,000 a year")).length, 1);
});
test("gates: G1 reads the amount, flags unreadable text, and G2 reads wording about regulation", () => {
  assert.equal(g1({ Stage: "Seed", "Round size": "INR 2 Cr", "Valuation (post-money)": "INR 12 Cr post-money" }).tripped, false);
  assert.match(g1({ Stage: "Seed", "Round size": "a few crores", "Valuation (post-money)": "INR 10 Cr" }).reason, /a few crores/);
  assert.equal(g2Offline([{ page: 1, text: "Our business depends on retail crypto being legalised in 2027." }]).tripped, true);
  assert.equal(g2Offline([{ page: 1, text: "We need DGCA certification by 2027." }]).tripped, false);
});

test("claim quotes must be verbatim; scores need citations; missing evidence scores 2", () => {
  const pages = [{ page: 1, text: "Revenue INR 1.1 Cr a month." }];
  assert.equal(validateClaim({ metric: "rev", value: 1, quote: "Revenue INR 1.1 Cr a month", page: 1 }, pages), null); assert.ok(validateClaim({ metric: "rev", value: 1, quote: "Revenue INR 9 Cr", page: 1 }, pages));
  assert.ok(validateScore({ criterion: "C3", score: 7, confidence: "med", claim_ids: [], rationale: "" })); assert.equal(validateScore(missing("C4")), null);
  assert.equal(total({ C1: 8, C2: 8, C3: 8, C4: 8, C5: 8, C6: 8 }), 8); assert.equal(total({}), 2);
});
test("rank: bucket, score, coverage, oldest; recommendation and lanes", () => {
  const r = rank([{ id: "a", score: 9, bucket: "flagged" as const, coverage: 1, createdAt: "1" }, { id: "b", score: 6, bucket: "clear" as const, coverage: 1, createdAt: "2" }, { id: "c", score: 6, bucket: "clear" as const, coverage: 1, createdAt: "1" }]);
  assert.deepEqual(r.map(x => x.id), ["c", "b", "a"]); assert.equal(bucketOf(true, true), "outside");
  assert.equal(recommend(8, false, true), "Take the call"); assert.equal(recommend(8, true, true), "Dig first"); assert.equal(recommend(5, false, true), "Pass");
  assert.equal(lane(4, "Pass", false, false).lane, "no"); assert.equal(lane(5.5, "Pass", false, false).lane, "your_call"); assert.equal(lane(7.6, "Dig first", false, true).leans, "yes");
});
test("model steps: a bad quote is rejected and retried once with the reason; an uncited score falls to 2", async () => {
  const pages = [{ page: 1, text: "We have 40 paying teams." }]; let n = 0, sawReason = false;
  const transport = async (_m: string, r: any) => { n++; if (r.system.includes("rejected")) sawReason = true; return { text: JSON.stringify([n === 1 ? { metric: "teams", value: 40, quote: "We have 400 paying teams", page: 1 } : { metric: "teams", value: 40, quote: "We have 40 paying teams", page: 1 }]) }; };
  const out = await extractClaims(pages, { transport, primary: "p", fallback: "f", founders: [] }); assert.equal(out.accepted.length, 1); assert.ok(sawReason);
  const s = await scoreCriterion("C3", "evidence", { transport: async () => ({ text: JSON.stringify({ criterion: "C3", score: 8, confidence: "high", claim_ids: [], rationale: "great" }) }), primary: "p", fallback: "f", founders: [] });
  assert.equal(s.score, 2); assert.equal(s.confidence, "low");
});
