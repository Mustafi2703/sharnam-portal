# Finance module (API)

Viatrix Payment Summary — commercial bill tracking per project.

```
apps/api/src/modules/finance/
  disciplines.ts              Package registry (CIVIL RA, PEB Supply, Fire, …) + hub links
  paymentSummaryWorkbook.ts   Import/export Payment Summary .xlsx
  copWorkbook.ts              Viatrix COP certificate .xlsx + DMS save
  costBridge.ts               Finance ↔ Cost module rollup
  cashflowSync.ts             COP certified amounts → Cost cashflow actuals
  index.ts
```

**Routes:** `apps/api/src/routes/finance.ts`  
**Web:** `apps/web/src/modules/finance/` (imports `disciplines.ts` via `@sharnam/finance`)

```
apps/web/src/modules/finance/
  pages/FinancePage.tsx
  components/FinanceBillRegister.tsx
  components/FinanceDisciplineStrip.tsx
  index.ts
```

Do **not** add finance logic under `apps/api/src/services/` — that folder is for cross-cutting infra only.
