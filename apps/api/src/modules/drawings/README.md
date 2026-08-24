# Drawings module (API)

GFC register, master drawing register, RFI email/flow, drawing unlock tokens.

**Routes:** `projects.ts`, `checklist.ts` (drawing-specific endpoints)

## Planned layout

```
drawings/
  registerWorkbook.ts         ← drawingRegisterSheets.ts
  unlockTokens.ts             ← drawingUnlock.ts
  rfiArchive.ts               ← archiveClosedRfiReport.ts
  rfiEmailFormat.ts
  rfiFlowNotify.ts
  index.ts
```

**Web:** `apps/web/src/modules/drawings/` — drawing pages + `DrawingsModuleNav`, register tables, upload/check modals.
