# Cost sheet connection map (SPDC Budget workbook)

Exact column layout from `seed/data/SPDC_Budget_Arvind 49.xls` and where each sheet connects inside the portal.

**Workbook:** `SPDC_Budget_Arvind 49.xls` · **36 tabs** · **Portal:** `/projects/:id/cost`

---

## 1. Sheet → portal tool

| Excel tab | Portal tab | Route | DB model | Downstream |
|-----------|------------|-------|----------|------------|
| `Budget` | Budget WBS | `?tab=budget` | `CostBudgetLine` | Cashflow header totals |
| `Monitoring *` (14 packages) | BOQ monitoring | `?tab=monitoring` | `CostMonitoringLine` | DPR qty progress · Progress planned vs actual |
| `* MB` (12 packages) | Measurement book | `?tab=mb` | `CostMbLine` | DPR cumulative qty (matched lines) |
| `* BBS` (5 packages) | Bar bending schedule | `?tab=bbs` | `CostBbsLine` | DPR materials → rebar kg consumed |
| `STEEL / CEMENT / Tiles Rate Difference` | Rate difference | `?tab=rates` | `CostRateDifference` | — |
| `Cashflow - Dashboard.xlsx` (separate file) | Chart · Forecast · Tracking | `?tab=cashflow&cf=*` | `CostCashflowPeriod` | DPR header · AC certified |

Package name on each row = **Excel tab suffix** (e.g. tab `DORMITORY BBS` → package `Dormitory BBS`).

---

## 2. BBS — `* BBS` sheets (diagram column)

**Tabs:** `DORMITORY BBS` · `Compound Wall BBS` · `Septic Tank BBS` · `Road BBS` · `UGWT BBS`

Header row (rows 0 / 6 in workbook):

| Col | Excel header | Portal field | UI column |
|-----|--------------|--------------|-----------|
| — | *(sheet tab name)* | `packageName` | Package |
| 0 | SR. NO | `barMark` | SR NO |
| 1 | DESCRIPTION | `location` | Description |
| 2–7 | **SHAPE OF BAR** *(merged — bend diagram drawing)* | `shapeDiagramPath` / `shapeDiagramUrl` | **Shape of bar** ← upload + view here |
| 8 | DIA | `diameterMm` | DIA |
| 9 | NO PER MEMBER | `nosPerMember` | No/member |
| 10 | NO OF MEMBER | `nosOfMember` | No of member |
| 11 | TOTAL NOS OF BARS | `nos` | Total nos |
| 12–16 | SHAPE LENGTH A–E | `shapeLenA`–`shapeLenE` | A–E |
| 17 | Cutting Length | `lengthMm` | Cutting L |
| 18 | Total LENGTH | `totalLength` | Total L |
| 19+ | Dia of Bar (8/10/12/16/20/25 mm) weight | `weightKg` *(computed)* | Weight kg |

**Diagram rule:** In Excel the bend sketch lives in **SHAPE OF BAR** (cols 2–7). In the portal, upload annotated PDF/PNG per row on the BBS tab — file lands in SharePoint `07.06_Method_Statements_and_Temporary_Works/<package>/shapes/` and links back to that row.

**Import:** `POST /api/cost/:projectId/bbs/import` · parser: `apps/api/src/services/costSheetParser.ts`  
**Shape upload:** `POST /api/cost/:projectId/bbs/shape` · UI: `BbsEntryTable` Shape of bar column

**DPR link:** `CostBbsLine.weightKg` summed per discipline package → DPR materials “rebar consumed” (`dprIntegrations.ts`).

---

## 3. MB — `* MB` sheets

**Tabs:** `DORMITORY MB`, `Electric MB`, `Plumbing MB`, `UGWT MB`, `Septic Tank`, `Compound Wall`, `Road & Paving`, `Windows`, `Furniture`, `WPC Door`, `Fire Fighting`, `Fire Alarm`, `Gas Line`, `External Electric`

