# Checklist module (API)

Branded checklist HTML/XLSX export and fill progress — used by drawings + quality tools.

**Route:** `apps/api/src/routes/checklist.ts`

## Planned layout

```
checklist/
  brandedHtml.ts              ← brandedChecklistHtml.ts
  brandedXlsx.ts              ← brandedChecklistXlsx.ts
  progress.ts                 ← checklistProgress.ts
  index.ts
```

**Web:** `apps/web/src/modules/checklist/` — fill/master/log pages under project + global checklist routes.
