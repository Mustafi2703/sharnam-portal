# Sharnam Portal — Client Requirements (shareable)

**Product:** Sharnam PMC Portal (शरणम्)  
**Version:** 2.1 · 10 Aug 2026  
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
| **SharePoint live** | Files upload to `SharnamProjects` when env is set (`MOCK_ONEDRIVE=false`) |
| **SharePoint = document store** | Every file uploaded through the portal is stored in SharePoint first; the portal **views** that store — it does not keep a separate copy as the source of truth |
| **Matrix drives document access** | Communication Matrix parties see the document folders and PDFs their role is assigned to — with in-app viewer |

---

## 1. Users and roles

| User | Who | Primary use |
|------|-----|-------------|
| **Sharnam Office** | PMC / admin / office / HR | Master setup, modules on/off, Directory, CRM, HRMS, Comms, Cost, Finance, Reports, Audit, KPI |
| **Site** | Site engineer / site staff | Attendance punch, day log, photos, checklist fills, QI/Safety, Field requests |
| **Client** | Owner / client stakeholder | Published drawings, progress packs, DPR/WPR, concerns, civil PDFs (read) |
| **Contractor** | Main contractor / vendor | Assigned packages, inspection fills, photos, checklist evidence |
| **Employee** | Sharnam staff (self-service) | HRMS attendance (where assigned), leave, diary, payslips, training |

**Project Directory** lists four delivery parties: **Office · Site · Client · Contractor**.  
HRMS employees are the people pool — assigned into Directory and given the correct portal login.

---

## 1A. Login URLs, landing pages, and role views

Each role enters through a **dedicated login URL**. After sign-in they land on a role-appropriate home — not a generic screen.

### Login and landing matrix

| Role | Login URL | Demo account | Lands on | Primary modules visible |
|------|-----------|--------------|----------|-------------------------|
| **Hub (picker)** | `/login` | — | Portal tiles | — |
| **Office / PMC** | `/login/office` | `office@sharnam.demo` | Project dashboard | All enabled modules for project + Master + CRM + HRMS |
| **Site / field** | `/login/site` | `site@sharnam.demo` | **Attendance** (`/attendance`) | Field, Quality, Safety, Drawings (view/fill), Reports (view), HRMS attendance |
| **Contractor** | `/login/vendor` | `vendor@sharnam.demo` | Workspace / assigned desk | Drawings (published), Quality/Safety fills, Field evidence |
| **Client** | `/login/client` | `client@sharnam.demo` | Dashboard (read-first) | Progress civil, published drawings, Reports, DMS (shared), Concerns |
| **Employee** | `/login/employee` | `employee@sharnam.demo` | Dashboard / workspace | HRMS self-service, assigned project tools |
| **Master setup** | `/login/master` | `office@sharnam.demo` | Master desk | Projects, modules, Directory seed |
| **HR admin** | `/login/hr` | `office@sharnam.demo` | HRMS desk (`/hrm`) | Full HRMS — recruitment through payroll |

Password (demo): **`Demo@1234`**

### What each portal user sees (requirement)

| Role | Home / ops view | Can upload files | Can view documents (DMS) | Can view drawings (GFC) | Attendance |
|------|-----------------|------------------|--------------------------|-------------------------|------------|
| **Office** | Open RFIs, alerts, module hubs | Yes — all project folders | Yes — full ISO tree | Yes — full register + upload | Yes — HRMS roster + override |
| **Site** | Attendance first, then field desk | Yes — site evidence, photos, attendance selfies | Yes — folders assigned on matrix | Yes — published + fill | **Yes — selfie + GPS punch (IST)** |
| **Contractor** | Assigned package desk | Yes — evidence against assigned ask | Yes — shared / assigned folders | Yes — **published GFC only** | If assigned as site employee |
| **Client** | Civil progress summary | No (unless Office grants) | Yes — **published / shared** folders only | Yes — **published** revisions only | No |
| **Employee** | Self-service + assigned project | Limited — per assignment | Per matrix + assignment | Per assignment | If site-assigned |

