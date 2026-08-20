# Progress module

## Tools (each sheet → separate hub card)

| Tool | Route | Source sheet |
|------|-------|----------------|
| Overview dashboard | `/progress` | `Progress Overview.xlsx` |
| Milestones | `/progress?tab=milestones` | `Milestone tracking.xlsx` |
| Planned vs Actual | `/progress?tab=planned` | `Planned Vs. Actual Dashboard` |
| Monthly progress | `/progress?tab=monthly` | `Monthly Progress Dashboard` · SOR |
| Hindrance | `/progress?tab=hindrance` | `Hindrance Register Dashboard` |
| Risk | `/progress?tab=risk` | Progress Overview · Risk |
| Legal approvals | `/progress?tab=legal` | `Legal Approvals - Dashboard.xlsx` |
| S-curve | `/progress?tab=scurve` | MS Project XML weekly % |
| MS Project | `/progress?tab=msproject` | MS Project XML task register |

Removed: Summary schedule and Procurement placeholders (no client sheet).

## Portal behaviour

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

S-curve and MS Project XML import feed DPR dashboard charts and WPR progress slides.
