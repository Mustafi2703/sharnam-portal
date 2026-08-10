# Sharnam Portal — Client Requirements (shareable)

**Product:** Sharnam PMC Portal (शरणम्)  
**Version:** 2.0 · 10 Aug 2026  
**Live demo:** https://sharnam-portal.onrender.com  
**Audience:** Sharnam office, site, client, contractor, employees  
**Plain-language updates:** [CLIENT_LATEST_UPDATES.md](./CLIENT_LATEST_UPDATES.md)  
**SharePoint / IT env vars:** [SHAREPOINT_RENDER_ENV.md](./SHAREPOINT_RENDER_ENV.md)

This document is the **requirements baseline** for module finalization and sign-off.  
**Design detail (HLD/LLD):** [system-design/](./system-design/) · **Module field specs:** [modules/](./modules/)

---

## 0. Executive summary (non-technical)

The portal is the **single place** for one construction project: drawings, quality, safety, site logs, meetings, cost/cashflow, reports, and people (HRMS). Excel sheets you already use become **live dashboards** — the portal is the system of record, not a download-only tool.

| Principle | What it means for SPDC |
|-----------|------------------------|
| **One project spine** | Office, site, contractor, and client see the same project data — each role sees only what they need |
| **Four login doors** | Office · Site · Contractor · Client — separate URLs, same brand |
| **Drawings ≠ Documents** | GFC revision control is separate from general document storage (DMS) |
| **Information ≠ Inspection** | “Ask” on drawings is not the same as “Request for Inspection” on quality/safety |
| **Cost ≠ Finance** | Engineering BOQ/cashflow/MB is not commercial invoice/PO/RA tracking |
| **Site attendance** | Selfie + GPS + **IST time** → SharePoint evidence folder |
| **SharePoint live** | Files upload to `SharnamProjects` when Render env is set (`MOCK_ONEDRIVE=false`) |

---

## 1. Users

| User | Who | Primary use |
|------|-----|-------------|
| **Sharnam Office** | PMC / admin / office / HR | Master setup, modules on/off, Directory, CRM, HRMS, Comms, Cost, Finance, Reports, Audit, KPI |
| **Site** | Site engineer / site staff | Day log, photos, checklist fills, QI/Safety, Field requests, geo attendance where assigned |
| **Client** | Owner / client stakeholder | Civil-side: schedule / S-curve / progress, procurement, generated docs & PDFs, published drawings, concerns, DPR/WPR; QI/Safety checklist create where allowed |
| **Contractor** | Main contractor / vendor | Fill assigned checklists / inspections, photos, bills where allowed |
| **Employee** | Sharnam staff (self-service) | Attendance punch, leave, personal diary, payslips, training, policy acknowledgement |

**Project Directory** lists four party tools: **Office · Site · Client · Contractor**.  
HRMS employees feed the PMC roster and Office/Site directory assignments.

---

## 2. Login experience (required)

| Step | Requirement | Status |
|------|-------------|--------|
| Hub | `/login` — centred **शरणम्** logo + four portal tiles | Live |
| Per portal | `/login/office` · `/login/site` · `/login/vendor` · `/login/client` | Live |
| Portal page layout | Large logo left; minimal sign-in card right; hero photo visible | Live Aug 2026 |
| After sign-in | Ops dashboard → enabled modules for project | Live |
| Navigation | Module hub → sub-tools → page actions (no deep left rail) | Live |

Demo accounts: `office@sharnam.demo` · `site@sharnam.demo` · `vendor@sharnam.demo` · `client@sharnam.demo` — password `Demo@1234`.  
Site login lands on **Attendance** (`/attendance`).

---

## 3. Sheet data → live dashboards (required)

Every Excel register / dashboard the client shared must become a **portal dashboard or tool** (not download-only). Source sheets are templates; the portal is the system of record.

