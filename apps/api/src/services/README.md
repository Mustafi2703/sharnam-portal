# API services layout

## `services/` — cross-cutting infrastructure only

Shared by many modules. **Not** domain/business logic.

| File | Purpose |
|------|---------|
| `audit.ts` | Audit log writes |
| `mockOneDrive.ts` | SharePoint / DMS upload mock |
| `graph.ts` | Microsoft Graph / ISO folder map |
| `email.ts` | Outbound mail |
| `brandedExport.ts` | Generic branded XLSX builder |
| `brandedChecklistHtml.ts` / `brandedChecklistXlsx.ts` | Checklist exports |

## `modules/<name>/` — domain logic by portal module

| Module | Path | Examples |
|--------|------|----------|
| Finance | `modules/finance/` ✅ | Payment Summary workbook, COP export, cost bridge |
| Cost | `modules/cost/` | BOQ/MB/BBS parsers — see module README |
| DPR / WPR / Reports | `modules/dpr/`, `wpr/`, `reports/` | DPR/WPR XLSX, report packs |
| Drawings / Quality / Safety / Progress | respective folders | Register sheets, QAP, HIRA, MS Project |
| Comms / CRM / Audit-KPI / … | respective folders | See [modules/README.md](../modules/README.md) |

Full map: [docs/MODULE_FOLDER_STRUCTURE.md](../../../../docs/MODULE_FOLDER_STRUCTURE.md)

When adding features, put code in the matching **`modules/<name>/`** folder with a clear filename (`paymentSummaryWorkbook.ts`, not `financePaymentSummary.ts`).

Legacy flat names in `services/` will move module-by-module without breaking routes.
