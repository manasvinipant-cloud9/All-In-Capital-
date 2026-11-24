# Phase 2 report: deterministic steps on the 10 seed applications
Model-backed steps (claim extraction, research, G2 model check, scoring) need a model key and were tested with a mock transport only. Run with `pnpm tsx scripts/pipeline-report.ts`.

| App | Trap planted | Gates tripped | Checks |
|---|---|---|---|
| CAPilot | real Drive deck; 31 'paying' vs MRR chart; churn | none | warn: Paying customer count differs (form 24 vs deck 31) |
| GreenLoop Snacks | clean strong brand, repeat by cohort | none | none |
| ScrollStar | downloads and followers only, no retention | G4 | red: TAM does not follow from its inputs (500000000 x 2000 = 1,00,000 Cr, deck says 10,000 Cr) |
| LendKart | lender: defaults are the NBFC partner's problem | none | none |
| CoinLane | existence depends on favourable regulation | G2 | none |
| Notely Calls | overlaps portfolio company MeetRecord | G3 | none |
| EarnWise | team size mismatch; inflated credentials; TAM x10 | G4 | red: TAM does not follow from its inputs (40000000 x 2280 = 9,120 Cr, deck says 91,200 Cr)<br>red: Team size differs (form 5 vs deck 12)<br>red: Live customers differ (form 1 live (1 live customer, 2 pilots) vs deck 3 live)<br>red: Credentials differ (deck: "Ex-Goldman Sachs, Ex-Google, MBA IIM Ahmedabad" vs form: "Goldman Sachs: 10-week internship. Google: 5-month vendor contract. Tier-2 business school") |
| DroneDrishti | hardware, long regulatory path, clear milestones | none | none |
| ShipRight Logistics | later-stage round above cheque | G1 | none |
| RuralRoots Credit | lender who did field groundwork and owns first loss | none | warn: Form revenue not found in deck (form INR 9 L monthly) |