| Client sheet / pack | Lives as portal |
|---------------------|-----------------|
| Approval & GFC Drawing Log | Drawings → GFC register |
| Communication Matrix (BPCL) | Comms → Matrix |
| Quality Assurance Plan (QAP Week 50) | Quality → **QAP** |
| NCR / Quality registers | Quality → QI / NCR |
| Safety NCR | Safety → Safety dashboard |
| Progress packs | Progress → matching tools |
| Cashflow Dashboard | Cost → Cashflow |
| Payment Summary | Finance → Invoice / RA / COP |
| DPR / WPR packs | Reports → DPR / WPR |
| Cube register | Quality checklists / registers |
| Project summary schedule | Progress → Summary schedule + client civil |
| MS Project file / export | Progress → S-curve + MS Project progress |
| Procurement plan | Progress → Procurement plan |
| Custom meeting sheet templates | **Sheet Maker** → Comms meetings |
| **SITE_AUDIT_Pack.xlsx** | **Site Audit** tools |
| **MASTER_KPI_DASHBOARD.xlsx** | **KPI / KRA** dashboard |
| Comparative Statement R2 | CRM → Comparative statement |
| SPDC PMC Proposal (DOCX) | CRM → Quotation template |

Full map: [SHEET_TO_DASHBOARD.md](./SHEET_TO_DASHBOARD.md)

---

## 3A. Client civil-side requirements

Visible to **Client** (read-first; Office uploads / syncs):

| # | Requirement | Where |
|---|-------------|--------|
| 1 | S-curve from MS Project (or export until sync) | Progress → S-curve |
| 2 | Project summary schedule | Progress → Summary schedule |
| 3 | MS Project progress | Progress → MS Project progress |
| 4 | Generated documents (Agenda, MoM, DPR/WPR, meeting sheets) | Client civil / Reports / Comms |
| 5 | Procurement plan | Progress → Procurement plan |
| 6 | PDF upload + **in-app view** | DMS / attachments |
| 7 | Three key PDF packs viewable | Summary schedule · Procurement · Generated civil/meeting PDF |

---

## 3B. Request naming (locked)

| Surface | Term | Meaning |
|---------|------|---------|
| Drawings / PMC Ask | **Request for Information** | Clarification / information only |
| Quality / Safety | **Request for Inspection** | Inspect / fill QI or safety checklist |
| Field | Field request | Operational; kind stored explicitly |

---

## 4. Module requirements

### 4.1 Master (office)

| Tool | Requirement | Status |
|------|-------------|--------|
| Projects | Create / edit, packages, enable/disable modules | Built |
| Directory | Four party tools: Office, Site, Client, Contractor | Built |
| PMC roster | People pool → assign into project | Built |
| Docs | Master / project document links | Built |
| Matrix seed | Meeting + request communication matrix | Built |
| **CRM** | Leads, orgs, quotation, bid compare → project | **In scope** — see §4.13 + [modules/MODULE_CRM.md](./modules/MODULE_CRM.md) |
| **HRMS** | Full people lifecycle → Directory | **In scope** — see §4.14 + [modules/MODULE_HRMS.md](./modules/MODULE_HRMS.md) |
| **Sheet Maker** | Custom sheet / meeting templates | **In scope** — [modules/MODULE_SHEET_MAKER.md](./modules/MODULE_SHEET_MAKER.md) |
| **Site Audit** | Audit pack tools | **In scope** — [modules/MODULE_AUDIT_KPI.md](./modules/MODULE_AUDIT_KPI.md) |
| **KPI / KRA** | Master KPI dashboard + role KRA | **In scope** — same |
| Audit trail / Roles | Who did what; permission matrix | Built |

### 4.2 Home (project)

Overview, Directory (4 types), Vendors, Documents (DMS).

### 4.3 Drawings

| Tool | Requirement |
|------|-------------|
| GFC register | Drawing log R0–R5, publish, view |
| Checklist manager | Drawing Check Master; unlock before upload |
| Upload flow | Separate window / modal for checklist fill → unlock → revision |
| Documents (DMS) | Folders under Drawings |
| Coordination | Design issues → escalate to Ask |
| Request checklist fill | Matrix / contractor fill |
| **Ask — Request for Information** | Clarification **only** (not inspection) |
| Submittals | **Out of scope for now** |

