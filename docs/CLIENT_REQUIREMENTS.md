# Sharnam Portal — Client Requirements (shareable)

**Product:** Sharnam PMC Portal (शरणम्)  
**Live demo:** https://sharnam-portal.onrender.com  
**Audience:** Sharnam office, site, client, contractor  
**UI:** Modern Signal — Blue · Red · Yellow · White · Black  

This document is the **requirements baseline** for module finalization. Items marked **to be discussed** are scoped in biweekly meetings (see sprint plan + roadmap docs).

---

## 1. Users (four kinds)

| User | Who | Primary use |
|------|-----|-------------|
| **Sharnam Office** | PMC / admin / office | Master setup, modules on/off, directory, RFIs, Comms, Cost, Finance, Reports |
| **Site** | Site engineer / site staff | Day log, photos, checklist fills, QI/Safety, Field RFIs |
| Client | Owner / client stakeholder | Civil-side view: schedule / S-curve / progress, procurement, generated docs & PDFs, published drawings, concerns, DPR/WPR; QI/Safety checklist create where allowed |
| **Contractor** | Main contractor / vendor | Fill assigned checklists / RFIs, photos, bills where allowed |

Directory Master lists these four as **tools** (Office · Site · Client · Contractor) and assigns them onto each project.

---

## 2. Login experience (required)

1. Sign in (module or role login).  
2. **Ops dashboard** — open RFIs, open issues / alerts, recent diary signals, Quick links to Quality / Safety **Request for Information**.  
3. **Module selection** — enter only enabled modules for that project.  
4. Inside a module: **Hub → sub-tools → page Actions** (no left tools rail).

---

## 3. Sheet data → live dashboards (required)

Every Excel register / dashboard the client shared must become a **portal dashboard or tool** (not a download-only file). Source sheets live under `templates/` and project root for reference; the product of record is the in-app view.

| Client sheet / pack | Lives as portal |
|---------------------|-----------------|
| Approval & GFC Drawing Log | Drawings → GFC register |
| Communication Matrix (BPCL) | Comms → Matrix |
| Quality Assurance Plan (QAP Week 50) | Quality → **QAP** tool (upload / update / view) |
| NCR / Quality registers | Quality → QI / NCR dashboards |
| Safety NCR | Safety → Safety dashboard |
| Progress Overview, Planned vs Actual, Monthly Progress, Milestone, Hindrance | Progress → matching tools |
| Cashflow Dashboard | Cost → Cashflow |
| Payment Summary / invoice-style sheets | **Finance** → Invoice / RA / COP tools |
| DPR / WPR packs | Reports → DPR / WPR |
| Cube register & similar QA sheets | Quality checklists / registers |
| **Project summary schedule** (file client will share) | Progress → **Project summary schedule** + client civil view |
| **MS Project** file / export | Progress → **S-curve** + **MS Project progress** |
| **Procurement plan** | Progress or Field → **Procurement plan** (client-visible) |
| Custom meeting sheet templates | Comms → **Meeting sheet maker** |

Import / seed into the **pilot project only** during build; UAT uses the same dashboards with client data.

Full map: [SHEET_TO_DASHBOARD.md](./SHEET_TO_DASHBOARD.md)

---

## 3A. Client civil-side requirements (understood from client)

These must be **visible to the Client** on the civil / project side (read-first; Office uploads / syncs).

| # | Requirement | Where it lives | Notes |
|---|-------------|----------------|-------|
| 1 | **S-curve from MS Project file** | Progress → Planned vs Actual / **S-curve** | Built from MS Project % complete / baseline (Graph sync if licensed) **or** from shared Project export / summary schedule until sync is live. See `docs/M365_SETUP.md` § D. |
| 2 | **Project summary schedule** | Progress → **Summary schedule** | Client will **share the file**; portal stores it and shows schedule summary on client civil view. |
| 3 | **MS Project progress** | Progress → **MS Project progress** | Live or imported progress from MS Project (tasks / % / milestones) shown to Client. |
| 4 | **Document generations → shown to Client (civil side)** | Reports / Comms / DMS → **Generated documents** | Agenda, MoM, DPR/WPR, meeting sheets, and other generated packs must appear on the **client civil** surface — not Office-only. |
| 5 | **Procurement plan** | Progress (or dedicated tool) → **Procurement plan** | Upload / maintain procurement plan; Client can view status. |
| 6 | **PDF upload + in-app view** | DMS / module attachments | **PDF upload supported**; uploaded PDFs must be **viewable in the portal** (browser viewer). Applies to schedule PDFs, procurement PDFs, generated packs, and at least the key civil packs below. |
| 7 | **Three key PDF packs (viewable)** | Client civil desk | At minimum these three must upload + view: (1) **Project summary schedule PDF**, (2) **Procurement plan PDF**, (3) **Generated civil / meeting document PDF** (e.g. MoM or progress pack). |

