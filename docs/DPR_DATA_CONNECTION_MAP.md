# DPR data connection map

How the **Daily Progress Report (DPR)** pulls live project data — aligned to client packs in `Sharnam_modules_docs/`.

## Reference files

| Client file | Portal equivalent |
|-------------|-------------------|
| `DPR-Sharnam PMC- ARVIND LIMITED (3) (1).xlsx` · Summary | DPR Maker · quantity progress (BOQ lines) |
| Same · Daily Progress Dashboard | SPDC template DASHBOARD sheet (formulas in `apps/api/dpr-templates/`) |
| Same · Manpower, Equipments, Materials | DPR sections 3–5 + Cost BBS → rebar kg |
| Same · Concern / Hindrance Register | Open hindrances → delays + issues |
| `Planned Vs. Actual Dashboard.xlsx` | `ProgressActivityLine` → planned qty on BOQ rows |
| `SPDC_Budget_Arvind 49.xls` | Cost · Monitoring / MB / BBS (per package) |
| `Safety Dashboard.xlsx` / Safety NCR | `SafetyRecord` → HSE block |
| `NCR 01.xlsx` / `SPDC CUBE REGISTER` | `QualityNcr` + `CubeTest` → quality block |
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
8. **Quality** (`QualityNcr`, `CubeTest`) — NCR count, cubes cast today  
9. **Hindrance** (`ProgressHindrance`) — delays + issues  
10. **Open RFIs** — approvals pending block  
11. **Cashflow** (`CostCashflowPeriod`) — AC certified to date (header)

Implementation: `apps/api/src/services/dprIntegrations.ts`

## Demo day seed (client walkthrough)

After `npm run db:seed`, publish one full DPR day for **SPDC-DEMO-01** (all 7 disciplines):

```bash
npm run db:seed-dpr-demo
# optional fixed date:
DPR_DEMO_DATE=2026-08-14 npm run db:seed-dpr-demo
```

This creates **Published** `DprSnapshot` rows and writes XLSX files under  
`uploads/onedrive/SPDC-DEMO-01/07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records/<DISCIPLINE>/`.

**Portal:** login `office@sharnam.demo` → project **SPDC-DEMO-01** → **DPR Maker** → pick demo date → download XLSX (DASHBOARD sheet has live formulas).

## Update rule (single source of truth)

| You update in… | DPR auto-fills… |
|----------------|-----------------|
| Cost → Monitoring (BOQ) | Quantity progress rows |
| Cost → MB | Cumulative qty (matched lines) |
| Cost → BBS | Rebar kg in materials |
| Progress → Planned vs Actual | Planned qty remarks / fallbacks |
| Safety module | HSE statistics |
| Quality → NCR / Cube | Quality control figures |
| Hindrance register | Delays + issues |
| RFIs (open) | Approvals pending |
| Prior published DPR | Cumulative headers + line history |

Site engineer still enters **today's qty**, weather, photos, and signs off — everything else pre-fills.

## WPR connection

WPR Maker already seeds weekly sections from the same tables (`wprMaker.ts` · `seedSections`). DPR is the **daily** slice; WPR is the **weekly** rollup to `SPDC_Arvind Limited_WPR_*.pptx` structure.

## Still to wire (next)

- [ ] Reports `/reports` DPR tab reads `DprSnapshot` when published (not only day-log aggregate)  
- [ ] Progress UI tab imports `Planned Vs. Actual Dashboard.xlsx` charts verbatim  
- [ ] Publish DPR → push Summary row into cumulative register (like client Summary sheet columns)  
- [ ] Equipment list auto-fill from site diary / fixed register per project  
