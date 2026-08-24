# API modules

Domain logic grouped by portal workspace. Routes stay in `apps/api/src/routes/`; they import from here.

**Full map:** [docs/MODULE_FOLDER_STRUCTURE.md](../../../../docs/MODULE_FOLDER_STRUCTURE.md)

| Module | Status | Route file(s) | Move from `services/` |
|--------|--------|---------------|------------------------|
| [finance](./finance/) | ✅ migrated | `finance.ts` | — |
| [cost](./cost/) | planned | `cost.ts`, `customSheets.ts` | `boqParser`, `costSheetParser`, `costMasterLines`, `costQuantitySync`, `costPackageMap`, `cashflowParser`, `cashflowPvaSync`, `budgetWorkbookImport`, `monitoringMetrics` |
| [dpr](./dpr/) | planned | `dprMaker.ts` | `dprXlsx`, `dprIntegrations`, `dprCharts`, `dprSnapshotExport`, `dprDemoDaySeed` |
| [wpr](./wpr/) | planned | `wprMaker.ts` | `wprXlsx`, `wprPptx`, `wprClientPack`, `wprSeedSections`, `wprDemoSeed` |
| [reports](./reports/) | planned | `reports.ts` | `reportPacks`, `quotationExport`, `proposalTemplate` |
| [drawings](./drawings/) | planned | `projects.ts`, `checklist.ts` | `drawingRegisterSheets`, `drawingUnlock`, `archiveClosedRfiReport`, `rfiEmailFormat`, `rfiFlowNotify` |
| [quality](./quality/) | planned | `checklist.ts`, `procore.ts` | `qapImportExport`, `qualityDashboardSheets`, `qualityChecklistCatalog`, `cubeRegisterImport`, `ncrFormExport`, `ncrNotify` |
| [safety](./safety/) | planned | `checklist.ts`, `procore.ts` | `safetyDashboardSheets`, `hiraRegister` |
| [progress](./progress/) | planned | `progress.ts` | `progressVerify`, `plannedActualDashboard`, `msProjectSchedule` |
| [checklist](./checklist/) | planned | `checklist.ts` | `brandedChecklistHtml`, `brandedChecklistXlsx`, `checklistProgress` |
| [comms](./comms/) | planned | `comms.ts` | `meetingNotify`, `meetingEmailFormat`, `coordinationEscalation` |
| [audit-kpi](./audit-kpi/) | ✅ migrated | `auditKpi.ts` | — |
| [crm](./crm/) | planned | `crmComparative.ts` | `comparativeStatement`, `crmSharePoint` |
| [closure](./closure/) | planned | `closure.ts` | *(route-local today)* |
| [hrms](./hrms/) | planned | `hrmRecruitment.ts` | *(route-local today)* |
| [custom-sheets](./custom-sheets/) | planned | `customSheets.ts` | uses `costMasterLines` → move with cost or duplicate thin wrapper |

**Infra only** (`services/`): `audit`, `graph`, `mockOneDrive`, `email`, `brandedExport`, `logDump`, `packCompleteness`.