### Navigation rule (all roles)

1. Sign in at role URL → **landing page for that role**  
2. Select project (if multiple) → **module hub** (only modules enabled for that project)  
3. Open tool → work → attachments land in **SharePoint** via portal upload  
4. **Documents** tool browses the same SharePoint library — in-app preview for PDF/images  

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

## 3C. Document store — SharePoint source + in-app viewer

### Principle (locked)

| Rule | Requirement |
|------|-------------|
| **SharePoint is the store** | `https://spdcsmb.sharepoint.com/sites/SharnamProjects` holds all project files. Upload through the portal **writes to SharePoint** (`MOCK_ONEDRIVE=false`). |
| **Portal is the window** | DMS (Documents) browses and previews files from SharePoint — folder tree mirrors ISO Rev 02 structure. No parallel “hidden” file store for production. |
| **Upload = SharePoint** | Drawings, DMS, attendance selfies, checklist photos, report exports, CRM quotations — all use the same upload bridge. Success response must show `provider: sharepoint`. |
| **In-app viewer** | PDF and common image types open **inside the portal** (preview pane / full-screen) — not download-only. |
| **Matrix = access list** | Communication Matrix (Comms) lists parties, roles, and distribution for meetings and document circulation. **Directory + Matrix** define who is on the project; **Roles / module permissions** define which folders they open in DMS. |
| **Client / contractor scope** | Client sees **published** drawing packs and **shared** DMS folders only. Contractor sees assigned package folders + published GFC. Office sees full tree. |
| **Audit** | Every upload logs user, time, SharePoint path, and project — visible in audit trail. |

### Document viewer — minimum behaviour

| Capability | Requirement | Status |
|------------|-------------|--------|
| Browse folders | ISO tree per project; sync from SharePoint | Live |
| Upload file | Office / site / contractor (per permission) → SharePoint path | Live |
| Preview PDF | In-browser PDF viewer | Live |
| Preview image | Thumbnail + full view | Live |
| Download | Allowed where view is allowed | Live |
| Matrix party access | User on Directory + Comms matrix can open folders their role is granted | Required at UAT |

### Three document surfaces (do not confuse)

| Surface | Purpose | SharePoint area |
|---------|---------|-----------------|
| **Documents (DMS)** | All project files — contracts, HSE, daily records, MIS | Full ISO folder tree under project code |
| **GFC register** | Drawing revision workflow R0–R5, publish gate | Design & engineering — revision metadata in portal, files in SharePoint |
| **Drawing file library** | Sheet PDFs/DWG browse | `02_DESIGN_AND_ENGINEERING` folders |

Handover map: [PMC_DMS_HANDOVER.md](./PMC_DMS_HANDOVER.md) · IT env: [SHAREPOINT_RENDER_ENV.md](./SHAREPOINT_RENDER_ENV.md)

---

## 4. Module requirements

Each module is enabled per project in **Master**. Only enabled modules appear in the project hub for that project. Field-level specs: [modules/](./modules/).

### 4.1 Master (office)

**Who:** Office / PMC admin only. **Route:** `/master` or project setup from Office login.

| Tool | Requirement | Who uses | Status |
|------|-------------|----------|--------|
| Projects | Create / edit project, packages, enable/disable modules per project | Office | Built |
| Directory | Four party tools: Office, Site, Client, Contractor — names, emails, roles on project | Office | Built |
| PMC roster | People pool from HRMS → assign into project Directory | Office + HR | Built |
| Docs | Master / project document links and handover references | Office | Built |
| Matrix seed | Default communication matrix rows for meetings + document circulation | Office | Built |
| **CRM** | Leads, orgs, quotation, bid compare → project | Office commercial | **In scope** — §4.13 |
| **HRMS** | Full people lifecycle → feeds Directory | Office + HR | **In scope** — §4.14 |
| **Sheet Maker** | Custom sheet / meeting templates | Office | **In scope** — §4.16 |
| **Site Audit** | Audit pack tools | Office / QA | **In scope** — §4.15 |
| **KPI / KRA** | Master KPI dashboard + role KRA templates | Office | **In scope** — §4.15 |
| Audit trail / Roles | Who did what; permission matrix per module | Office | Built |

