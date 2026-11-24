# Still needs a person

## Before anything can run for real
1. **Model access.** A Portkey key (local) or an OpenRouter key (production), plus `MODEL_PRIMARY` and `MODEL_FALLBACK` names. Set `DAILY_SPEND_CAP_USD`.
2. **Web search.** `BRAVE_SEARCH_API_KEY` for the research step.
3. **Supabase.** Create a TEST project and, later, a separate LIVE one. Apply `supabase/migrations/0001_init.sql` to the test project first. The queue adapter for the database is not written yet.
4. **Google.** OAuth client (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`), `SESSION_SECRET`, the allow-lists (`ALLOWED_EMAILS`, `PARTNER_EMAILS`, `MAILBOX_EMAIL`), and a refresh token for the mailbox (Gmail send/read and Calendar free/busy and events). Add the Calendar scopes to the same sign-in.
5. **Hosting.** Put the same variables in the Vercel project, then run `select schedule_queue_cron('https://YOUR-APP-URL');` once in the database. Add `APP_URL` and `CRON_SECRET` as GitHub secrets for the backup trigger.

## Data
6. **Real exports.** The Loop 1 and Loop 2 exports, the deal memos, the partner notes and the portfolio were not readable from the shared Drive, so fictional versions were generated. Share them (or add them to `seed/`) and re-run `pnpm b6`.
7. **Riya's blind labels** and the partners' answers to the open questions in `docs/`.

## Checks that were not possible
8. A live "Thursday works" test from a second inbox (needs items 4 and 5).
9. Confirming a scheduled run reached the deployed app (`cron.job_run_details` shows succeeded and `net._http_response` shows 200).
10. A real model run on the 10 seed applications, then a look at the scores and a first real research run.
11. An accessibility scan (axe) and a 320 px reflow check.
12. Fill in "who to call if the deploy fails" in `RUNBOOK.md`.

## Decisions for you
- The repository is public. Decide whether the CAPilot seed application (derived from a Drive file) should stay or be replaced with a fully fictional one.
- Decide which email address the commits should show.
