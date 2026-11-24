import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { getMemos, memoPeople } from "../src/lib/seedData.ts";
import { blindInput, runCalibration, reportMarkdown, offlineScorer } from "../src/lib/calibration.ts";
import { lensFor, lensWeights, REVEALED, WRITTEN } from "../src/lib/pipeline/lens.ts";
import { DEFAULT, loadConfig, saveConfig, validate } from "../src/lib/config.ts";
import { addDecision, correctionsFor, isAgainst, loadDecisions } from "../src/lib/decisions.ts";
import { recommend, lane } from "../src/lib/pipeline/rank.ts";

const inTmp = async (f: () => void | Promise<void>) => { const old = process.cwd(); process.chdir(mkdtempSync(`${tmpdir()}/aic-`)); try { await f(); } finally { process.chdir(old); } };

test("calibration is blind: no outcome, no 'why we', no company or founder name reaches the scorer", () => {
  for (const m of getMemos()) {
    const b = blindInput(m);
    assert.equal(b.includes(m.why), false, m.company); assert.equal(b.includes(m.company.replace(/^The /, "").replace(/ Company$/, "")), false, m.company);
    for (const p of memoPeople(m).filter(x => x.length > 3)) assert.equal(b.includes(p), false, `${m.company}: ${p}`);
    assert.doesNotMatch(b, /Why we|INVESTED|PASSED|Decision/);
  }
});
test("calibration report: 12 real memos, counts, matrix, ranking, one-line cases of at most 20 words with no tags", () => {
  const r = runCalibration(); assert.equal(r.n, 12); assert.equal(r.matrix.investedYes + r.matrix.investedNo, 6); assert.equal(r.matrix.passedYes + r.matrix.passedNo, 6); assert.equal(r.ranking.pairs, 36);
  for (const x of r.rows.filter(x => !x.agrees)) for (const s of [x.yes!, x.no!]) { assert.ok(s.split(/\s+/).length <= 20, s); assert.doesNotMatch(s, /\[[^\]]*\]|d\d+ deck/); }
  const md = reportMarkdown(r); assert.match(md, /In-sample/); assert.match(md, /Agreement:\*\* \d+ of 12/); assert.match(md, /offline|stand-in/i); assert.equal(offlineScorer.offline, true);
});
test("calibration is deterministic (Run again gives the same result)", () => assert.deepEqual(runCalibration(), runCalibration()));

test("lenses multiply by 1.5 and renormalise; written view has no lens", () => {
  const w = lensWeights(REVEALED, ["C3", "C4"]); assert.ok(Math.abs(Object.values(w).reduce((a, b) => a + b, 0) - 1) < 1e-9); assert.ok(w.C3 > REVEALED.C3 && w.C1 < REVEALED.C1);
  assert.deepEqual(lensFor("Consumer brand"), ["C3", "C4"]); assert.deepEqual(lensFor("Deeptech"), ["C2", "C6"]);
  assert.deepEqual(lensFor("Fintech", "loans via NBFC"), ["C2"]); assert.deepEqual(lensFor("Fintech", "payments"), []);
  assert.ok(Math.abs(Object.values(WRITTEN).reduce((a, b) => a + b, 0) - 1) < 1e-9);
});
test("config: validation, new version on each save, no silent overwrite", async () => inTmp(() => {
  const { version, ...base } = DEFAULT; void version;
  assert.equal(loadConfig().version, 1);
  assert.match(validate({ ...base, weights: { ...base.weights, C1: 0.9 } })!, /100%/);
  assert.match(validate({ ...base, thresholds: { take: 5, dig: 6, noBelow: 4.5, leansYes: 6.75 } })!, /Thresholds/);
  const a = saveConfig({ ...base, lensMultiplier: 1.4 }); assert.deepEqual(a, { ok: true, version: 2 });
  const b = saveConfig({ ...base, lensMultiplier: 1.6 }); assert.deepEqual(b, { ok: true, version: 3 });
  assert.equal(loadConfig().lensMultiplier, 1.6); assert.equal(saveConfig({ ...base, weights: { C1: 0.5 } as any }).ok, false);
}));
test("thresholds from config drive recommendation and lanes", () => {
  const t = { take: 8, dig: 6, noBelow: 4.5, leansYes: 7 };
  assert.equal(recommend(7.6, false, true, t), "Dig first"); assert.equal(lane(7.2, "Dig first", false, false, t).leans, "yes");
});
test("corrections: only decisions against the recommendation; reused with name redacted and logged", async () => inTmp(() => {
  assert.equal(isAgainst("yes", "Pass"), true); assert.equal(isAgainst("no", "Take the call"), true); assert.equal(isAgainst("yes", "Take the call"), false);
  addDecision({ slug: "a", company: "AlphaCo", decision: "yes", note: "AlphaCo founder owns the credit risk even though the score was low", rec: "Pass", by: "team" });
  addDecision({ slug: "b", company: "BetaCo", decision: "yes", note: "fine", rec: "Take the call", by: "team" });
  const hits = correctionsFor("c", "GammaCo", "A lender where the founder owns credit risk");
  assert.equal(hits.length, 1); assert.doesNotMatch(hits[0].note, /AlphaCo/); assert.match(hits[0].note, /\[Company\]/);
  assert.deepEqual(loadDecisions().find(d => d.slug === "a")!.reusedIn, ["c"]);
  assert.deepEqual(correctionsFor("a", "AlphaCo", "owns credit risk"), []);
}));