**Login view:** Office user signs in at `/login/office` → project list → Master desk or any enabled module hub.

### 4.2 Home (project)

**Who:** All project parties (scope varies by role).

| Tool | Requirement | Office | Site | Client | Contractor |
|------|-------------|:------:|:----:|:------:|:----------:|
| Overview | Project snapshot, alerts, open RFIs | ✓ | ✓ | ✓ read | ✓ assigned |
| Directory | Four party lists with contacts | ✓ edit | ✓ view | ✓ view | ✓ view |
| Vendors | Project vendor register | ✓ | view | view | self |
| Documents (DMS) | ISO folder browse + upload + preview | ✓ full | ✓ assigned | ✓ shared | ✓ assigned |

**Login view:** After project pick, Home is the default hub card row — not a separate login URL.

### 4.3 Drawings

**Who:** Office manages register; Site/Contractor fill checklists; Client sees **published** only.

| Tool | Requirement | SharePoint |
|------|-------------|------------|
| GFC register | Drawing log R0–R5, publish gate, revision history | Metadata in portal; files in SP |
| Checklist manager | Drawing Check Master; must complete before upload | — |
| Upload flow | Modal: checklist fill → unlock → new revision upload | `02_DESIGN_AND_ENGINEERING` |
| Documents (DMS) | Drawing-related folders under ISO tree | Full tree (role-filtered) |
| Coordination | Design issues → escalate to Ask (RFI) | — |
| Request checklist fill | Matrix party / contractor assigned to fill | — |
| **Ask — Request for Information** | Clarification **only** (not inspection) | Attachments → SP |
| Submittals | **Out of scope for now** | — |

**Login view:** Office — full register + upload. Site — fill assigned checks + view published. Client — published sheets only, in-app PDF view. Contractor — assigned package sheets.

### 4.4 Quality

**Who:** Office creates masters; Site/Contractor fill; Client may create/upload checklist Excel where enabled.

| Tool | Requirement |
|------|-------------|
| QI dashboard | Quality inspections, open items, status |
| Checklist master | Create; **upload Excel**; choose template for site fills |
| QAP | Upload / update; always available to Office |
| Site checklists | Assign to site/contractor; mobile fill |
| NCR / cube / assurance | Dashboards matching shared Excel registers |
| **Request for Inspection** | Request QI / checklist inspection fill (not RFI) |

Evidence photos → SharePoint under project quality folders. Client sees published QI summaries where Office enables.

### 4.5 Safety

**Who:** Same pattern as Quality — separate module, separate NCR stream from QI.

| Tool | Requirement |
|------|-------------|
| Safety dashboard | Observations, incidents, open items |
| Safety checklists | Excel upload + choose template |
| **Request for Inspection** | Safety checklist / inspection request |

Site mobile: observation capture with photo → SharePoint HSE folders.

### 4.6 Progress

**Who:** Office maintains; **Client reads** civil-side registers.

| Tool | Requirement | Client visible |
|------|-------------|:--------------:|
| Overview | Progress KPIs, summary cards | ✓ |
| Milestones | Milestone register | ✓ |
| Planned vs Actual / **S-curve** | MS Project sync or Excel import | ✓ |
| **Project summary schedule** | Shared file + PDF | ✓ |
| **MS Project progress** | Task / % complete | ✓ |
| **Procurement plan** | Register + PDF | ✓ |
| Monthly | Month-by-month progress | ✓ |
| Hindrance / Risk / Legal | Matching shared sheet registers | partial |

**Login view:** Client at `/login/client` → Progress civil tab → S-curve, schedule, procurement PDFs **in-app**.

### 4.7 Field

**Who:** Site primary; Office oversight.