Detail design of layouts can refine in biweekly meetings; this list is the **requirements baseline** the client has already understood.

---

## 4. Module requirements

### 4.1 Master (office)

| Tool | Requirement | Status |
|------|-------------|--------|
| Projects | Create / edit project, packages, enable/disable modules | In build |
| Directory | Four party tools: Office, Site, Client, Contractor | In build |
| PMC roster | Master people pool → assign into project | In build |
| Docs | Master / project document links | In build |
| Matrix seed | Meeting + RFI communication matrix | In build |
| **CRM** | **Lead management** (leads → project / client card) | **To be discussed** |
| **HRM / HRMS** | Employees & vendors → directory | **To be discussed** |

CRM and HRMS detail (fields, workflows, approvals) are **not finalized** in this 5-week build — see [ROADMAP_DISCUSS_LATER.md](./ROADMAP_DISCUSS_LATER.md).

### 4.2 Home (project)

Overview, Directory (4 types), Vendors, Documents (DMS).

### 4.3 Drawings

| Tool | Requirement |
|------|-------------|
| GFC register | Drawing log R0–R5, publish, view |
| **Checklist manager** | Create / edit Drawing Check Master templates & items |
| Upload flow | **Opens a separate window** for checklist fill (same family as QI/Safety fill UX). After complete → unlock → upload sheet / revision |
| Documents (DMS) | Folders under Drawings |
| Coordination | Design issues → escalate to Ask |
| Request checklist fill | Matrix / contractor fill RFI |
| Ask (drawing RFI) | Clarification only (information) |
| Submittals | **Out of scope for now** |

### 4.4 Quality

| Tool | Requirement |
|------|-------------|
| Quality dashboard / QI | Procore-style quality inspections |
| **Checklist master** | Create checklists; **upload Excel** checklist file; choose which checklist to use for fills / RFIs |
| **Quality Assurance Plan (QAP)** | Upload and **update** the QAP (from client Week-50 sheet); keep it visible as a Quality tool |
| Site checklists | Assign and fill site / QI forms |
| Request QI fill | Matrix / vendor notified to complete |
| NCR / assurance registers | Dashboards matching shared NCR sheets |

Checklist + RFI always visible. Office, Site, and **Client** (where enabled) can create / upload checklist Excel; Contractor fills assigned forms.

### 4.5 Safety

| Tool | Requirement |
|------|-------------|
| Safety dashboard | Observations, incidents, open items (incl. Safety NCR style) |
| **Safety checklists** | Create checklists; **upload Excel** checklist file; choose checklist for fills / RFIs |
| Safety checklist RFI | Request fill |

Same Excel create / upload / choose pattern as Quality.

### 4.6 Progress

Separate tools (each from shared sheets / MS Project):

| Tool | Requirement |
|------|-------------|
| Overview | Progress KPIs |
| Milestones | Milestone register |
| Planned vs Actual / **S-curve** | From **MS Project** file/sync or Excel seed |
| **Project summary schedule** | File client shares → viewable on portal + PDF |
| **MS Project progress** | Task / % progress from MS Project (client-visible) |
| **Procurement plan** | Plan register + PDF view for Client |
| Monthly | Month-by-month view |
| Hindrance / Risk / Legal | Matching shared sheets |

### 4.7 Field

Day log, Photos, Field RFIs.

### 4.8 Comms

