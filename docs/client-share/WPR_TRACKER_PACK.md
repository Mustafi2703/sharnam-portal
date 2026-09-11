# WPR client tracker pack — sheet map

Reference workbooks live in `templates/wpr-client/` (copied from `packages/shared/untitled folder`).

## Client WPR workbook (`WPR-Client-Week-Template.xlsx`)

| Sheet | Portal register | Path |
|-------|-----------------|------|
| Hinderance Register | Hindrance | Progress → Hindrance |
| Risk Register | Risk | Progress → Risk |
| Legal Approval Tracker | Legal approvals | Progress → Legal |
| Procurement tracker | Procurement lines | Progress → **WPR trackers** |
| Procurement Status | PO summary | Finance → PO / WPR procurement section |
| Weekly Manpower | Manpower | Progress → Planned vs Actual (manpower) |
| Project Cashflow | Cashflow months | Progress → Planned vs Actual (cashflow) |
| HSE Statistic | Safety records | Safety module → WPR safety section |
| Quality Statistic | SOR / observation stats | Progress → WPR trackers (quality tab) |
| Cube Test | Cube register | Quality → Cube |
| Planned Vs Actual | Activity qty | Progress → Planned vs Actual |
| Value Addition | VE register | Progress → **WPR trackers** |
| As per drawing status | Weekly executed / BOQ qty | Progress → Planned vs Actual (activity) |
| Design status | GFC by discipline | Drawings register → WPR design status |

## Supporting workbooks

| File | Sheets | Portal |
|------|--------|--------|
| `PR-Tracker-Template.xlsx` | PR Tracker, Invoice Tracker | Progress → **WPR trackers** (PR + Invoice tabs, popup forms) |
| `Site-Materials-Template.xls` | Site stock | Progress → WPR trackers (materials) |
| `DCI-Drawing-Register-Template.xlsx` | DCI | Drawings → register / WPR drawing register |
| `Project-Dashboard-Budget-Template.xlsx` | Budget dashboard | Cost monitoring + WPR project dashboard |
| `SPDC_Budget_Arvind 52.xls` | 36 MB/monitoring sheets | Cost → monitoring import (existing) |

## Import in portal

1. Office → Project → **Finance** → **PR Tracker** / **Invoice processing** (ISO 05.01 / 09.01)
2. Click **Import PR Tracker-52** — or Progress → WPR trackers for VE / procurement / materials / quality
3. Click **Import 23–29 July WPR pack** on Progress for the remaining execution sheets
3. Add / edit tracker rows with the **popup form** (not inline on the sheet)
4. **WPR Maker** → set week ending **29 Jul 2026** → Regenerate → Download PPTX (branded, no black slides) + client XLSX

Pre-built from the July workbook (sheet titles + charts):

- `docs/client-share/WPR-Arvind-23-29-Jul-2026.pptx`
- `docs/client-share/WPR-Arvind-23-29-Jul-2026.xlsx`

Regenerate with `npm run wpr:july-pptx`.

API: `POST /api/progress/:projectId/import-wpr-trackers`

## WPR Maker sections (25)

Now includes **Value Addition** (section 23) plus existing hindrance, risk, legal, procurement, PR, materials, quality stats, cube, safety, PvA, etc.

Seed on `SPDC-DEMO-01`: `npm run db:seed` runs tracker import automatically after `db:push`.
