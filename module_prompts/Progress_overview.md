# Progress module

## Tools

| Tool | Behaviour |
|------|-----------|
| Overview dashboard | Printable summary (PDF later) of milestones, risk, hindrance |
| Milestones | Code, category, activity, planned/actual dates & duration, variance |
| Planned vs Actual | Same editable input layout as sheet; charts for print |
| Monthly progress | Monthly package progress register |
| Hindrance register | Description, location, activity, category, type, dates, days |
| Risk register | Identify → assess (probability × consequence), cost impact |

## Sheet sources

- `Progress Overview.xlsx` — Dashboard, Legal Approval, Milestone, Risk, Hindrance  
- `Milestone tracking.xlsx`  
- `Planned Vs. Actual Dashboard (1).xlsx` — cashflow, manpower, qty register  
- `Monthly Progress Dashboard (1).xlsx` — SOR log  
- `HInderance Register Dashboard (1).xlsx`

## Portal tabs (seeded 1:1 from sheets)

| Tab | Data |
|-----|------|
| Dashboard | Charts: milestone status, legal status, hindrance by activity, cashflow P/A, manpower, SOR |
| Milestones | Full date/weight/%/stakeholder/zone register + add form |
| Planned vs Actual | Cashflow + manpower + activity qty lines |
| Monthly | SOR open/closed/closure rate |
| Hindrance | Full register columns + log form |
| Risk | Identify/assess register + form |
| Legal | Legal Approval Tracker + form |

## Checklist fills → Progress Reports (DPR / WPR)

| Checklist type | Updates in Progress Reports |
|----------------|----------------------------|
| **SiteExecution** (Final Index) | DPR daily **site checklist** section |
| **DrawingCheck** (Drawing Check Master) | WPR / DPR **Drawing / GFC checklist** section |
| **QualityInspection** (QI forms) | WPR / DPR **Quality** section (+ NCR / cube / QAP) |
| **Safety** | WPR / DPR **Safety** section |

Seed refreshes sheet-backed registers on `npm run db:seed` so Excel edits stay maintained.