| Tool | Requirement | Notes |
|------|-------------|-------|
| Day log | Daily site activity log per project | ≠ HR personal diary |
| Photos | Geo-tagged site photos | → SharePoint |
| Field requests | Operational requests (explicit kind) | Not RFI / not inspection |

**Login view:** Site user lands on Attendance first; Field tools in project hub sidebar.

**Personal diary** lives in HRMS (employee-owned) — **not** the same as project day log.

### 4.8 Comms

**Who:** Office runs meetings; Matrix defines **who receives documents and invites**.

| Tool | Requirement |
|------|-------------|
| **Communication matrix** | Parties, roles, distribution for meetings + document circulation — **defines document access audience** |
| Meeting → Agenda → MoM → Follow-up | Standard flow; four separate hub tools |
| **Microsoft Teams only** | Meeting links via Graph when live |
| **Sheet Maker templates** | Bind custom sheet to meeting |
| Ask | Request for Information (PMC / drawings) |
| Email / Outlook | Outbox + Graph send when live |
| Generated docs → Client | MoM / agenda / meeting PDFs on civil side + DMS |

**Document access rule:** A party listed on the Communication Matrix for a project should be able to open the DMS folders and generated PDFs their role is granted — Office configures folder permissions; matrix is the **named party list**.

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

**Who:** Office + Client (read) for commercial status; not mixed with Cost engineering.

Shell tools live; field-level detail phased.

| Tool | Baseline | Office | Client |
|------|----------|:------:|:------:|
| Overview | Finance desk | ✓ | view |
| Invoice tracking | Raised / received / status | ✓ | view |
| PO tracking | PO vs delivery / billing | ✓ | view |
| RA bill tracking | Running account bills | ✓ | view |
| COP tracking | Certificates of payment | ✓ | view |

See [MODULE_FINANCE.md](./MODULE_FINANCE.md).

### 4.11 Reports

**Who:** Office generates; Client views PDF packs on civil side.

| Tool | Requirement |
|------|-------------|
| DPR maker | Daily progress report from live registers |
| WPR pack | Weekly progress pack |
| Print / PDF | Branded export with logo → SharePoint + in-app view |

**Login view:** Client sees generated DPR/WPR PDFs under Reports / civil dashboard — preview in browser.

### 4.12 Documents / PDF (cross-module)

| Requirement | Detail | Roles |
|-------------|--------|-------|
| SharePoint source | All uploads land in `SharnamProjects` — portal DMS browses same store | All uploaders |
| PDF upload | DMS and module attachments | Office, Site, Contractor (per folder) |
| In-app PDF view | Preview pane / full-screen — **not download-only** | All viewers granted access |
| Matrix party access | Comms matrix parties open folders assigned to their role | Per Directory + matrix |
| Three civil packs | Summary schedule · Procurement · Generated civil/meeting PDF | Client read |

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

**Who:** HR / Office full access; Employee self-service; Site staff for attendance punch.

**Routes:** `/hrm` (HR desk) · `/attendance` (site punch) · `/login/hr` (HR admin login)

#### HRMS tools overview

| Tool | Purpose | Primary user |
|------|---------|--------------|
| Dashboard | Headcount, pending leave, open offers, punches today | HR / Office |
| Employees | Directory, DOJ, assign to project | HR |
| Recruitment | Requisition → candidate → interview → offer | HR |
| Pre-join / Onboarding | Checklist, KYC, appointment letter | HR + new hire |
| **Attendance** | Geofence punches, roster, HR override | Site + HR |
| Leave | Requests, leave types, holidays | Employee + HR |
| Personal diary | Employee daily diary (≠ Field day log) | Employee |
| Compensation & Payslips | CTC master + payslip PDF | HR + Employee |
| Training & KRA | Training records + appraisal from Master KPI templates | HR + Employee |
| Masters | Depts, geofences, policies, letter templates | HR |

#### Attendance — detailed requirement