### 4.4 Quality

| Tool | Requirement |
|------|-------------|
| QI dashboard | Quality inspections |
| Checklist master | Create; **upload Excel**; choose template for fills |
| QAP | Upload / update; always available |
| Site checklists | Assign and fill |
| NCR / cube / assurance | Dashboards matching shared sheets |
| **Request for Inspection** | Request QI / checklist inspection fill |

Office, Site, and **Client** (where enabled) can create / upload checklist Excel; Contractor fills assigned forms.

### 4.5 Safety

| Tool | Requirement |
|------|-------------|
| Safety dashboard | Observations, incidents, open items |
| Safety checklists | Excel upload + choose template |
| **Request for Inspection** | Safety checklist / inspection request |

### 4.6 Progress

| Tool | Requirement |
|------|-------------|
| Overview | Progress KPIs |
| Milestones | Milestone register |
| Planned vs Actual / **S-curve** | MS Project file/sync or Excel |
| **Project summary schedule** | Shared file + PDF; client-visible |
| **MS Project progress** | Task / %; client-visible |
| **Procurement plan** | Register + PDF; client-visible |
| Monthly | Month-by-month |
| Hindrance / Risk / Legal | Matching shared sheets |

### 4.7 Field

Day log, Photos, Field requests.  
**Personal diary** lives in HRMS (employee-owned) — **not** the same as project day log.

### 4.8 Comms

| Tool | Requirement |
|------|-------------|
| Matrix | Meeting + request parties |
| Meeting → Agenda → MoM → Follow-up | Standard flow |
| **Microsoft Teams only** | Meeting links via Graph when live |
| **Sheet Maker templates** | Bind custom sheet to meeting |
| Ask | Request for Information (PMC) |
| Email / Outlook | Outbox + Graph send when live |
| Generated docs → Client | MoM / agenda / meeting PDFs on civil side |

### 4.9 Cost (engineering — not commercial finance)

Monitoring, MB, BBS, Budget WBS, **Cashflow (three tools)**, rate difference, BOQ structure upload. **Separate from Finance.**

#### Cashflow — client Excel → three portal tools

Your shared **Cashflow Dashboard** workbook must not collapse into one screen. The portal mirrors three distinct views:

| Portal tool | Route | Purpose | Source sheet pattern |
|-------------|-------|---------|----------------------|
| **Cash Flow Chart** | Cost → Cashflow → Chart | Visual month-wise planned vs actual | Dashboard · Chart |
| **Cash Flow Forecast** | Cost → Cashflow → Forecast | Forward projection by period | Dashboard · Forecast |
| **Cashflow Tracking** | Cost → Cashflow → Tracking | Line-level follow-up vs packages | Dashboard · Tracking |

| Rule | Detail |
|------|--------|
| Package filter | Multiple BOQs per project → filter chips on all cost registers |
| GFC qty | Monitoring lines use published drawing quantities where applicable |
| Finance boundary | Invoices, PO, RA, COP live under **Finance** module — not Cost |

See [modules/MODULE_COST.md](./modules/MODULE_COST.md).

### 4.10 Finance (commercial tracking)

Shell tools live; field-level detail phased.

| Tool | Baseline |
|------|----------|
| Overview | Finance desk |
| Invoice tracking | Raised / received / status |
| PO tracking | PO vs delivery / billing |
| RA bill tracking | Running account bills |
| COP tracking | Certificates of payment |

See [MODULE_FINANCE.md](./MODULE_FINANCE.md).

### 4.11 Reports

DPR / WPR from live registers. Generated PDFs viewable on **client civil** side.

### 4.12 Documents / PDF (cross-module)

| Requirement | Detail |
|-------------|--------|
| PDF upload | DMS and module attachments |
| In-app PDF view | Not download-only |
| Three civil packs | Summary schedule · Procurement · Generated civil/meeting PDF |

### 4.13 CRM — Lead, quotation & bid (office)

**CRM is pre-project commercial work** (not project delivery). Office-only for commercial data.

