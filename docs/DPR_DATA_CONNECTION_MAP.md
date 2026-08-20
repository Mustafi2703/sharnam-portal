# DPR data connection map

How the **Daily Progress Report (DPR)** pulls live project data — aligned to client packs in `Sharnam_modules_docs/` and SPDC templates in `apps/api/dpr-templates/`.

> **Master one-layer flow (all modules + SharePoint + RFI archive + verify-pack):**  
> [MASTER_DATA_FLOW.md](./MASTER_DATA_FLOW.md)

## Reference files

| Client file | Portal equivalent |
|-------------|-------------------|
| `DPR-Sharnam PMC- ARVIND LIMITED (3) (1).xlsx` · Summary | DPR Maker · quantity progress (BOQ lines) |
| SPDC `*_DASHBOARD.xlsx` (7 disciplines) | DPR Maker patches INPUT → DASHBOARD formulas |
| Same · Manpower, Equipments, Materials | DPR sections 3–5 + Cost BBS → rebar kg |
| Same · Concern / Hindrance Register | Open hindrances → delays + issues |
| `Planned Vs. Actual Dashboard.xlsx` | `ProgressActivityLine` → planned qty on BOQ rows |
| `SPDC_Budget_Arvind 49.xls` | Cost · Monitoring / MB / BBS (per package) |
| `Safety Dashboard.xlsx` / Safety NCR | `SafetyRecord` → HSE block |
| `NCR 01.xlsx` / `SPDC CUBE REGISTER` | `QualityNcr` + `CubeTest` → quality block |
| `Quality Assurance Plan Week 50.xlsx` | QAP test agency names → DPR quality line |
| `SPDC_Arvind Limited_WPR_50.pptx` | WPR Maker (weekly rollup; shares same DB tables) |

## Per discipline (7 packages)

| Discipline | Cost package(s) | DPR template |
|------------|-----------------|--------------|
| CIVIL | Civil Dormitory, Combined | SPDC_DPR_CIVIL_DASHBOARD.xlsx |
| ELECTRICAL | Electric, External Electric | SPDC_DPR_ELECTRICAL_DASHBOARD.xlsx |
| FIRE | Fire Fighting, Fire Alarm | SPDC_DPR_FIRE_DASHBOARD.xlsx |
| MECHANICAL | Gas Line, Furniture | SPDC_DPR_MECHANICAL_DASHBOARD.xlsx |
| PEB_ERECTION | Compound Wall, Road & Paving, External Development | SPDC_DPR_PEB_ERECTION_DASHBOARD.xlsx |
| PEB_SUPPLY | Combined, Windows, WPC Door | SPDC_DPR_PEB_SUPPLY_DASHBOARD.xlsx |
| PLUMBING | Plumbing, UGWT, Septic Tank | SPDC_DPR_PLUMBING_DASHBOARD.xlsx |

## Auto-fill sources (`buildDprAutoFill`)

When you open DPR Maker for a **new** date/discipline, the API seeds from:

1. **BOQ monitoring** (`CostMonitoringLine`) — progress lines, scope qty, rate, achieved  
2. **Planned vs Actual** (`ProgressActivityLine`) — planned/actual hints on matching activities  
3. **Measurement book** (`CostMbLine`) — enriches cumulative qty where description matches  
4. **BBS** (`CostBbsLine`) — total bar weight (kg) → reinforcement material consumed  
5. **Prior DPR snapshots** — cumulative qty, man-days, safe man-hours  
6. **Manpower register** (`ProgressManpower`) — planned vs available by trade  
7. **Safety** (`SafetyRecord`) — toolbox, observations, near miss, first aid  
8. **Quality SOR** (`QualitySiteRecord` + `QualityNcr` on report day) — obs/instructions/NCR/CAR lines  
9. **Cube register** (`CubeTest` where cast/test date = report day) — sets cast, 7d/28d results, pass/fail counts  
10. **Testing agency** — unique `CubeTest.testAgency` + `QapActivity.testAgency`  
11. **Checklist fills** — QI + Safety count for report day  
12. **Hindrance** (`ProgressHindrance`) — delays + issues  
13. **Open RFIs** — approvals pending block  
14. **Cashflow** (`CostCashflowPeriod`) — AC certified to date (header)

