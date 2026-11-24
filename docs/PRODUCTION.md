# Production readiness: the five questions

Status as of Phase 6. "Built" means code and tests exist. "Verified" means it was run against the real service. Nothing external has been verified yet because no keys or projects exist.

## 1. Does it work?
- Built and tested: deterministic pipeline (reconcile, gates, rank), blind calibration harness (9 of 12 with the offline stand-in, in-sample), email linter, slot logic, reply parser, auto-scheduler with fixtures.
- Not verified: any model-backed step, Gmail, Calendar, Langfuse, Supabase.
- Kill thresholds are not yet set because there is no model result to judge. Proposal: do not go live if blind calibration agreement is below 9 of 12 with the real model, or if any first letter fails the linter in a 20-application dry run.
- The sealed test set and harness belong to the fine-tuning experiment (Phase 7).

## 2. Is it safe?
- Built: model gateway is the only file that can call a model (test enforces it); names become [F1]; emails, phones and LinkedIn URLs are blocked by a guard that throws; every system prompt ends with the data-not-instructions line; keys come from environment variables only; the browser never talks to the database (row-level security is on with no public policies; only server code would hold the service key); sign-in is limited to an allowlist with a signed cookie; settings and portfolio edits are partner-only; the first letter needs a click and a confirmation naming the recipient; booking after that is limited to two kinds of message.
- Cache entries expire after 30 days. The cache is in memory only today, so it also clears on restart.
- Separate test and live databases: planned, not created. The migration must be applied to a TEST project first.
- Not built: a pause-all-sending switch (the runbook says so).

## 3. Can it handle real use?
- Built: retries on 429 and 5xx (1s, 2s, 4s plus jitter, then the fallback model); queue with one application per run and two attempts before "Needs a look"; 30-day cache for deterministic calls; load test script.
- Measured: simulated load test only (20 calls at once, 429s injected). Result: 19 of 20 succeeded, the 1 failure was the injected bad request. This tests the retry logic, not any real service.
- Not measured: a live load test (`pnpm loadtest --live`) needs model keys.
- The queue is file-backed for development. The production queue (pgmq) tables exist in the migration but there is no adapter yet. This is the main gap before go-live.

## 4. Can someone else operate it?
- Built: plain-language `RUNBOOK.md` with a you-see / it means / do-this table; `llm_calls` ledger (file in development, table defined in the migration); Langfuse sink written (untested).
- Not built: writing the ledger to the `llm_calls` table in Supabase.

## 5. Do the economics work?
- Built: cost per call, application, day and month in a terminal report (`pnpm cost`), never in the UI; a daily spend cap that pauses the queue and resumes after midnight IST with a neutral banner and no amounts; the scheduler does not use a model so it keeps running when paused.
- Not measured: real cost per application, because no real model calls have been made.

## Cron
- `supabase/migrations/0002_cron.sql`: token generated inside the database and kept in Vault; `schedule_queue_cron(app_url)` is called once by a person after deploy. The route accepts `CRON_SECRET` (backup GitHub Action) or the Vault token through the security-definer function `check_cron_token`.
- Not done: confirming a scheduled run reached the app (`cron.job_run_details` succeeded and `net._http_response` 200). That needs a Supabase project and a deployed app, so Phase 6 cannot be called fully done until then.