| Capability | Requirement |
|------------|-------------|
| Lead pipeline | Stages: New → Qualified → Proposal → Negotiation → Converted / Lost (optional BidSubmitted) |
| Linked organisation search | Search/reuse client by name or GST; avoid duplicates |
| Client card | Org, contact, email, phone, address, GST, design consultant, contractor, location |
| Quotation | Editable proposal from **SPDC PMC proposal format** → DOCX/PDF; confidential |
| Bid documents | Upload tender / clarifications for the opportunity |
| Vendors & contacts | Maintain vendors; link to bid |
| Comparative statement | Multi-vendor BOQ rate compare + section/grand totals (Comparative Statement R2 pattern) |
| Award | Select winning vendor |
| Convert | Create project + client card + optional ProjectVendor from award; attach quotation PDF |

**Fields:** [modules/MODULE_CRM.md](./modules/MODULE_CRM.md) · **LLD:** [system-design/03-LLD-CRM.md](./system-design/03-LLD-CRM.md)

### 4.14 HRMS — People lifecycle (office + employee)

| Capability | Requirement |
|------------|-------------|
| Recruitment & interview | Requisition → posting metadata → resume DB → screen → shortlist → Teams interview → feedback/scorecard → selection → salary → offer approval → offer letter → acceptance → joining confirmation |
| Pre-joining | Documents, BGV, medical (if any), emp code, appointment letter, IT asset, email ID, ID card, welcome kit |
| Onboarding | PII, bank, PAN/Aadhaar, PF/ESIC, nominee, doc verify, dept, reporting manager, orientation, policy ack |
| Employee directory | DOJ, profile, assign to project Directory |
| Attendance | **Geofence + geotag + selfie** for assigned site; **times in IST**; photos to SharePoint `…/Attendance/`; HR override audited |
| Leave | Requests + approvals; **Leave Type master** (HR add/edit); **Holiday master** |
| Personal diary | Daily employee diary stored in HRMS (≠ Field day log) |
| Compensation & payslips | Compensation master + **payslip PDF** upload/view (**v1:** no full PF/ESIC calc engine) |
| Training & KRA | Training records; employee KPI/KRA scorecards from Master KPI role templates |
| Masters | Departments/designations, leave types, holidays, geofences, policies, letter templates |

**Fields:** [modules/MODULE_HRMS.md](./modules/MODULE_HRMS.md) · **LLD:** [system-design/02-LLD-HRMS.md](./system-design/02-LLD-HRMS.md)

### 4.15 Site Audit & Master KPI / KRA

| Capability | Requirement |
|------------|-------------|
| Site Audit | Dashboard, Plan, DC Interview, Site Walk, Folder Sample, Findings (+ CAPA) from SITE_AUDIT_Pack |
| Master KPI | ISO area rollup, subject RAG, document-control health from MASTER_KPI_DASHBOARD |
| Role KRA | Templates (e.g. Project Manager, Document Controller) used in HRMS appraisals |
| Refresh | Recompute subject open/closed/overdue / RAG |

**Fields:** [modules/MODULE_AUDIT_KPI.md](./modules/MODULE_AUDIT_KPI.md)

### 4.16 Sheet Maker

Office creates reusable sheet templates (sections, columns, party blocks), publishes versions, imports/exports Excel, binds templates to **meetings** (and optionally HR/CRM/Audit registers).

**Fields:** [modules/MODULE_SHEET_MAKER.md](./modules/MODULE_SHEET_MAKER.md)

---

## 5. Microsoft 365 & SharePoint

| Item | Requirement | Status |
|------|-------------|--------|
| App registration | Sharnam Portal app in Microsoft Entra (admin consent) | Required |
| SharePoint site | `https://spdcsmb.sharepoint.com/sites/SharnamProjects` | **Live on Render** |
| Render env | `AZURE_*` + `SHAREPOINT_SITE_URL` + `MOCK_ONEDRIVE=false` | See [SHAREPOINT_RENDER_ENV.md](./SHAREPOINT_RENDER_ENV.md) |
| Upload proof | Attendance / DMS / drawings return `provider: sharepoint` | Verify after punch |
| Outlook | Real send for RFI, publish, MoM | Needs `Mail.Send` consent |
| Teams | **Only** meeting provider (Comms + HR interviews) | When Graph live |
| MS Project | S-curve / progress when licensed (else Excel import) | Optional |

