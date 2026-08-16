# Reference sheet manifest

Client Excel packs drive seed data and module dashboards. **Do not commit large drops under `Sharnam_modules_docs/`** — that folder is gitignored.

## Sync command

```bash
node scripts/sync-reference-sheets.mjs
# or
SHARNAM_EXCEL_ROOT=/path/to/Sharnam_modules_docs node scripts/sync-reference-sheets.mjs
```

This copies canonical files into:

| Path | Purpose |
|------|---------|
| `seed/data/` | Hostinger / demo seed (`SHARNAM_EXCEL_ROOT=./seed/data`) |
| `docs/reference-sheets/` | Local mirror for PM review (gitignored) |

## Module mapping

| File | Portal module |
|------|----------------|
| Safety Dashboard.xlsx | Safety dashboard KPIs, Site Instruction, Unsafe Act Summary, NCR Summary, HIRA, Safety Hours |
| Safety NCR.xlsx | Safety NCR form + Observation sheet |
| Comparative Statement - R2.xlsx | CRM bid management comparative + vendor BOQs |
| NCR 01 .xlsx | Quality NCR / CAR register |
| SPDC CUBE REGISTER (1).xlsx | Cube register |
| Quality Assurance Plan Week 50.xlsx | QAP activities |
| DRAWING REGISTER - 01.xlsx | Drawing register |
| HInderance Register Dashboard.xlsx | Hindrance register |
| Legal Approvals - Dashboard.xlsx | Legal approvals |
| Milestone tracking.xlsx | Milestones |
| Monthly Progress Dashboard.xlsx | Monthly progress + CAR register |
| Progress Overview.xlsx | Progress overview |
| Risk Register - Dashboard 1.xlsx | Risk register |
| Payment Summary - VIATRIX - Copy.xlsx | Vendor bills (cost) |
| Planned Vs. Actual Dashboard.xlsx | Progress planned vs actual |
| Cashflow - Dashboard.xlsx | Cashflow |
| Approval & GFC Drawing Log.xlsx | GFC drawing log |
| DPR-Sharnam PMC- ARVIND LIMITED (3).xlsx | DPR template |
| WPR File.xlsx | WPR template |

## Upload convention

Project teams may upload updated sheets via each module’s **Import / sync from sheet** action (where implemented). Filenames should match the manifest above so seed parsers and dashboard loaders resolve them without renaming.