| Tool | Requirement |
|------|-------------|
| Matrix | Meeting + RFI parties |
| Meeting → Agenda → MoM → Follow-up | Standard flow |
| **Custom meeting sheet maker** | **Module / tool to create custom meeting sheet templates** (columns, sections, party blocks) and use them when scheduling meetings — not a single fixed form only |
| Ask (PMC RFI) | Classic RFI |
| Email / Outlook | Outbox + Graph when live |
| Generated docs → Client | MoM / agenda / meeting PDFs visible on **client civil** side |

### 4.9 Cost (design / measurement — not commercial finance)

**Separate from Finance.** Cost is engineering cost control:

| Tool | Requirement |
|------|-------------|
| Monitoring | BOQ / monitoring desk |
| MB sheets | Measurement books |
| BBS | Bar bending schedule |
| Budget WBS | Budget structure |
| Cashflow | Cashflow dashboard (from shared Cashflow sheet) |
| Rate difference | Rate variance |
| Structure upload | Import BOQ structure |

### 4.10 Finance (commercial tracking — **new module**)

**Separate from Cost.** Finance tracks commercial documents and payments. Detail design later; **module shell + tools** are in the product now.

| Tool | Requirement (baseline) |
|------|------------------------|
| Overview | Finance desk / open items |
| **Invoice tracking** | Invoices raised / received / status |
| **PO tracking** | Purchase orders vs delivery / billing |
| **RA bill tracking** | Running account bills |
| **COP tracking** | Certificate of payment / payment certificates |

Deep fields, approvals, and Excel import for Finance will be finalized in biweekly meetings / post-Week-5 detail sessions. See [MODULE_FINANCE.md](./MODULE_FINANCE.md).

### 4.11 Reports

DPR / WPR packs from live registers (matching shared DPR / WPR sheets). **Generated report PDFs** must be viewable and shown on the **client civil** side.

### 4.12 Documents / PDF (cross-module)

| Requirement | Detail |
|-------------|--------|
| PDF upload | Supported on DMS and relevant module attachments |
| In-app PDF view | Uploaded PDFs open in a **viewer** (not download-only) |
| Three civil packs | Summary schedule · Procurement plan · Generated civil/meeting PDF — all upload + view |

---

## 5. To be discussed (not full product yet)

| Topic | Notes |
|-------|--------|
| **Snag list** | Module / tab — discuss in biweekly + UAT gate |
| **Project closure** | Client-facing closure pack — discuss later |
| **CRM / Lead management** | Scope, stages, handoff to project |
| **HRMS** | Payroll vs roster vs attendance — discuss later |
| **Finance detail** | Field-level invoice / PO / RA / COP after shell |
| Extra client-facing widgets | Beyond ops dashboard |

Tracker: [ROADMAP_DISCUSS_LATER.md](./ROADMAP_DISCUSS_LATER.md)

---

## 6. Cross-cutting rules

1. **Project isolation** — all data scoped to one project; pilot uses **client’s real data** on one project only.  
2. **Drawing Check Master** must be completed before upload / revision.  
3. **RFI notifications** — create / respond → project email outbox (+ Outlook when Graph is live).  
4. **Client** cannot upload drawings or edit Cost / Finance commercial numbers unless Office enables a specific permission.  
5. **Quality / Safety checklist Excel** — upload template → choose template → fill / request fill.  
6. **QAP** must remain updatable and always available under Quality.  
7. **Microsoft 365** — OneDrive + Outlook + **MS Project (S-curve / progress)** tested per `docs/M365_SETUP.md` and sprint test checklist.  
8. **Sheet → dashboard** — shared Excel is the template; the portal dashboard is the working system of record.  
9. **Custom meeting sheets** — meeting sheet maker templates drive Comms meetings.  
10. **Client civil visibility** — S-curve, summary schedule, MS Project progress, procurement plan, and generated documents/PDFs are shown to Client.  
11. **PDF viewable** — uploads support PDF and must be viewable in-portal.

---

## 7. Acceptance (module finalization)

A module is “final” when:

- Tools match this doc + `module_prompts/`  
- Biweekly review sign-off recorded  
- Pilot project flow verified with real data (including sheet-backed dashboards)  
- Open critical bugs = 0 for that module  

**UAT** starts only after **one month** of build + pilot (see sprint plan).
