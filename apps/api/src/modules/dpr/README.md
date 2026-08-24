# DPR module (API)

Daily Progress Report — XLSX generation, auto-fill from progress/cost, charts, snapshot HTML.

**Route:** `apps/api/src/routes/dprMaker.ts`

## Planned layout

```
dpr/
  dprWorkbook.ts              ← dprXlsx.ts
  dprIntegrations.ts
  dprCharts.ts
  dprSnapshotExport.ts
  dprDemoDaySeed.ts           optional demo only
  index.ts
```

**Web:** `apps/web/src/modules/reports/pages/DprMakerPage.tsx`
