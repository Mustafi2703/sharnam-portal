# Sharnam Portal — Product IA (locked)

**UI:** Modern Signal — **Blue** (actions) · **Red** (alerts) · **Yellow** (attention) · **White** (surfaces) · **Black** (chrome).  
**Shape:** Top **module** bar · horizontal **sub-tool** chips · right **Actions** only. **No left tools rail.**

## Office Master (after login)

Office / admin: Master + enable/disable modules per project. CRM + HRM feed directory. Site and Office landings stay open.

| Office tool | Purpose |
|-------------|---------|
| Master | Project create, packages, PMC roster, module toggles |
| CRM | Leads → projects + client card |
| HRM | Employee + vendor pool → project Directory |
| Audit / Roles | Who did what; role matrix |

## Project modules → tools

Aligned with `module_prompts/`.

| Module | Tools | Notes |
|--------|-------|-------|
| **Home** | Overview, Directory, Vendors, Documents (DMS) | |
| **Drawings** | GFC, Drawing check master, DMS, Coordination, Request checklist fill, Ask (drawing RFI) | No Submittals. Check master before upload. |
| **Quality** | QI dashboard, Checklist master, Site checklists, Request QI fill | Checklist + RFI visible |
| **Safety** | Dashboard, Safety checklists, Safety RFI | Checklist + RFI visible |
| **Progress** | Overview, Milestones, Planned vs Actual, Monthly, Hindrance, Risk, Legal | One tool per dataset |
| **Field** | Day log, Photos, Field RFIs | |
| **Comms** | Matrix · MoM, Ask (PMC RFI), Email / Outlook | |
| **Cost** | Monitoring, MB, BBS, Budget, Cashflow, Rates, COP/Bills, Structure | One tool at a time |
| **Reports** | DPR / WPR packs | |

Hub route: `/projects/:id/hub/{module}`.

## Gates

1. Project-scoped only  
2. Drawing Check Master unlock before upload  
3. RFI create/respond → email + open badge  
4. Client: view / concerns only  

## Deploy

https://sharnam-portal.onrender.com · Demo@1234  
See `DEPLOY_RENDER.md`, `docs/M365_SETUP.md`.
