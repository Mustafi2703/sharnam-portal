# Sharnam Portal — Product IA (locked)

**UI:** Modern Signal — **Blue** (actions) · **Red** (alerts) · **Yellow** (attention) · **White** (surfaces) · **Black** (chrome).  
**Shape:** Top **module** bar · horizontal **sub-tool** chips · right **Actions** only. **No left tools rail.**  
**Login:** Ops dashboard (open RFIs / alerts) → module selection.

## Office Master (after login)

Office / admin: Master + enable/disable modules per project. **CRM (leads)** and **HRMS** are linked but **to be discussed** in detail. Site and Office landings stay open.

| Office tool | Purpose | Status |
|-------------|---------|--------|
| Master | Project create, packages, PMC roster, module toggles, Directory (4 users) | Build |
| CRM | Lead management → projects + client card | Discuss later |
| HRM / HRMS | Employee + vendor pool → project Directory | Discuss later |
| Audit / Roles | Who did what; role matrix | Build |

## Project modules → tools

Aligned with `docs/CLIENT_REQUIREMENTS.md` and `module_prompts/`. Sheet → dashboard map: `docs/SHEET_TO_DASHBOARD.md`.

| Module | Tools | Notes |
|--------|-------|-------|
| **Home** | Overview, Directory (Office/Site/Client/Contractor), Vendors, Documents | |
| **Drawings** | GFC, Checklist manager, DMS, Coordination, Request checklist fill, Ask | No Submittals. Check window before upload. |
| **Quality** | QI dashboard, Checklist master (Excel upload + choose), **QAP**, Site checklists, Request QI fill | Checklist + RFI + QAP |
| **Safety** | Dashboard, Safety checklists (Excel upload + choose), Safety RFI | Checklist + RFI |
| **Progress** | Overview, Milestones, Planned vs Actual, Monthly, Hindrance, Risk, Legal | One tool per shared sheet |
| **Field** | Day log, Photos, Field RFIs | |
| **Comms** | Matrix · MoM, Ask (PMC RFI), Email / Outlook | |
| **Cost** | Monitoring, MB, BBS, Budget, Cashflow, Rates, Structure | Engineering cost — **not** commercial finance |
| **Finance** | Overview, Invoice, PO, RA bill, COP | **Separate from Cost**; shell now, detail later |
| **Reports** | DPR / WPR packs | |

**Discuss later:** Snag list · Project closure · CRM detail · HRMS detail · Finance field-level. See `docs/ROADMAP_DISCUSS_LATER.md`.

Hub route: `/projects/:id/hub/{module}`.

## Gates

1. Project-scoped only  
2. Drawing Check Master unlock before upload  
3. RFI create/respond → email + open badge  
4. Client: view / concerns; Quality/Safety checklist create where enabled  
5. Shared Excel templates become portal dashboards  

## Deploy

https://sharnam-portal.onrender.com · Demo@1234  
See `DEPLOY_RENDER.md`, `docs/M365_SETUP.md`.
