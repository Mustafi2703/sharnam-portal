# Client testing & module finalisation pack

Use this folder during **client meetings**, **module walkthroughs**, and **UAT**. Each file maps one portal area: routes, forms, modals, and a **Changes during testing** table per page.

## How to use with Google Docs

**Client-facing (recommended):** Upload **[../client-share/12-Live-Client-UAT-Workbook.md](../client-share/12-Live-Client-UAT-Workbook.md)** to Google Drive → share as **Editor** with SPDC. One live Doc for change log + sign-off + Drawings UAT steps.

**Internal (dev team):**

1. Create a Google Drive folder: `Sharnam Portal — Client UAT`.
2. Optionally mirror `modules/` files for route-level detail.
3. Keep **[01-MEETING-CHANGE-LOG.md](./01-MEETING-CHANGE-LOG.md)** in sync with the client workbook **Section 2**.
4. For each module session, open the matching file under `modules/` and fill the **Changes during testing** tables on the pages you review.
5. When a change is built, mark **Done** in both the client Doc and meeting log; tick **Client sign-off** on that page.

## Recommended test order

| # | Module doc | Session focus |
|---|------------|---------------|
| 1 | [00-home-directory-vendors](./modules/00-home-directory-vendors.md) | Project home, **company vendor directory**, project directory |
| 2 | [01-drawings](./modules/01-drawings.md) | GFC, register, coordination, upload/markup |
| 3 | [02-dms](./modules/02-dms.md) | ISO document manager |
| 4 | [03-quality](./modules/03-quality.md) | Dashboard, SOR, QI, NCR, cube, QAP |
| 5 | [04-safety](./modules/04-safety.md) | Safety sheets, NCR, HIRA |
| 6 | [05-progress](./modules/05-progress.md) | Milestones, hindrance, risk, legal |
| 7 | [06-field](./modules/06-field.md) | Diary, photos, site pilot, attendance |
| 8 | [07-comms](./modules/07-comms.md) | Matrix → agenda → MoM → follow-up |
| 9 | [08-cost](./modules/08-cost.md) | BOQ, MB, BBS, cashflow |
| 10 | [09-finance](./modules/09-finance.md) | CAPEX, PO, RA, COP |
| 11 | [10-reports](./modules/10-reports.md) | DPR/WPR maker + dashboards |
| 12 | [11-closure](./modules/11-closure.md) | Snag, lessons, closure report |
| 13 | [12-global-office](./modules/12-global-office.md) | Master, HRMS, CRM, roles |

Full route index: **[00-MASTER-INDEX.md](./00-MASTER-INDEX.md)**

## Related docs

- Module test checklist (sign-off table): [../client-share/03-Module-Test-Plan.md](../client-share/03-Module-Test-Plan.md)
- Vendor field spec: [../modules/MODULE_DIRECTORY_VENDORS.md](../modules/MODULE_DIRECTORY_VENDORS.md)
- Client requirements: [../CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md)

## Portal entry points

| Role | Login | First stop |
|------|-------|------------|
| Office | `/login/office` | `/master` → create project → `/projects/:id` |
| Site | `/login/site` | Project → Field / Drawings |
| Client | `/login/client` | Project → read-only modules |
| Vendor | `/login/vendor` | RFIs / checklist fills |
