# Module folder structure (API + Web)

Canonical layout for every portal module. **Finance** is the reference implementation; other modules migrate from flat `pages/` and `services/` without changing routes or URLs.

## Principles

1. **`apps/api/src/modules/<module>/`** — domain logic (parsers, workbook import/export, rollups, module-specific rules).
2. **`apps/api/src/routes/<module>.ts`** — thin HTTP layer: auth, validation, Prisma, audit; imports from `modules/`.
3. **`apps/api/src/services/`** — cross-cutting infra only (Graph, audit, email, mockOneDrive, generic branded export).
4. **`apps/web/src/modules/<module>/`** — module UI (components, hooks, pages); hub routes stay the same via thin re-exports in `pages/` if needed.
5. **`packages/shared`** — roles, permissions, sheet formula engine only. **No** module business rules.

## Target tree

```
apps/api/src/
  modules/
    README.md
    finance/          ✅ migrated
    cost/
    dpr/
    wpr/
    reports/
    drawings/
    quality/
    safety/
    progress/
    checklist/
    comms/
    audit-kpi/
    crm/
    closure/
    hrms/
    custom-sheets/
  routes/             one file per API surface (unchanged URLs)
  services/           infra only — see services/README.md

apps/web/src/
  modules/
    README.md
    finance/          ✅ components + pages
    cost/
    drawings/
    quality/
    …                 (mirror workspace keys)
  pages/              thin re-exports during migration; global shell pages stay here
  components/         shared UI only (RegisterSheetFrame, ui.tsx, AppShell)
  workspaces.ts       MODULE_TOOLS — source of hub IA
```

## Workspace → module map

| Workspace (`workspaces.ts`) | API module | API route(s) | Web pages (today) |
|-----------------------------|------------|--------------|-------------------|
| `drawings` | `drawings` | `projects.ts`, `checklist.ts` | `DrawingsPage`, `DrawingRegisterPage`, `DrawingsLibraryPage`, … |
| `dms` | *(graph infra)* | `graph.ts`, `projects.ts` | `DmsPage` |
| `quality` | `quality` | `checklist.ts`, `procore.ts` | `QapPage`, `InspectionsPage`, `NcrFormPage`, `InspectionRegisterPage` |
| `safety` | `safety` | `checklist.ts`, `procore.ts` | `SafetyPage` |
| `inspection` | `quality` + `safety` | same | same |
| `progress` | `progress` | `progress.ts` | `ProgressPage` |
| `comms` | `comms` | `comms.ts` | `CommsPage`, `RfisPage`, `DiaryPage` |
| `auditKpi` | `audit-kpi` | `auditKpi.ts` | `AuditKpiPage`, `AuditPage` |
| `cost` | `cost` | `cost.ts`, `customSheets.ts` | `CostPage` |
| `finance` | `finance` | `finance.ts` | `FinancePage` |
| `reports` | `dpr`, `wpr`, `reports` | `dprMaker.ts`, `wprMaker.ts`, `reports.ts` | `DprMakerPage`, `WprMakerPage`, `ReportsPage` |
| `closure` | `closure` | `closure.ts` | `ProjectClosurePage` |
| *(office)* CRM | `crm` | `crmComparative.ts` | `CrmPage`, `CrmBidComparePage`, … |
| *(office)* HRMS | `hrms` | `hrmRecruitment.ts` | `HrmPage`, `Hrms*` |
| *(office)* Sheet maker | `custom-sheets` | `customSheets.ts` | `CustomSheetsPage` |
| Checklists (cross) | `checklist` | `checklist.ts` | `ChecklistPage`, `ChecklistFillPage`, drawing checklist tools |

## File naming inside a module

| Pattern | Example | Use for |
|---------|---------|---------|
| `*Workbook.ts` | `paymentSummaryWorkbook.ts` | XLSX import/export |
| `*Parser.ts` | `boqParser.ts` | Upload parse |
| `*Register.ts` | `hiraRegister.ts` | Register CRUD / sync |
| `*Sync.ts` | `cashflowSync.ts` | Cross-module rollup |
| `*Bridge.ts` | `costBridge.ts` | Read/write another module’s data |
| `disciplines.ts` / `catalog.ts` | package or checklist registry | Shared config (web may import via Vite alias) |
| `index.ts` | barrel export | Public module API |

Avoid flat prefixes like `financePaymentSummary.ts` — use folder + descriptive name.

## Migration status

| Module | API `modules/` | Web `modules/` |
|--------|----------------|----------------|
| Finance | ✅ live (`roles`, `manifest`, domain files) | ✅ live (pages + components) |
| Audit-KPI | ✅ live | ✅ index + roles |
| Cost | ✅ barrel + roles + manifest (services re-export) | ✅ index + roles |
| Quality / Safety / Drawings / Progress | ✅ index + roles + manifest + service re-exports | ✅ index + roles |
| DPR / WPR / Reports / Comms / CRM / Checklist / Closure / HRMS / Custom-sheets / DMS | ✅ index + roles + manifest | ✅ index + roles |

**Canonical registry:** `packages/shared/src/moduleRegistry.ts` — backend files, frontend files, routes, permission module per portal module.

**Role helpers:** `packages/shared/src/moduleRoles.ts` — `createModuleRoleHelpers()` used by API `modules/*/roles.ts` and web `modules/*/roles.ts`.

**API guards:** `apps/api/src/modules/_shared/guards.ts` — `requireModuleView("cost")` etc.

**Web access:** `apps/web/src/lib/moduleAccess.ts` — `canAccessModule(role, "quality")`.

**How to migrate one module**

1. Move `services/<domain>*.ts` → `modules/<name>/` with clear names.
2. Update route imports to `../modules/<name>/…`.
3. Move page + module-specific components → `web/src/modules/<name>/`.
4. Leave `pages/FooPage.tsx` as `export { default } from "../modules/<name>/pages/FooPage"`.
5. Delete old service files (no long-lived shims).
6. Run `npm run build`.

## Vite / TS aliases (optional per module)

Finance shares `disciplines.ts` with the web app:

```ts
// apps/web/vite.config.ts
"@sharnam/finance": path.resolve(__dirname, "../api/src/modules/finance")
```

Add `@sharnam/<module>` only when web needs the same constants/types as API (same pattern as finance).

## What stays in `services/`

| File | Reason |
|------|--------|
| `audit.ts` | All modules |
| `graph.ts`, `mockOneDrive.ts`, `email.ts` | M365 / DMS infra |
| `brandedExport.ts` | Generic XLSX shell |
| `logDump.ts`, `packCompleteness.ts` | Debug / ops |

See [apps/api/src/services/README.md](../apps/api/src/services/README.md).

## Related docs

- Module field specs: [docs/modules/README.md](./modules/README.md)
- Finance reference: [apps/api/src/modules/finance/README.md](../apps/api/src/modules/finance/README.md)
- Hub tool definitions: [apps/web/src/workspaces.ts](../apps/web/src/workspaces.ts)
