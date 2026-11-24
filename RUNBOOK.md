# Runbook

For Riya and the analyst. No engineering needed for the day-to-day items below. Where a step needs a technical person, it says so.

## What runs by itself

- Every 5 minutes the app checks founder replies and books calls, then reads at most one new application.
- Booking never sends a first letter. You always click send on the first letter.
- Nothing is ever rejected or advanced automatically.

## You see / it means / do this

| You see | It means | Do this |
|---|---|---|
| A banner: "New applications are on hold for today and will continue after midnight." | The daily spend limit was reached. | Nothing. It resumes by itself after midnight India time. Booking calls keeps working. To raise the limit, the analyst changes `DAILY_SPEND_CAP_USD` (see "Change a setting"). |
| A red box on the Board called "Needs a look" | An application failed twice. Nothing is lost. | Open it from the box. Try again later, or ask the analyst to look at the "Cron" and "Queue" notes below. |
| An application stuck with "waiting for a model key" | The AI service is not connected yet. | The analyst adds the model keys (see "Change a setting"). Checks on numbers, conflicts and stage already work without them. |
| "Connect Gmail to send" when you click send | Your Gmail is not connected to the app. | The analyst connects it. Nothing was sent. |
| "Founder replied: needs you" | A reply was not a clear time (a question, a "no", or unclear). | Open Gmail, read the reply and answer there. The app does nothing else on that thread. |
| A call is in your calendar you did not expect | A founder suggested a time and you were free. | Open the Meetings page. If you cannot make it, cancel in Google Calendar and write to the founder. |
| Sign-in says "This email is not on the team list" | That email is not allowed. | A partner asks the analyst to add it to the allowed list. |
| Sign-in says "Sign-in is not set up yet" | The Google keys are missing. | Ask the analyst. |
| A rating you do not trust | Ratings are advice. You decide. | Say Yes or No on the application and add one line of why. It appears under Corrections and is shown for similar applications. |

## If sending looks wrong

Stop and tell a partner before sending more letters. There is no automatic pause switch yet. To stop automatic booking right away, the analyst removes the 5-minute schedule (see "Cron").

## Change a setting (analyst)

- Rubric weights, thresholds and fund limits: the Settings page. Only partners can save. Each save is a new version.
- Keys and limits (model keys, Google keys, spend limit): the hosting dashboard's environment variables. After changing one, redeploy.
- To rotate a key: create a new key at the provider, put it in the environment variable, redeploy, then delete the old key at the provider.
- Never paste a key into chat, email or a document.

## Cron (technical person)

- Main trigger: the database runs a job every 5 minutes. It uses a token kept in the database vault. To set it up once after deploying, run `select schedule_queue_cron('https://YOUR-APP-URL');` in the database console. The token is never shown.
- To check it is working, run the two queries at the bottom of `supabase/migrations/0002_cron.sql`. Look for "succeeded" and a 200 response.
- Backup trigger: a GitHub Action calls the same address. It needs two GitHub secrets, `APP_URL` and `CRON_SECRET`.
- To run it by hand on your laptop: `pnpm worker --once`.

## Reports (analyst)

- Costs, in a terminal only: `pnpm cost`.
- Load check: `pnpm loadtest` (simulated) or `pnpm loadtest --live` (real AI service, uses money).

## Who to call if the deploy fails

Fill this in before go-live: _name and number of the person who deploys_, and _the hosting account owner_. The app is hosted on Vercel; the database is Supabase.

## Known gaps (as of this version)

- Reading, scoring and drafting are connected but have only been tried with a pretend model. They wait for model keys. Until an application has been scored, its rating on screen is a labelled placeholder.
- The research step (looking up founders on the web) is not built yet.
- Follow-ups are prepared after 3 working days of silence and appear on the Meetings page under "Follow-ups ready". They are never sent until you click.
- Gmail and Calendar are written but have not been tried against real accounts.
- There is no pause-sending switch.
- The database is not connected yet: decisions and settings are saved on the machine running the app.
