# Master documents checklist — project setup & seed

> **Global vs project:** For what is uploaded **once org-wide** (MB master, checklist masters, BBS shapes) vs **per project** (BOQ, NCR, drawing register), see **[11-Global-Masters-vs-Project-Seed.md](./11-Global-Masters-vs-Project-Seed.md)**.

Use this list when onboarding a **new project** or refreshing demo data. Place files in a single folder (e.g. `Sharnam_modules_docs/`) with **exact filenames** below, then sync:

```bash
SHARNAM_EXCEL_ROOT=/path/to/Sharnam_modules_docs node scripts/sync-reference-sheets.mjs
npm run db:seed
# or on Hostinger first deploy: RUN_SEED=1 (once), then RUN_SEED=0 + SKIP_BUILD_SEED=1
```

**Rule:** One register per module — edit in the portal **or** re-import from Excel, not both in parallel without sync.

---

## Priority legend

| Tag | Meaning |
|-----|---------|
| **Required** | Portal cannot seed dashboards / DPR qty without this |
| **Recommended** | Strongly needed for WPR, quality, safety, or cost walkthrough |
| **Optional** | Template / export reference; can be filled in the portal instead |
| **Master** | Global template (not project-specific); loaded once at seed |

---

## 1. Cost & measurement (Required for DPR quantities)

| Filename | Portal module | Tag | What it seeds / feeds |
|----------|---------------|-----|------------------------|
| `SPDC_Budget_Arvind 49.xls` | Cost → Budget / MB / BBS / Monitoring | **Required** | Budget WBS, all monitoring sheets, MB lines, BBS lines, rate differences |
| `Cashflow - Dashboard.xlsx` | Cost → Cashflow | **Recommended** | Cashflow chart, forecast, tracking periods |
| `Payment Summary - VIATRIX - Copy.xlsx` | Cost → Vendor bills | Recommended | Vendor payment summary rows |

**After seed:** pick MB/BBS from **global master** per structure in Cost module.

---

## 2. Progress & schedule (Required for WPR progress sections)

| Filename | Portal module | Tag | What it seeds / feeds |
|----------|---------------|-----|------------------------|
| `Planned Vs. Actual Dashboard.xlsx` | Progress → Planned vs Actual | **Required** | Planned % vs actual % by package |
| `Progress Overview.xlsx` | Progress → Overview | **Recommended** | Activity lines, monthly SOR stats |
| `Milestone tracking.xlsx` | Progress → Milestones | **Recommended** | Milestone schedule (WPR section 15) |
| `HInderance Register Dashboard.xlsx` | Progress → Hindrance | **Recommended** | Hindrance register (DPR delays, WPR section 9) |
| `Risk Register - Dashboard 1.xlsx` | Progress → Risk | Recommended | Risk register (WPR section 10) |
| `Legal Approvals - Dashboard.xlsx` | Progress → Legal | Recommended | Legal approvals (WPR section 11) |
| `Monthly Progress Dashboard.xlsx` | Progress → Monthly | Recommended | Monthly progress + CAR register tab |

**Alternate copies:** If your pack has `(1)` suffix files (e.g. `Planned Vs. Actual Dashboard (1).xlsx`), seed prefers those when present.

**MS Project:** Export schedule as **XML** and import under Progress → MS Project (not an Excel file in this list).

---

## 3. Quality (Required for Quality dashboard & WPR quality)

| Filename | Portal module | Tag | What it seeds / feeds |
|----------|---------------|-----|------------------------|
| `Quality Dashboard.xlsx` | Quality → Dashboard | **Required** | KPI dashboard, CAR register, cube summary, QAP summary tabs |
| `NCR 01 .xlsx` | Quality → NCR / CAR | **Required** | Quality NCR and CAR register rows |
| `SPDC CUBE REGISTER (1).xlsx` | Quality → Cube tests | **Recommended** | Cube test register |
| `Quality Assurance Plan Week 50.xlsx` | Quality → QAP | **Recommended** | Weekly QAP activities (WPR section 19) |

---

## 4. Safety (Required for Safety dashboard & WPR HSE)

| Filename | Portal module | Tag | What it seeds / feeds |
|----------|---------------|-----|------------------------|
| `Safety Dashboard.xlsx` | Safety → Dashboard | **Required** | One-pager KPIs, site instruction, unsafe acts, NCR summary, HIRA, safety hours |
| `Safety NCR.xlsx` | Safety → NCR / observations | **Required** | Safety NCR forms and observation register |

---

## 5. Drawings & closure

