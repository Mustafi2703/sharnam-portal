# Quality module

## Tools (each sheet → separate hub card)

| Tool | Route | Source sheet |
|------|-------|----------------|
| Quality dashboard / QI | `/inspections` | QI process + QAP status |
| **NCR / CAR** | `/inspections?view=ncr` | `NCR 01.xlsx` |
| **Cube register** | `/inspections?view=cube` | `SPDC CUBE REGISTER` |
| QAP | `/qap` | `Quality Assurance Plan Week 50.xlsx` |
| Checklist master | `/checklist-master?family=QualityInspection` | Excel QI templates |
| QI fill log | `/checklist-logs?family=QualityInspection` | Fill audit |
| Site checklists | `/checklist` | Final Index |
| Request QI fill | `/rfis?kind=QualityInspection` | Inspection request (not information) |

## Rules

- NCR and Cube are **first-class hub tools**, not buried only inside the QI dashboard.
- Master checklist tool lives here for quality family; drawing checklist master lives under Drawings.
- Request for **Inspection** uses kind `QualityInspection`.