Setup: [M365_SETUP.md](./M365_SETUP.md) · Design: [system-design/07-LLD-Microsoft-Graph.md](./system-design/07-LLD-Microsoft-Graph.md)

**Health checks (no login):**

- `GET /api/health` — `mockOneDrive: false`, `graphConfigured: true`
- `GET /api/health/sharepoint` — `tokenOk`, `siteOk`, `driveId` (after deploy)

---

## 6. Future (not in current build scope)

| Topic | Notes |
|-------|--------|
| **Snag list** | Module / tab — after core delivery |
| **Project closure** | Client closure pack — later |
| **Finance field-level depth** | Columns / approvals / Excel import after shell |
| Full statutory payroll engine | After payslip PDF v1 |
| Extra client home widgets | Beyond ops dashboard |

Tracker: [ROADMAP_DISCUSS_LATER.md](./ROADMAP_DISCUSS_LATER.md)

---

## 7. Cross-cutting rules

1. **Project isolation** — delivery data scoped to one project; pilot uses client’s real data on one project only.  
2. **Drawing Check Master** completed before upload / revision.  
3. **Request notifications** — create / respond → email outbox (+ Outlook when Graph live).  
4. **Client** cannot upload drawings or edit Cost / Finance commercial numbers unless Office enables permission.  
5. **Quality / Safety checklist Excel** — upload → choose → fill / request inspection.  
6. **QAP** always updatable under Quality.  
7. **Microsoft 365** tested per M365 setup before UAT “live”.  
8. **Sheet → dashboard** — Excel is template; portal is system of record.  
9. **Sheet Maker** templates drive custom meeting sheets.  
10. **Client civil visibility** — S-curve, summary schedule, MS Project progress, procurement, generated PDFs.  
11. **PDF viewable** in-portal.  
12. **Personal diary ≠ Field day log.**  
13. **CRM quotations / comparatives** — Office confidential.  
14. **KYC / attendance selfies** — HR-restricted and audited.  
15. **Information vs Inspection** labels must match §3B everywhere in UI.

---

## 8. Acceptance (module finalization)

A module is “final” when:

- Tools and **fields** match this doc + [modules/](./modules/) + `module_prompts/`  
- Biweekly / design review sign-off recorded  
- Pilot project flow verified with real data (including sheet-backed dashboards)  
- Open critical bugs = 0 for that module  
- **Also:** Information vs Inspection labels correct; geo punch rejects out-of-fence without override; quotation DOCX/PDF generates; comparative totals reconcile; Graph status healthy before M365 “live”; audit CAPA and KPI overdue counts consistent  

**UAT** after agreed build + pilot period (see sprint plan).

---

## 9. Document map (for the team)

| Doc | Use |
|-----|-----|
| This file | Client-shareable requirements |
| [CLIENT_LATEST_UPDATES.md](./CLIENT_LATEST_UPDATES.md) | Plain-language stakeholder update (Aug 2026) |
| [SHAREPOINT_RENDER_ENV.md](./SHAREPOINT_RENDER_ENV.md) | IT — Render env vars & SharePoint upload |
| [modules/](./modules/) | **All module definitions + field specs** (refine before build) |
| [system-design/](./system-design/) | HLD / LLD / flows / data model |
| [PRODUCT_IA.md](../PRODUCT_IA.md) | Locked module → tools IA |
| [SHEET_TO_DASHBOARD.md](./SHEET_TO_DASHBOARD.md) | Excel → portal map |
| [M365_SETUP.md](./M365_SETUP.md) | Entra / Graph setup clicks |
| [../module_prompts/](../module_prompts/) | Short build prompts (1:1 with modules) |
