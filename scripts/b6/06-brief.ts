// Step 6: payback and the 9-line Brief. Every number comes from the files the earlier steps wrote, or from the facts in the master prompt.
import { writeFileSync } from "node:fs";
import { loop2, readJson } from "./lib.ts";

type Step = { loop1: { rows: number; overturned: number; overturnRate: number; distinctReasons: number }; loop2: { rows: number; rewritten: number; rewriteRate: number; coverage: number }; pick: string };
type Res = { sealed: string; measured: { arm: string; n: number; lintClean: number; exactAsRiya: number; meanWordOverlapWithRiya: number }[] };
const step = readJson<Step>("step.json"), res = readJson<Res>("results.json"), ext = readJson<{ synthetic: boolean }[]>("train_extended.json");
const A = res.measured[0], T = res.measured[1];
const realRows = ext.filter(e => !e.synthetic).length, synRows = ext.filter(e => e.synthetic).length;

// Facts given in the master prompt.
const EMAILS = 17, MIN_AS_IS = 1, MIN_REWRITE = 4, RUPEES_PER_HOUR = 1000, PASS = 0.8, STOP_MONTHS = 12;
const all = loop2(), asIsAll = all.filter(r => r.riya_final_email.trim() === r.system_draft.trim()).length;
const baseAsIs = asIsAll / all.length, saved = MIN_REWRITE - MIN_AS_IS;   // the full 60-row baseline, not the noisy 20-row test sample
const perMonth = (asIs: number) => EMAILS * (asIs - baseAsIs) * saved / 60 * RUPEES_PER_HOUR;   // rupees per month
const ceiling = perMonth(1), atPass = perMonth(PASS);
const inr = (n: number) => `Rs ${Math.round(n).toLocaleString("en-IN")}`;
const breakeven = atPass * STOP_MONTHS;

const md = `# B6 hand-in: should we fine-tune the first-email step?

**Verdict: do not fine-tune.** The payback stop rule fires on the facts alone, so the fine-tune arm (D) was not run. Read the limits at the end before relying on any number below.

## The Brief (9 lines)

1. **Step:** drafting the first email (Loop 2). Chosen over screening (Loop 1) by counting changes: ${step.loop2.rewritten} of ${step.loop2.rows} drafts were rewritten, and the rewrites follow a few fixed rules; Loop 1 had ${step.loop1.overturned} of ${step.loop1.rows} overturned for ${step.loop1.distinctReasons} different reasons that each need context about the thesis.
2. **Why consider fine-tuning:** Riya rewrites about ${Math.round((1 - baseAsIs) * 100)}% of drafts into one house style. A small model trained on her emails might learn the style.
3. **Data:** ${realRows} training rows plus ${synRows} synthetic rows (all labelled), and a sealed test set of ${A.n} rows (fingerprint ${res.sealed.slice(0, 16)}..., see docs/B6_SEAL.txt). The ${realRows + A.n} rows that survived cleaning (${realRows} for training, ${A.n} sealed) are the fund's real Loop 2 export. The ${synRows} synthetic rows only change the offer wording and dates of a real email, so they add volume, not new style. Two boilerplate rows were dropped. All of Riya's clean emails pass the checks, so the checks are consistent with her.
4. **Baseline:** ${asIsAll} of ${all.length} old system drafts were sent unchanged (${Math.round(baseAsIs * 100)}%). On the 20 sealed rows it is ${A.exactAsRiya} of ${A.n} (${Math.round(A.exactAsRiya / A.n * 100)}%): too few rows to rely on. ${A.lintClean} of ${A.n} sealed drafts pass the checks.
5. **Pass mark:** ${PASS * 100}% sent as they are.
6. **Cheaper fix:** a rule checker plus up to 3 regenerations (built), and a fixed template with no model (arm T) that passes the checks in ${T.lintClean} of ${T.n} rows. Whether that reaches 80% sent-as-is is not known: it needs a model key and a judge.
7. **Result:** arms B, C, E and the judge were not run (no model key). D was not run (stop rule). Measured without a model: arm A passes ${A.lintClean} of ${A.n} checks; arm T passes ${T.lintClean} of ${T.n} with a mean word overlap with Riya's of ${T.meanWordOverlapWithRiya} against ${A.meanWordOverlapWithRiya} for the old drafts.
8. **Payback:** Riya's time saved per email is ${saved} minutes (${MIN_REWRITE} to rewrite, ${MIN_AS_IS} if it needs no change), ${EMAILS} emails a month, at ${inr(RUPEES_PER_HOUR)} an hour. Reaching the pass mark from the ${Math.round(baseAsIs * 100)}% baseline saves about ${inr(atPass)} a month (${inr(atPass * 12)} a year). Even a perfect model saves at most ${inr(ceiling)} a month. For a ${STOP_MONTHS}-month payback the whole project may cost at most ${inr(breakeven)}.
9. **Decision:** stop. A fine-tune cannot pay back inside ${STOP_MONTHS} months: ${Math.ceil(breakeven / RUPEES_PER_HOUR) + 1} hours of Riya's or the analyst's time at ${inr(RUPEES_PER_HOUR)} an hour would already exceed ${inr(breakeven)}, and cleaning data, training and checking a model takes longer than that (my estimate, not measured); there is no cloud account, and the founder agreement forbids sharing decks with outside parties. Fix the prompt, the checks and the examples loop instead, and re-measure send-as-is with the judge once keys exist.

## Results against the baseline (sealed test set)

| Arm | Passes all checks | Same as Riya's email | Word overlap with Riya's |
|---|---|---|---|
${res.measured.map(m => `| ${m.arm} | ${m.lintClean} of ${m.n} | ${m.exactAsRiya} | ${m.meanWordOverlapWithRiya} |`).join("\n")}

Not run: B (current prompt), C (new prompt with examples), E (new prompt, no examples), the judge calibration (no model key) and D (stop rule).

## What this does and does not show
- It shows the harness works on the real export, the seal holds, and the payback arithmetic is small: the ceiling is ${inr(ceiling * 12)} a year.
- The payback conclusion uses only the operating facts (about 17 emails sent a month, 1 minute against 4) and the measured rewrite rate. It does not depend on any model result.
- It does **not** show whether a better prompt reaches 80% sent as it is. That needs a model key and a judge. The 20-row test set is small: one email is 5 percentage points.
- Riya's real emails all pass the checks once the checker uses her real format (two Tuesday or Thursday dates, in the afternoon, no clock time). The two planted bad rows fail, as they should.

## Spend
Model spend: Rs 0. No model calls, no cloud account and no training run were used.
`;
writeFileSync("docs/B6_HANDIN.md", md);
console.log(md);
