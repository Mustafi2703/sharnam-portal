# Quality module (API)

QAP import/export, quality dashboard sheets, cube register, NCR export/notify, checklist catalog.

**Routes:** `checklist.ts`, `procore.ts`

## Planned layout

```
quality/
  qapWorkbook.ts              ← qapImportExport.ts
  dashboardSheets.ts          ← qualityDashboardSheets.ts
  checklistCatalog.ts         ← qualityChecklistCatalog.ts
  cubeRegisterImport.ts
  ncrFormExport.ts
  ncrNotify.ts
  index.ts
```

**Web:** `apps/web/src/modules/quality/` — QAP, inspections, NCR, cube register components.
