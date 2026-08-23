# Module gap analysis — sheets vs portal (Aug 2026)

This document compares client reference sheets (`module_prompts/Sharnam_modules_docs 2/`, `docs/*.xlsx`) against what is **seeded**, **editable in-app**, and **downloadable in client format**.

## Summary

| Area | Sheets in pack | Portal module | Seeded | Editable rows | Client download |
|------|----------------|---------------|--------|---------------|-----------------|
| Drawings | GFC log, register | Drawings | Partial (demo GFC) | Register yes | Branded checklist |
| Quality | Dashboard, NCR, Cube, QAP, SOR | Quality | Yes | QAP, Cube, SOR | HTML/XLSX checklists |
| Safety | Dashboard, NCR, HIRA, hours | Safety | Yes | Registers | HTML/XLSX |
| Progress | Overview, PvsA, monthly, risk, legal | Progress | Yes | Milestones, hindrance, risk | CSV/PDF planned vs actual |
| Cost | Budget, MB, BBS, Cashflow | Cost | Yes | MB, monitoring, cashflow | CSV per tab |
| Finance | PO, RA, COP, CAPEX | Finance | Demo | Registers | Partial |
| Reports | DPR, WPR | Reports | Live KPIs | DPR/WPR makers | HTML pack; XLSX partial |
| **Audit** | SITE_AUDIT_Pack (6 sheets) | **Audit & KPI** | **Yes (new)** | Findings, checklist, subjects | CSV + XLSX |
| **KPI** | MASTER_KPI (127 subjects) | **Audit & KPI** | **Yes (new)** | Subjects, role KRA | CSV + XLSX |
| CRM | Leads, quotations, comparative | CRM | Demo | Leads, quotes | DOCX quotation |
| HRMS | Recruitment, attendance, payroll | HRM | Demo users | Attendance, leave | Partial |
| Comms | Matrix, MoM, agenda | Comms | Yes | Meetings | Branded export |
| Closure | Snag, lessons, report | Closure | Yes | Snag, lessons | Upload docx |

## Removed: Field module

The standalone **Field** workspace is removed. Capabilities moved:

- Site execution checklists → **Progress** (`progress/checklist-master`, `progress/checklist-logs`)
- Day log, photos, site-pilot → **Comms**
- Attendance punch → global `/attendance` (site sidebar)

## Audit & KPI module (new)

Sources: `docs/SITE_AUDIT_Pack.xlsx`, `docs/MASTER_KPI_DASHBOARD.xlsx`

| Client sheet | Portal tab | Status |
|--------------|------------|--------|
| DASHBOARD | Audit dashboard | Live — RAG + finding pies |
| FINDINGS | Findings | Live — add row, CSV/XLSX |
| SITE_WALK | Site walk | Live — inline edit scores |
| DC_INTERVIEW | DC interview | Live |
| FOLDER_SAMPLE | Folder sample | Live |
| PLAN | — | **Missing** — use Site Audit header + scope notes |
| 00_KPI_DASHBOARD | KPI dashboard | Live — rollup KPIs |
| 03_SUBJECT_DATA | Subject data | Live — 127 rows seeded |
| 06_ROLE_KRA | Role KRA | Live |
| 01_ISO_FOLDER_MAP, 02_ISO_AREA_ROLLUP, 04_TREND, 05_HOW_TO_REFRESH | — | **Missing** — v2 refresh job |

## Still missing (priority)

1. **GFC Drawing Log** — `Approval & GFC Drawing Log.xlsx` not fully seeded; demo drawings only.
2. **DPR client XLSX** — `DPR-Sharnam PMC` template export end-to-end (HTML works; branded XLSX incomplete).
3. **WPR PPT/XLSX** — WPR maker photos/signatures live; full client workbook export partial.
4. **CRM comparative statement** — multi-vendor BOQ compare UI exists at `/crm/bid-compare`; needs full SPDC comparative sheet parity.
5. **HRMS KRA cycles** — Role KRA in Audit/KPI module; employee appraisal cycle in HRMS not wired.
6. **Sheet maker everywhere** — `ReferenceSheetToolbar` added for Audit/KPI; Cost/Progress/Quality need same toolbar pattern.
7. **Portfolio analytics** — multi-project rollup dashboard not built.
8. **Audit PLAN sheet** — dedicated plan tab with auditors/schedule.

## Reference sheet edit pattern

All modules should expose:

- **Add row** — POST to module API
- **Inline edit** — PATCH rows
- **Resync from pack** — re-import from `docs/` xlsx
- **Download** — CSV + XLSX matching client column headers

Implemented today: **Cost** (CSV), **Audit & KPI** (full toolbar), **Custom sheets** (global).

## Hostinger deploy on push to `main`

See [DEPLOY_HOSTINGER_WEBAPP.md](../DEPLOY_HOSTINGER_WEBAPP.md#auto-deploy-on-git-push).

Quick steps:

1. hPanel → **portal.spdc.in** web app → connect GitHub repo `Mustafi2703/sharnam-portal`, branch **`main`**
2. Build: `npm run hostinger:build` · Entry: `server.mjs`
3. First deploy: set env `RUN_SEED=1` · Later: `SKIP_BUILD_SEED=1` for fast redeploys
4. Every **push to main** triggers Hostinger rebuild automatically (no GitHub Actions required for Cloud Web App)

For **VPS** (PM2): use `./scripts/deploy-to-hostinger.sh root@YOUR_IP portal.spdc.in` or add SSH deploy workflow.