| Filename | Portal module | Tag | What it seeds / feeds |
|----------|---------------|-----|------------------------|
| `DRAWING REGISTER - 01.xlsx` | Drawings → Register | **Required** | **Master** register (41+ rows, all DCI cols incl. issued-to/copies/critical), **Site** register (R0–R6 signatures), dashboard KPIs. Old *Client* sheet columns are on Master — no separate portal tab. |
| `Approval  &  GFC Drawing Log.xlsx` | Drawings → GFC log | Recommended | Approval & GFC drawing log |
| `Snaglist - Sharnam PMC.xlsx` | Closure → Snaglist | Recommended | Snaglist rows (falls back to demo rows if empty) |
| `Lessons Learnt - Sharnam PMC.xls` | Closure → Lessons | Recommended | Lessons learnt register |
| `Project Closure Report.docx` | Closure → Report | Optional | Closure report Word template |

---

## 6. Checklists (Master templates — global)

| Filename | Portal module | Tag | What it seeds / feeds |
|----------|---------------|-----|------------------------|
| `Final Index.xlsx` | Checklists → Site execution | **Master / Required** | Site checklist templates (Final Index family) |
| `Drwing check master checklist.xlt.xls` | Drawings → Drawing check | **Master / Required** | Drawing review checkpoint templates |

After seed: **assign** checklist types to each project under Checklist → Assign.

---

## 7. Reports (templates — export reference)

| Filename | Portal module | Tag | What it seeds / feeds |
|----------|---------------|-----|------------------------|
| `DPR-Sharnam PMC- ARVIND LIMITED (3).xlsx` | DPR Maker | Optional | DPR Excel layout reference (portal generates from live data) |
| `WPR File.xlsx` | WPR Maker → Client workbook | **Recommended** | Client WPR pack (21 tabs) — filled on export / publish |

The **26-section SPDC WPR pack** is generated by WPR Maker from live DB data (no separate template file).

---

## 8. CRM & commercial (office / pre-project)

| Filename | Portal module | Tag | What it seeds / feeds |
|----------|---------------|-----|------------------------|
| `Comparative Statement - R2.xlsx` | CRM → Bid compare | Recommended | Multi-vendor BOQ comparative (24 discipline slots on demo) |

**Quotation / RA / COP:** Created in portal (CRM Quotation maker, Finance → RA Bill Tracker). Reference format: `Viatrix_RA BILL_COP.xlsm` (not auto-seeded).

---

## 9. Comms (portal entry — optional Excel)

| Filename | Portal module | Tag | Notes |
|----------|---------------|-----|-------|
| `Communication Matrix_BPCL (1).xlsx` | Comms → Matrix | Optional | Demo uses seeded matrix rows; upload or edit in Comms for live projects |

---

## 10. Minimum pack to go live (summary)

**Must have (8 files)** for a working demo project with DPR + dashboards:

1. `SPDC_Budget_Arvind 49.xls`
2. `Planned Vs. Actual Dashboard.xlsx`
3. `Quality Dashboard.xlsx`
4. `NCR 01 .xlsx`
5. `Safety Dashboard.xlsx`
6. `Safety NCR.xlsx`
7. `DRAWING REGISTER - 01.xlsx`
8. `Final Index.xlsx` + `Drwing check master checklist.xlt.xls`

**Add for full WPR client pack:**

9. `WPR File.xlsx`
10. `Quality Assurance Plan Week 50.xlsx`
11. `SPDC CUBE REGISTER (1).xlsx`
12. `Milestone tracking.xlsx` + `HInderance Register Dashboard.xlsx`

---

## 11. New project setup order (after quotation award)

| Step | Action |
|------|--------|
| 1 | Place master Excel pack in `Sharnam_modules_docs/` (filenames above) |
| 2 | Run sync + seed (or Hostinger `RUN_SEED=1` once) |
| 3 | **Cost** — confirm BOQ / MB / BBS per structure |
| 4 | **Progress** — import Planned vs Actual; optional MS Project XML |
| 5 | **Quality / Safety** — verify dashboard tabs; assign QI + Safety checklists |
| 6 | **Drawings** — publish GFC sheets; confirm register links |
| 7 | **Finance** — PO → RA bills → COP |
| 8 | **DPR Maker** — publish daily disciplines |
| 9 | **WPR Maker** — week ending → review → publish SPDC pack + client workbook |

---

## 12. Related docs

| Doc | Topic |
|-----|-------|
| [09-Project-Setup-Sheets-Required.md](./09-Project-Setup-Sheets-Required.md) | DPR/WPR connection map |
| [08-Quality-Safety-DPR-WPR-Guide.md](./08-Quality-Safety-DPR-WPR-Guide.md) | Checklists + QAP |
| [../reference-sheets-manifest.md](../reference-sheets-manifest.md) | Sync script file list |

**Demo logins:** `office@sharnam.demo` / `site@sharnam.demo` · password `Demo@1234`
