# Cost module (API)

Engineering cost: BOQ, MB, BBS, cashflow, budget workbook, monitoring.

**Route:** `apps/api/src/routes/cost.ts`, `customSheets.ts` (master lines)

## Planned layout

```
cost/
  boqParser.ts
  costSheetParser.ts          MB + BBS parse
  costMasterLines.ts
  costQuantitySync.ts
  costPackageMap.ts
  cashflowParser.ts
  cashflowPvaSync.ts
  budgetWorkbookImport.ts
  monitoringMetrics.ts
  index.ts
```

**Web:** `apps/web/src/modules/cost/` — `CostPage`, `CostSheetUploadPanel`, `BoqMonitoringEditor`, `BudgetWbsRegister`, BBS/MB tables.

**Finance bridge:** `modules/finance/costBridge.ts` reads cost rollups.
