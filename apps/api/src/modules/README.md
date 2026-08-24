# API modules

Domain logic grouped by portal workspace. Routes stay in `apps/api/src/routes/`; they import from here.

**Full map:** [docs/MODULE_FOLDER_STRUCTURE.md](../../../../docs/MODULE_FOLDER_STRUCTURE.md)

| Module | Status | Route file(s) | Move from `services/` |
|--------|--------|---------------|------------------------|
| [finance](./finance/) | ✅ migrated | `finance.ts` | — |
| [audit-kpi](./audit-kpi/) | ✅ migrated | `auditKpi.ts` | — |
| [cost](./cost/) | ✅ barrel + roles (physical move pending) | `cost.ts`, `customSheets.ts` | `boqParser`, `costSheetParser`, … |
| [quality](./quality/) | ✅ barrel + roles | `checklist.ts`, `procore.ts` | `qapImportExport`, `qualityDashboardSheets`, … |
| [safety](./safety/) | ✅ barrel + roles | `checklist.ts`, `procore.ts` | `safetyDashboardSheets`, `hiraRegister` |
| [drawings](./drawings/) | ✅ barrel + roles | `projects.ts`, `checklist.ts` | `drawingRegisterSheets`, … |
| [progress](./progress/) | ✅ barrel + roles | `progress.ts` | `progressVerify`, … |
| [dpr](./dpr/) | ✅ barrel + roles | `dprMaker.ts` | `dprXlsx`, … |
| [wpr](./wpr/) | ✅ barrel + roles | `wprMaker.ts` | `wprXlsx`, … |
| [reports](./reports/) | ✅ barrel + roles | `reports.ts` | `reportPacks`, … |
| [checklist](./checklist/) | ✅ barrel + roles | `checklist.ts` | `brandedChecklistHtml`, … |
| [comms](./comms/) | ✅ barrel + roles | `comms.ts` | `meetingNotify`, … |
| [crm](./crm/) | ✅ barrel + roles | `crmComparative.ts` | `comparativeStatement`, … |
| [closure](./closure/) | ✅ roles + manifest | `closure.ts` | *(route-local today)* |
| [hrms](./hrms/) | ✅ roles + manifest | `hrmRecruitment.ts` | *(route-local today)* |
| [custom-sheets](./custom-sheets/) | ✅ roles + manifest | `customSheets.ts` | uses cost services |
| [dms](./dms/) | ✅ roles + manifest | `graph.ts`, `projects.ts` | *(graph infra)* |

**Master barrel:** [`index.ts`](./index.ts) — `import { cost } from "../modules"` or `requireModuleView` from `_shared/guards`.

**Registry:** `packages/shared/src/moduleRegistry.ts` lists every module's API files, web pages, components, and `permissionModule`.

**Infra only** (`services/`): `audit`, `graph`, `mockOneDrive`, `email`, `brandedExport`, `logDump`, `packCompleteness`.