Implementation: `apps/api/src/services/dprIntegrations.ts`  
Template cell map: `apps/api/src/services/dprXlsx.ts` (INPUT rows 66–74 quality, 39–45 manpower, etc.)

## DPR INPUT sheet → portal (quality section)

| INPUT row label | Auto-fill source |
|-----------------|------------------|
| SOR — site observations today | `QualitySiteRecord` (non-instruction) on report day |
| SOR — site instructions today | `QualitySiteRecord` (Site Instruction) on report day |
| Pour cards / cube sets cast | Cube groups with cast date = report day |
| Concrete cube sets / slump | Specimen count + pass/fail summary |
| **Testing agency (cube / QAP)** | Logged agencies on cubes + QAP lines |
| 7-day / 28-day cube result | Matching test dates on report day |
| NCR / CAR today | NCRs issued/closed on report day |
| QI / Safety checklists filled | Submissions on report day |
| Field density tests | Manual (no register yet) |

## Still manual each day (yellow INPUT cells)

| Field | Why |
|-------|-----|
| **qtyToday** on each BOQ line | Site engineer enters daily achievement |
| Equipment utilization | Not wired — template placeholders |
| Material received/consumed (most rows) | Except BBS rebar kg auto-fill |
| Highlights / next-day plan / decisions | Narrative |
| S-curve actual % history | Needs cumulative qty over time |
| Weather / shift hours | Header fields in DPR editor |

## Minimum setup for a complete DPR day

1. **Cost → BOQ monitoring** — discipline package lines exist  
2. **Progress → Planned vs Actual** — import Excel once (`Planned Vs. Actual Dashboard.xlsx`)  
3. **Quality → Cube** — sync SPDC template; set cast/test dates + agency on report day  
4. **Quality → SOR / NCR** — log site obs/instructions/defects for that date  
5. **Safety** — toolbox / observations for that date  
6. **Checklists** — submit QI + Safety fills  
7. **DPR Maker** — enter **today's qty** → publish  

## Demo day seed

```bash
npm run db:seed-dpr-demo
DPR_DEMO_DATE=2026-08-14 npm run db:seed-dpr-demo
```

Creates published `DprSnapshot` rows for all 7 disciplines on **SPDC-DEMO-01**.

## Update rule (single source of truth)

| You update in… | DPR auto-fills… |
|----------------|-----------------|
| Cost → Monitoring (BOQ) | Quantity progress rows |
| Cost → MB | Cumulative qty (matched lines) |
| Cost → BBS | Rebar kg in materials |
| Progress → Planned vs Actual | Planned qty remarks / fallbacks |
| Safety module | HSE statistics |
| Quality → SOR / NCR / Cube / QAP agency | Quality control figures |
| Hindrance register | Delays + issues |
| RFIs (open) | Approvals pending |
| Prior published DPR | Cumulative headers + line history |

## WPR connection

WPR Maker seeds weekly sections from the same tables (`wprSeedSections.ts`). DPR is the **daily** slice; WPR is the **weekly** rollup.

## Deploy note

After releases that change Prisma schema (e.g. `CubeTest.testAgency`):

```bash
npx prisma db push
```

Ensure `SHARNAM_EXCEL_ROOT=./seed/data` on production so QAP/cube sync-template resolves workbooks.

## Still to wire (next)

- [x] Day log manpower → DPR autofill fallback (when Progress manpower empty)
- [x] Closed RFI → branded checklist XLSX + register CSV to SharePoint
- [x] Pack completeness verify (`GET …/verify-pack`)
- [ ] Equipment list auto-fill from day log equipment rows
- [ ] Field density test register → DPR quality line
- [ ] Material received/consumed from site store ledger

COP Certified/Approved/Paid now writes Cost cashflow actual (day / week / month). MB sync still drives monitoring achieved qty. PVA cashflow auto-syncs from Progress on import + Sync button.