Attendance is **HRMS capability** used primarily by **Site login** (`/login/site` → lands `/attendance`).

| Item | Requirement |
|------|-------------|
| **Who punches** | Employees assigned to site geofence for the project |
| **Check-in / Check-out** | Selfie + device GPS required for each punch |
| **Geofence** | Per project/site — center lat/lng + radius (default 150–300 m); optional polygon |
| **Out of fence** | Punch **rejected** unless HR manual override (audited) |
| **Time zone** | All punch times displayed and stored as **IST (Asia/Kolkata)** |
| **Selfie storage** | Upload to SharePoint: `…/{PROJECT}/…/Attendance/` — not local-only in production |
| **Verification status** | Verified / OutOfFence / ManualOverride / Failed |
| **HR roster** | HR sees daily punch list, missing punches, override with reason |
| **Privacy** | Selfies and KYC — HR-restricted; audit trail on view/override |

#### Attendance punch flow (site user)

1. Open `/login/site` on mobile → sign in  
2. Allow **Camera** and **Location**  
3. Select project (if multiple) → Attendance panel  
4. Take selfie → **Check in** or **Check out**  
5. Success shows **IST time** + **SharePoint** provider (if env live)  
6. HR can correct via override with audit entry  

#### Other HRMS capabilities

| Capability | Requirement |
|------------|-------------|
| Recruitment & interview | Requisition → posting → resume DB → screen → shortlist → Teams interview → scorecard → offer → joining |
| Pre-joining | Documents, BGV, medical (if any), emp code, appointment letter, IT asset, email ID, ID card, welcome kit |
| Onboarding | PII, bank, PAN/Aadhaar, PF/ESIC, nominee, doc verify, dept, reporting manager, orientation, policy ack |
| Employee directory | DOJ, profile, assign to project Directory |
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

### 4.17 Client portal (read-first civil side)

**Who:** Client login only (`/login/client`).

| Area | Client can | Client cannot (default) |
|------|------------|-------------------------|
| Progress | S-curve, summary schedule, MS Project %, procurement PDF | Edit registers |
| Drawings | View **published** GFC revisions in-app | Upload / revise drawings |
| Documents (DMS) | Open **shared / published** folders; preview PDF | Full ISO tree |
| Reports | DPR/WPR PDF packs | Generate reports |
| Quality / Safety | View summaries where enabled; create checklist if Office grants | Edit cost / finance |
| Concerns | Raise / track client concerns | PMC internal tools |
| Comms | View MoM/agenda PDFs circulated on matrix | Run meetings |

**Fields:** [modules/MODULE_CLIENT_PORTAL.md](./modules/MODULE_CLIENT_PORTAL.md)

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
2. **SharePoint = document store** — portal uploads write to SharePoint; DMS browses the same library (§3C).  
3. **Communication matrix = party list** — names on matrix are the document/meeting audience; folder access follows role + Office config.  
4. **Drawing Check Master** completed before upload / revision.  
5. **Request notifications** — create / respond → email outbox (+ Outlook when Graph live).  
6. **Client** cannot upload drawings or edit Cost / Finance commercial numbers unless Office enables permission.  
7. **Quality / Safety checklist Excel** — upload → choose → fill / request inspection.  
8. **QAP** always updatable under Quality.  
9. **Microsoft 365** tested per M365 setup before UAT “live”.  
10. **Sheet → dashboard** — Excel is template; portal is system of record.  
11. **Sheet Maker** templates drive custom meeting sheets.  
12. **Client civil visibility** — S-curve, summary schedule, MS Project progress, procurement, generated PDFs.  
13. **PDF viewable in-portal** — all roles with access use viewer, not download-only.  
14. **Personal diary ≠ Field day log.**  
15. **CRM quotations / comparatives** — Office confidential.  
16. **KYC / attendance selfies** — HR-restricted and audited.  
17. **Attendance IST** — punch times always Asia/Kolkata for display and reports.  
18. **Information vs Inspection** labels must match §3B everywhere in UI.

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
