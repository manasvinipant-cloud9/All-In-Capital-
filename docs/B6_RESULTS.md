# B6 harness results (sealed test set, 20 rows)

Seal verified: `419910da8db12181314a55875eda5a0d4bc3664b79c6a00d7a8785ea44742065`.

**Read this first:** the rows are the fund's real Loop 2 export (58 clean rows after dropping the two planted bad ones). With 20 test rows, every figure is rough: one email is 5 percentage points. Arms that need a model were not run.

| Arm | Passes all checks | Identical to Riya's email | Mean word overlap with Riya's | Emails with a number not in the facts |
|---|---|---|---|---|
| A: old system drafts | 12 of 20 | 12 | 0.73 | 1 |
| T: fixed template (no model) | 20 of 20 | 0 | 0.36 | 0 |
| R: Riya's own emails (sanity) | 20 of 20 | 20 | 1 | 1 |

"Identical to Riya's email" for arm A is the measured sent-as-is baseline on these rows (12 of 20). Across all 60 rows it is 25 (42%).

## Not run
- B: current prompt: not run: no model key
- C: new prompt + Riya's examples: not run: no model key
- E: new prompt, no examples: not run: no model key
- J: judge calibration on old drafts: not run: no model key
- D: LoRA fine-tune: not run: stop rule fires (see brief)

The deterministic checks cannot measure "sent as is": an email can pass every check and still be rewritten. That needs the judge, which needs a model key.
