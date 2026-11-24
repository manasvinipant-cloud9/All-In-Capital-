# B6 harness results (sealed test set, 20 rows)

Seal verified: `964eb1a89cf1a16ef608c77a629b34240f00dcf8883a525a7a9e640efb0012da`.

**Read this first:** every row here comes from a fictional export that I generated, because the real Loop 2 export was not readable. These numbers test the harness. They say nothing about how Riya actually writes, and a high score here would not be evidence of anything.

| Arm | Passes all checks | Identical to Riya's email | Mean word overlap with Riya's | Emails with a number not in the facts |
|---|---|---|---|---|
| A: old system drafts | 9 of 20 | 9 | 0.53 | 0 |
| T: fixed template (no model) | 20 of 20 | 0 | 0.71 | 0 |
| R: Riya's own emails (sanity) | 20 of 20 | 20 | 1 | 0 |

"Identical to Riya's email" for arm A is the measured sent-as-is baseline on these rows (9 of 20). The master brief's 42% is the figure for the real data, which I could not see.

## Not run
- B: current prompt: not run: no model key
- C: new prompt + Riya's examples: not run: no model key
- E: new prompt, no examples: not run: no model key
- J: judge calibration on old drafts: not run: no model key
- D: LoRA fine-tune: not run: stop rule fires (see brief)

The deterministic checks cannot measure "sent as is": an email can pass every check and still be rewritten. That needs the judge, which needs a model key.
