# Still needs a person

## Before anything can run for real
1. **Model access.** A Portkey key (local) or an OpenRouter key (production), plus `MODEL_PRIMARY` and `MODEL_FALLBACK` names. Set `DAILY_SPEND_CAP_USD`.
2. **Web search.** `BRAVE_SEARCH_API_KEY` for the research step.
3. **Supabase.** Create a TEST project and, later, a separate LIVE one. Apply `supabase/migrations/0001_init.sql` to the test project first. The queue adapter for the database is not written yet.
4. **Google.** OAuth client (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`), `SESSION_SECRET`, the allow-lists (`ALLOWED_EMAILS`, `PARTNER_EMAILS`, `MAILBOX_EMAIL`), and a refresh token for the mailbox (Gmail send/read and Calendar free/busy and events). Add the Calendar scopes to the same sign-in.
5. **Hosting.** Put the same variables in the Vercel project, then run `select schedule_queue_cron('https://YOUR-APP-URL');` once in the database. Add `APP_URL` and `CRON_SECRET` as GitHub secrets for the backup trigger.

## Data
6. **The full portfolio list.** The 22 companies on the fund's `/fund` page were not provided. Only seven are known (six backed in the memos, plus MeetRecord), so the portfolio-overlap check can miss a conflict with the other fifteen. Send the list and one line on each, or add it to `seed/portfolio.json`.
7. **Riya's 20 blind labels** and the partners' answers to the open questions in `docs/`.
8. **Founder email addresses.** The fund's form has no email field, so the first email's "To" box starts empty and must be typed.

## Checks that were not possible
9. A live "Thursday works" test from a second inbox (needs items 4 and 5).
10. Confirming a scheduled run reached the deployed app (`cron.job_run_details` shows succeeded and `net._http_response` shows 200).
11. A real model run on the 10 applications, then a look at the scores and a first real research run.
12. An accessibility scan (axe) and a 320 px reflow check.
13. Fill in "who to call if the deploy fails" in `RUNBOOK.md`.

## Decisions for you
- The repository is public and now contains the fund's seed files. That was your call; revisit it if the course owner objects.
- Riya's real emails offer two dates and say "afternoon" (no clock time), but the automatic booking needs exact times. Decide the format: dates plus a time, or dates plus "afternoon" with Riya choosing the time when she replies.
