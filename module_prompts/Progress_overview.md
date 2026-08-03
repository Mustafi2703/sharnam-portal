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
| Legal approvals | `/progress?tab=legal` | Progress Overview · Legal Approval |

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

## Future civil tools (PRODUCT_IA) — Ready hub cards

| Tool | Route | Status |
|------|-------|--------|
| S-curve | `/progress?tab=scurve` | Ready — awaits sheet |
| Summary schedule | `/progress?tab=schedule` | Ready — awaits sheet |
| MS Project progress | `/progress?tab=msproject` | Ready — awaits sheet |
| Procurement plan | `/progress?tab=procurement` | Ready — awaits sheet |

Do not fold into Overview. Drop the sheet → fill placeholder → keep hub card.
