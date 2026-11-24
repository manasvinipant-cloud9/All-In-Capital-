# Seed data

The fund's real seed data, as provided: 10 applications (deck and form each), twelve deal memos, partner meeting notes, the two B6 exports and the operating facts. Founder names and companies in these files are as supplied by the fund.

- `decks/<app>.pdf`, `forms/<app>.pdf`: the application documents. `forms/<app>.json` is the form read by `parseFormTable`.
- `apps.json`, `memos.json`, `meetings.json`: structured from the PDFs in `source/`.
- `portfolio.json`: **partial**. Only the six backed companies named in the memos and MeetRecord (meeting 4). The full 22-company portfolio list was not provided.
- `exports/`: Loop 1 (40 screening rows) and Loop 2 (60 first-email rows).

Re-import with `pnpm tsx scripts/import-real.ts "<applications folder>" "<seed data folder>"`.
