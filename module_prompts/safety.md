# Safety module

## Tools (each sheet → separate hub card)

| Tool | Route | Source sheet |
|------|-------|----------------|
| Safety dashboard | `/safety` | Observations / incidents summaries |
| **Safety NCR** | `/safety?view=ncr` | `Safety NCR.xlsx` |
| Safety checklists | `/checklist-master?family=Safety` | Excel safety templates |
| Safety fill log | `/checklist-logs?family=Safety` | Fill audit |
| Request for Inspection | `/rfis?kind=SafetyChecklist` | Inspection / checklist fill |

## Rules

- Safety NCR is its **own hub tool** (not only a filter buried in the dashboard).
- Same inspection-request + checklist-attach pattern as Quality.
- Record type includes `NCR` for sheet-aligned logging.
