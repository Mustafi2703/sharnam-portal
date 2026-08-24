# Web modules

UI grouped by portal workspace — mirrors `apps/api/src/modules/` and `workspaces.ts` hub keys.

**Full map:** [docs/MODULE_FOLDER_STRUCTURE.md](../../../docs/MODULE_FOLDER_STRUCTURE.md)

## Layout per module

```
modules/<name>/
  index.ts           public exports (pages, components, hooks)
  pages/             route targets (optional — thin re-export in src/pages/ during migration)
  components/        module-only UI
  lib/               module hooks/helpers (optional)
```

## Shared components (stay in `src/components/`)

Register shell used by many modules: `RegisterSheetFrame`, `RegisterSheetCell`, `ReferenceSheetToolbar`, `ui.tsx`, `AppShell`, `ModuleToolNav`.

## Module index

| Folder | Workspace | Pages (current location) | Components to colocate |
|--------|-----------|--------------------------|-------------------------|
| [finance](./finance/) | `finance` | `pages/FinancePage` → `finance/pages/` | ✅ `FinanceBillRegister`, `FinanceDisciplineStrip` |
| [cost](./cost/) | `cost` | `pages/CostPage` | `CostSheetUploadPanel`, `BoqMonitoringEditor`, `BudgetWbsRegister`, BBS/MB tables |
| [drawings](./drawings/) | `drawings` | `project/DrawingsPage`, `DrawingRegisterPage`, `DrawingsLibraryPage`, … | `DrawingsModuleNav`, drawing register/upload/check |
| [quality](./quality/) | `quality` | `project/QapPage`, `InspectionsPage`, `NcrFormPage`, … | `QapDetailRegister`, `CubeRegisterPanel`, inspection panels |
| [safety](./safety/) | `safety` | `project/SafetyPage` | `HiraRegisterTable` |
| [progress](./progress/) | `progress` | `project/ProgressPage` | — |
| [comms](./comms/) | `comms` | `CommsPage`, `DiaryPage`, `project/RfisPage` | `DrawingRfiRegisterTable`, `RfiProgressBar` |
| [audit-kpi](./audit-kpi/) | `auditKpi` | `AuditKpiPage`, `AuditPage` | — |
| [reports](./reports/) | `reports` | `DprMakerPage`, `WprMakerPage`, `ReportsPage` | `ReportExportButtons` |
| [closure](./closure/) | `closure` | `project/ProjectClosurePage` | — |
| [crm](./crm/) | *(office)* | `CrmPage`, bid compare pages, `QuotationMakerPage` | `ComparativeStatementPanel` |
| [hrms](./hrms/) | *(office)* | `HrmPage`, `Hrms*` | `AttendancePunchPanel` |
| [checklist](./checklist/) | cross | `ChecklistPage`, `ChecklistFillPage`, project checklist tools | `DrawingCheckModal`, branded fill |
| [custom-sheets](./custom-sheets/) | *(office)* | `CustomSheetsPage` | — |
| [dms](./dms/) | `dms` | `DmsPage` | — |

## Import convention

```tsx
// Prefer module barrel
import { FinanceBillRegister } from "../modules/finance";

// Pages: thin re-export until all imports updated
// apps/web/src/pages/FinancePage.tsx
export { default } from "../modules/finance/pages/FinancePage";
```

## Vite aliases

Only when web must share API module config (see finance `@sharnam/finance` in `vite.config.ts`).
