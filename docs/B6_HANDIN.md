# B6 hand-in: should we fine-tune the first-email step?

**Verdict: do not fine-tune.** The payback stop rule fires on the facts alone, so the fine-tune arm (D) was not run. Read the limits at the end before relying on any number below.

## The Brief (9 lines)

1. **Step:** drafting the first email (Loop 2). Chosen over screening (Loop 1) by counting changes: 34 of 58 drafts were rewritten, and the rewrites follow a few fixed rules; Loop 1 had 12 of 40 overturned for 12 different reasons that each need context about the thesis.
2. **Why consider fine-tuning:** Riya rewrites about 58% of drafts into one house style. A small model trained on her emails might learn the style.
3. **Data:** 38 training rows plus 300 synthetic rows (all labelled), and a sealed test set of 20 rows (fingerprint 419910da8db12181..., see docs/B6_SEAL.txt). The 58 rows that survived cleaning (38 for training, 20 sealed) are the fund's real Loop 2 export. The 300 synthetic rows only change the offer wording and dates of a real email, so they add volume, not new style. Two boilerplate rows were dropped. All of Riya's clean emails pass the checks, so the checks are consistent with her.
4. **Baseline:** 25 of 60 old system drafts were sent unchanged (42%). On the 20 sealed rows it is 12 of 20 (60%): too few rows to rely on. 12 of 20 sealed drafts pass the checks.
5. **Pass mark:** 80% sent as they are.
6. **Cheaper fix:** a rule checker plus up to 3 regenerations (built), and a fixed template with no model (arm T) that passes the checks in 20 of 20 rows. Whether that reaches 80% sent-as-is is not known: it needs a model key and a judge.
7. **Result:** arms B, C, E and the judge were not run (no model key). D was not run (stop rule). Measured without a model: arm A passes 12 of 20 checks; arm T passes 20 of 20 with a mean word overlap with Riya's of 0.36 against 0.73 for the old drafts.
8. **Payback:** Riya's time saved per email is 3 minutes (4 to rewrite, 1 if it needs no change), 17 emails a month, at Rs 1,000 an hour. Reaching the pass mark from the 42% baseline saves about Rs 326 a month (Rs 3,910 a year). Even a perfect model saves at most Rs 496 a month. For a 12-month payback the whole project may cost at most Rs 3,910.
9. **Decision:** stop. A fine-tune cannot pay back inside 12 months: 5 hours of Riya's or the analyst's time at Rs 1,000 an hour would already exceed Rs 3,910, and cleaning data, training and checking a model takes longer than that (my estimate, not measured); there is no cloud account, and the founder agreement forbids sharing decks with outside parties. Fix the prompt, the checks and the examples loop instead, and re-measure send-as-is with the judge once keys exist.

## Results against the baseline (sealed test set)

| Arm | Passes all checks | Same as Riya's email | Word overlap with Riya's |
|---|---|---|---|
| A: old system drafts | 12 of 20 | 12 | 0.73 |
| T: fixed template (no model) | 20 of 20 | 0 | 0.36 |
| R: Riya's own emails (sanity) | 20 of 20 | 20 | 1 |

Not run: B (current prompt), C (new prompt with examples), E (new prompt, no examples), the judge calibration (no model key) and D (stop rule).

## What this does and does not show
- It shows the harness works on the real export, the seal holds, and the payback arithmetic is small: the ceiling is Rs 5,950 a year.
- The payback conclusion uses only the operating facts (about 17 emails sent a month, 1 minute against 4) and the measured rewrite rate. It does not depend on any model result.
- It does **not** show whether a better prompt reaches 80% sent as it is. That needs a model key and a judge. The 20-row test set is small: one email is 5 percentage points.
- Riya's real emails all pass the checks once the checker uses her real format (two Tuesday or Thursday dates, in the afternoon, no clock time). The two planted bad rows fail, as they should.

## Spend
Model spend: Rs 0. No model calls, no cloud account and no training run were used.