| Col | Excel header | Portal field |
|-----|--------------|--------------|
| — | sheet tab | `packageName` |
| 0 | SR No. | `srNo` |
| 1 | Description | `description` |
| 2 | No | `nos1` |
| 3 | No | `nos2` |
| 4 | Length | `length` |
| 5 | Width | `width` |
| 6 | Height | `height` |
| 7 | Qty. | `qty` |
| 8 | UoM. | `unit` |

**DPR link:** matched by description → enriches cumulative qty on BOQ lines.

---

## 4. Monitoring — `Monitoring *` sheets

| Col | Excel header | Portal field |
|-----|--------------|--------------|
| — | sheet tab | `packageName` |
| 0 | ITEM NO. | `itemNo` |
| 1 | Item of Work | `description` |
| 2 | UOM | `uom` |
| 3 | RATE | `rate` |
| 4 | BOQ Qty | `boqQty` |
| 5 | Extra Items Qty | `extraQty` |
| 6 | GFC Qty | `gfcQty` |
| 7 | Achieved QTY | `achievedQty` |
| 8–9 | Excess / Saving Qty | `excessQty` / `savingQty` *(computed)* |
| 10 | Certified Qty | `certifiedQty` |
| 11+ | Cost / EV / CPI columns | `boqCost` + UI computed KPIs |

**DPR link:** primary source for quantity progress rows in DPR Maker.

---

## 5. Budget WBS — `Budget` sheet

| Col | Excel header | Portal field |
|-----|--------------|--------------|
| 0 | Sr | `srNo` |
| 1 | Description | `description` |
| 2 | Stakeholder | `stakeholder` |
| 3 | Budgeted Amount | `budgetedAmount` |
| 4 | Work Order Amount | `workOrderAmount` |
| 5 | Certified Amount | `certifiedAmount` |
| 6 | Forecasted | `forecastedAmount` |
| 8 | Non-tendered | `nonTendered` |

---

## 6. Rate difference sheets

| Tab | Material | Portal |
|-----|----------|--------|
| `STEEL RATE DIFFRENCE` | Steel | `CostRateDifference.materialType = Steel` |
| `CEMENT RATE DIFFRENCE` | Cement | `CostRateDifference.materialType = Cement` |
| `Tiles Rate Difference` | Tiles | `CostRateDifference.materialType = Tiles` |

---

## 7. Cashflow (separate workbook)

File: `Cashflow - Dashboard.xlsx` · three views seeded into `CostCashflowPeriod`:

| Sheet / view | Portal chip | `packageName` tag |
|--------------|-------------|-------------------|
| Chart | `?cf=chart` | Cash Flow Chart |
| Forecast | `?cf=forecast` | Cash Flow Forecast |
| Tracking | `?cf=tracking` | Tracking |

---

## 8. SharePoint folders (uploads)

| Kind | ISO folder |
|------|------------|
| BBS Excel import | `07.06…/bbs/<package>/` |
| BBS shape diagram | `07.06…/bbs/<package>/shapes/` |
| MB Excel import | `07.06…/mb/<package>/` |

Module key: `bbs` → `07_EXECUTION_AND_DELIVERY/07.06_Method_Statements_and_Temporary_Works`

---

## 9. Seed & demo

```bash
npm run db:seed          # loads all sheets from seed/data/
npm run db:seed-bbs-shapes  # attaches demo bend SVGs to first BBS rows
```

Parser + seed share the same column indices (`seed/costFromBudget.ts`, `costSheetParser.ts`).

---

## 10. Related docs

- DPR auto-fill from Cost: [DPR_DATA_CONNECTION_MAP.md](./DPR_DATA_CONNECTION_MAP.md)
- Module spec: [modules/MODULE_COST.md](./modules/MODULE_COST.md)
- All client templates: [SHEET_TO_DASHBOARD.md](./SHEET_TO_DASHBOARD.md)
