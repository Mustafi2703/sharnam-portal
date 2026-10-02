# Quality module

Live module — formats match client Excel under `Sharnam_modules_docs 2/`.

## Tools

| Tool | Route | Source sheet |
|------|-------|----------------|
| Quality dashboard | `/inspections` | `Quality Dashboard.xlsx` (+ live KPIs / CAR) |
| **NCR / CAR** | `/inspections` · CAR tab | `NCR 01 .xlsx` branded export |
| **Cube register** | `/inspections?sheet=cube-test` | `SPDC CUBE REGISTER (1).xlsx` |
| QAP | `/qap` | `Quality Assurance Plan Week 50.xlsx` |
| Inspection register (Quality IR) | `/inspection` | `SPDC_Request_for_Inspection_Form.xlsx` |
| Checklist master | `/quality/checklist-master` | QI Excel templates |
| QI fill log | `/quality/checklist-logs` | Fill audit · branded HTML/XLSX |

## Rules

- **Weekly pack:** Publish QAP writes QAP + cube + dashboard (+ NCRs) to ISO folders and `Weekly/{week}` — same pattern as drawings.
- **Cube:** Import/export use SPDC columns B–M; do not leave Burckhardt demo rows in exports. Portal may show Test agency / Phase for site work.
- **Quality IR:** Raise with checklist + assignee from project directory **or** communication matrix (email match). Assignees fill via portal fill log / fill window.
- **NCR:** Generated in branded NCR 01 format; synced to Drive on create/close and on quality pack publish.
- **Purge:** Use **Clear Quality · Safety** (or `scripts/purge-quality-safety.mts`) — does not wipe drawings.

## Status

Quality is production-ready after Voltamp quality/safety data wipe. Progress and Safety next; Cost and Finance after.
