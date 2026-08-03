# Sharnam Portal — Product IA (locked)

**UI:** Modern SAP / Workday — **navy** chrome · **amber** accent · slate canvas (Parikh-style).  
**Shape:** Login → ops dashboard → **Switch module** picker · top module bar · sub-tool chips · right Actions. **No left tools rail. No UI options picker.**

**SRS:** `docs/CLIENT_REQUIREMENTS.md` · **Fields:** `docs/modules/` · **HLD/LLD:** `docs/system-design/`

## Office Master (after login)

Office / admin: Master + enable/disable modules per project. **Access** (`/roles`) allocates who can see / do what.

| Office tool | Purpose | Status |
|-------------|---------|--------|
| Master | Project create, packages, PMC roster, module toggles, Directory (4 users) | Built |
| **CRM** | Leads · orgs · quotation · comparative bid → project | In scope (MVP exists; deepen) |
| **HRMS** | Recruit → onboard → geo attendance → leave → diary → payslips → KRA | In scope (MVP exists; deepen) |
| **Sheet Maker** | Custom sheet / meeting templates | In scope |
| **Site Audit** | Plan, walk, findings | In scope |
| **KPI / KRA** | ISO subject dashboard + role KRA | In scope |
| Audit trail / Roles | Who did what; role matrix | Built |

## Project modules → tools

Sheet → dashboard map: `docs/SHEET_TO_DASHBOARD.md`.

| Module | Tools | Notes |
|--------|-------|-------|
| **Home** | Overview, Directory (Office/Site/Client/Contractor), Vendors, Documents | |
| **Drawings** | GFC, Checklist manager, DMS, Coordination, Request checklist fill, **Request for Information** | No Submittals. Check window before upload. |
| **Quality** | QI dashboard, **NCR / CAR**, **Cube register**, Checklist master, **QAP**, Site checklists, **Request for Inspection** | |
| **Safety** | Dashboard, **Safety NCR**, Safety checklists, **Request for Inspection** | |
| **Progress** | Overview, Milestones, Planned vs Actual, Monthly, Hindrance, Risk, Legal | Client civil visible |
| **Field** | Day log, Photos, Field requests | ≠ HRMS personal diary |
| **Comms** | Matrix · Agenda · MoM · Follow-up · Ask (Information) · Email / Outlook | Generated docs → Client |
| **Cost** | Monitoring, MB, BBS, Budget, **Cashflow Chart / Forecast / Tracking**, Rates, COP/Bills, Structure | Engineering — **not** Finance |
| **Finance** | Overview, Invoice, PO, RA bill, COP | Shell now; field detail later |
| **Reports** | **DPR** · **WPR** (separate tools) | PDFs on client civil side |
| **Assurance** (optional hub) | Site Audit · KPI dashboard | May live under Master or project hub |

**PDF:** upload supported; in-app **viewable** (min. summary schedule, procurement plan, generated civil/meeting PDF).

**Future only:** Snag list · Project closure · Finance field-level · Full statutory payroll. See `docs/ROADMAP_DISCUSS_LATER.md`.

Hub route: `/projects/:id/hub/{module}`.

## Gates

1. Project-scoped only  
2. Drawing Check Master unlock before upload  
3. Request create/respond → email + open badge  
4. Client: view / concerns; Quality/Safety checklist create where enabled  
5. Shared Excel templates become portal dashboards  
6. Information vs Inspection labels correct in UI  

## Deploy

https://sharnam-portal.onrender.com · Demo@1234  
See `DEPLOY_RENDER.md`, `docs/M365_SETUP.md`.
