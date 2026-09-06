# Sharnam Portal — Digital Transformation & Capability Presentation

**For:** SPDC / Sharnam PMC leadership, PMO, site, finance, and client stakeholders  
**Demo project:** SPDC-UAT-LIVE · Dormitory & External Works  
**Portal:** https://sharnam-portal.onrender.com (UAT) · SharePoint: `SharnamProjects`  
**Password (demo users):** `Demo@1234`  
**Presentation time:** 2–3 hours (with live demo) · **Read time:** 45 minutes  

---

## 1. Executive summary — why this portal exists

Construction projects drown in **Excel folders, email threads, and duplicate PDFs**. Sharnam Portal is the **single online workspace** for one project: everyone sees the same truth, each role sees only what they need, and every important file lands in **one document store** (SharePoint) with **clickable links** inside the portal.

| Before (typical PMC) | After (Sharnam Portal) |
|----------------------|-------------------------|
| 20+ Excel registers per project, edited in parallel | One live register per module — import once, then maintain in portal |
| RFIs and NCRs by email; no audit trail | RFI / NCR forms with email notify, follow-up, close → **XLSX + PDF to DMS** |
| Drawings in one folder, contracts in another | **ISO folder tree** in Documents (DMS) — same structure every project |
| Weekly report re-typed from site notes | **DPR / WPR Maker** pulls live qty, quality, safety, progress |
| Contractor not on same page | Contractor login — assigned packages, RA bills, checklist fills |
| Client asks “where is the file?” | Open **Documents** or module export link — SharePoint URL in-app |

**Digital transformation in one line:**  
*From “send me the Excel” to “open the project — the register, the PDF, and the SharePoint link are already there.”*

---

## 2. The journey — how SPDC adopts the portal

```text
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    ┌──────────────────┐
│  CRM        │ →  │  Award /     │ →  │  Master project │ →  │  Live project    │
│  Lead ·     │    │  Convert to  │    │  setup          │    │  modules         │
│  Quotation  │    │  delivery    │    │  (directory +   │    │  (site fills,    │
│  Bid compare│    │  project     │    │  vendors + DMS) │    │  office closes)  │
└─────────────┘    └──────────────┘    └─────────────────┘    └──────────────────┘
```

### Step-by-step (non-technical)

| Phase | Who | What happens |
|-------|-----|----------------|
| **1. CRM** | Business development / office | Lead → quotation → comparative bid (R2 BOQs) → **Convert to project** |
| **2. Project birth** | Office | System creates project code, **ISO document folders** in DMS/SharePoint, enables modules |
| **3. Master setup** | Office / PM | **Master → Projects → Setup desk**: assign people, pick **contractors from global vendor directory**, link CRM bid package |
| **4. Seed data** | Office | Import Excel packs (BOQ, progress, quality, safety) *once per project* — see §8 |
| **5. Go-live** | Site + office | Daily DPR, weekly WPR, checklists, RFIs, RA bills — exports auto-file to DMS |
| **6. Steady state** | All parties | Matrix-driven emails, follow-ups, close-out, client read-only packs |

**Important rule:** Project setup happens **after CRM award**, not before. The global vendor catalog is maintained once; each project **assigns** the contractors it needs from that catalog.

---

## 3. Document management — one store, many doors

### 3.1 Three places files live (do not mix them up)

| Surface | What it holds | Example |
|---------|---------------|---------|
| **Documents (DMS)** | Contracts, HSE, meeting minutes, closed RFI/NCR exports, RA/COP PDFs | `03_SUPPORT_AND_RESOURCES/03.04_RFI_Information/Closed/` |
| **Drawings (GFC register)** | Sheet revisions R0–R5, approval workflow | Drawing PDF per sheet number |
| **Drawing file library** | Browse all sheet files | Linked from register row |

**SharePoint is the system of record.** The portal uploads, previews PDFs, and shows **Open in SharePoint ↗** links. Admins and office users can open any filed export from DMS or from the module that created it.

### 3.2 What gets filed automatically (admins can open in DMS)

| When you… | File types filed | Where to find in portal |
|-----------|------------------|-------------------------|
| Close an **RFI** | CSV register row + **branded XLSX form** (+ checklist XLSX if linked) | **Documents** → RFI Information → Closed · or RFI register → Download |
| Close **NCR / CAR / Safety NCR** | Branded **XLSX + HTML** (print to PDF) | Quality / Safety register · **Documents** → HSE / Quality |
| **Publish DPR / WPR** | Client **XLSX**, WPR **PPTX**, SharePoint path | Reports → DPR/WPR Maker · **Documents** → Reports |
| **Certify RA bill / COP** | Workbook copies | Finance → RA/COP · **Documents** → Commercial |
| **Comms MoM** | Branded XLSX MoM pack | Comms → meeting → Download |
| Upload in **DMS** | Any PDF, Excel, image | Stays in ISO folder you chose |

**RFI in demo:** Open **Quality or Drawings → RFIs** → select RFI → **Download XLSX** or **Download HTML** (Print → PDF). After **Close**, the same pack is archived to SharePoint and visible under Documents.

---

## 4. Capability at a glance

| # | Module | Sub-tools (approx.) | Primary documents in DMS |
|---|--------|---------------------|----------------------------|
| 1 | **Drawings** | 12 | GFC PDFs, coordination markup, register exports |
| 2 | **Documents (DMS)** | 4 | Full ISO tree — all project files |
| 3 | **Quality** | 14 | QAP, NCR/CAR, cube register, QI fills |
| 4 | **Safety** | 10 | Safety NCR, checklist evidence, HSE dashboard |
| 5 | **Inspection** | 6 | Activity inspection logs |
| 6 | **Progress** | 9 | Planned vs actual, milestones, S-curve, MS Project |
| 7 | **Comms** | 8 | Matrix, agenda, MoM, follow-up emails |
| 8 | **Cost** | 11 | BOQ, MB, BBS, cashflow chart/forecast/tracking |
| 9 | **Finance** | 9 | RA bills (3 stages), COP, invoices, payment summary |
| 10 | **Reports** | 4 | DPR / WPR live dashboards + makers |
| 11 | **Closure** | 5 | Snaglist, lessons learnt, closure report |
| 12 | **CRM + Master** | 8 | Quotations, comparative bids, project setup |

**Plus:** Standalone **HRMS** (leave, holidays, handbook, attendance), **Global vendors**, **Training** module, **Audit trail** (who changed what).

**Total:** 12 project modules · **100+ register tools** · **4 login portals** (Office, Site, Contractor, Client).

---

## 5. Module-by-module — what to show the client

Each section: **purpose → who → documents → demo path**.

---

### 5.1 CRM & Master (project birth)

**Purpose:** Win work, compare bids, spawn a delivery project with the right people and contractors.

| Item | Detail |
|------|--------|
| **Who** | Office, BD, PM |
| **Key flows** | Lead board → Quotation maker → Comparative bid (R2) → **Convert to project** |
| **Documents** | Quotation PDF, comparative XLSX → CRM folders in SharePoint |
| **Demo** | CRM → Leads → open linked project → **Master → Projects → Setup desk** |

**Project setup desk (after CRM):**

1. Assign **people** from HR pool (search by name/email) — feeds Communication Matrix emails.  
2. Assign **vendors / contractors** from **global directory** (searchable catalog — NK Infra, etc.).  
3. Confirm **DMS ISO folders** created — link: *Open document library*.  
4. Optional: seed R2 BOQ slots for vendor bid demo.

---

### 5.2 Drawings

**Purpose:** Control GFC revisions; separate “Ask” (clarification) from quality inspection.

| Documents in DMS | Drawing PDFs per sheet, coordination exports |
| **Demo** | Drawings hub → Register → Published revision → Design coordination (markup + follow-up → RFI after 5 nudges) |

---

### 5.3 Documents (DMS)

**Purpose:** **The filing cabinet** — every module’s exports and uploads end here.

| Capability | Detail |
|------------|--------|
| Browse | ISO Rev 02 folder tree per project |
| Preview | PDF and images in-browser |
| Upload | Office / site / contractor (per matrix rights) |
| Links | SharePoint URL on each file — admins click through |

**Demo:** Project → **Documents** → expand `03_SUPPORT_AND_RESOURCES` → open a closed RFI or report folder.

---

### 5.4 Quality

**Purpose:** QI checklists, QAP weekly sign-off, NCR/CAR, cube tests.

| Documents | NCR/CAR XLSX+HTML on close, QAP week export, QI fill PDFs |
| **Workflow** | Raise NCR → **Save** emails contractor → contractor action → office review email → **Follow-up** → **Close** |
| **Demo** | Quality → NCR register → open form → Save / Follow-up / Close |

---

### 5.5 Safety

**Purpose:** Safety checklists, safety NCR, HSE dashboard — same email/follow-up pattern as quality.

| **Demo** | Safety → NCR summary → form → follow-up (office only) |

---

### 5.6 Progress

**Purpose:** Planned vs actual, milestones, hindrances, risks, legal, S-curve, MS Project link to DPR/WPR.

| Documents | Progress dashboard imports, S-curve exports |
| **Demo** | Progress → Overview → Planned vs Actual (scrollable register) → S-curve |

---

### 5.7 Cost & Finance (engineering vs commercial)

**Cost (engineering):** BOQ monitoring, MB, BBS (+ shape master), cashflow **Chart / Forecast / Tracking**, cement/steel rates.

**Finance (commercial):** RA Bill Tracker (**Submission → Corrected → Certified**), COP only after Certified, material invoices.

| Documents | Budget workbooks, certified RA XLSX, COP workbook → SharePoint commercial folders |
| **Demo** | Cost → Load SPDC template → Cashflow tabs → Finance → RA-05 Certified → Create COP |

---

### 5.8 Comms

**Purpose:** Communication matrix → meeting → agenda → MoM → **follow-up email** to action owners.

| Documents | MoM branded XLSX, matrix import from `Communication Matrix_BPCL.xlsx` |
| **Demo** | Comms → Matrix → Meeting → Send follow-up |

---

### 5.9 Reports — DPR & WPR

**Purpose:** Daily and weekly client packs from **live data** (not re-typed Excel).

| Output | XLSX · HTML/PDF print · WPR PPTX · Publish to SharePoint |
| **Demo** | DPR Maker (discipline, date, Save, Publish) → WPR Maker (Load, Regenerate, Publish, Client XLSX/PPTX) |

---

### 5.10 Closure

**Purpose:** Snaglist gate, lessons learnt, project closure report for handover.

---

### 5.11 HRMS (organisation-wide)

**Purpose:** Leave balances, holidays (India/Gujarat seeded), handbook, appointment letter samples, attendance (site selfie + GPS).

| **Demo** | HRMS → Leave → Documents → Holidays calendar |

---

### 5.12 Vendor / Contractor portal

**Purpose:** Assigned contractor sees only their work — RA submission, vendor BOQs, checklist fills, NCR response emails.

| Login | `nkinfra@sharnam.demo` |
| **Demo** | Vendor login → CRM Vendor bids → Finance RA upload → NCR form link from email |

---

## 6. Live demo script (2–3 hours)

Use project **SPDC-UAT-LIVE**. Suggested order:

| Time | Topic | Login | Must-show |
|------|-------|-------|-----------|
| 0:00 | Vision + document story (§1–3) | — | Slide: SharePoint = one store |
| 0:15 | CRM → Master setup → vendor from directory | Office | Setup desk, DMS link |
| 0:30 | Documents (DMS) + Drawings | Office | PDF preview, SharePoint link |
| 0:45 | Quality NCR + Safety NCR email flow | Office + mention contractor email | Save, follow-up, close |
| 1:00 | Cost cashflow + BBS master | Office | Chart/Forecast/Tracking, no bulk shapes |
| 1:20 | Finance RA/COP chain | Office + Vendor | 3-stage RA, COP gate |
| 1:40 | Progress + DPR Maker | Site | Scrollable page, discipline DPR |
| 2:00 | WPR Maker publish | Office | SharePoint publish, PPTX |
| 2:15 | Comms follow-up | Office | Matrix, MoM email |
| 2:30 | HRMS + Training | Office | Leave, holidays |
| 2:45 | Q&A + pipeline (§7) | — | |

**Quick reference:** [SPDC_DEMO_GUIDE.md](./SPDC_DEMO_GUIDE.md) · **Test checklist:** [03-Module-Test-Plan.md](./03-Module-Test-Plan.md)

---

## 7. Pipeline — what eases work next (already built or in flight)

| Area | Benefit for SPDC |
|------|------------------|
| **PvA ↔ Cost reconciliation** | One click to align progress snapshot with cashflow COP |
| **Vendor BOQ portal** | Contractors upload discipline BOQs without email |
| **NCR/CAR/Safety email loop** | Contractor notify → office review → follow-up → close to DMS |
| **WPR SharePoint publish** | Client pack auto-filed weekly |
| **HRMS holidays + handbook** | Single HR desk for site and office |
| **Communication matrix import** | BPCL-style matrix seeds meeting parties |
| **MS Project → S-curve** | Schedule drives DPR/WPR charts |
| **Mobile-friendly site login** | Attendance punch, checklist photos on phone |
| **Audit trail** | Compliance — who changed bill, drawing, checklist |
| **Training module** | In-app steps per module (office maintains) |

*Audit KPI workbook module is deferred from navigation — KPIs roll up from live modules instead.*

---

## 8. Data the client prepares (summary)

**Once per organisation (global masters):** MB templates, BBS templates, BBS shapes, checklist masters (drawing, site, QI, safety).

**Per new project (after CRM award):** BOQ per structure, progress pack, quality/safety registers, drawing register, optional cashflow.

Full detail: [11-Global-Masters-vs-Project-Seed.md](./11-Global-Masters-vs-Project-Seed.md) · [10-Master-Documents-Checklist.md](./10-Master-Documents-Checklist.md)

---

## 9. Server refresh before client demo

Run on **Hostinger / production server** (not from a laptop unless DB credentials work):

```bash
git pull origin main
npm run db:push
npm run db:seed
npx tsx seed/uatLiveProject.ts
npm run hostinger:build
# restart API + web services
```

This loads: 7-day DPR, WPR #50, finance RA/COP, cost workbooks, HRMS leave/holidays, vendor BOQs, comms matrix sample.

---

## 10. Demo logins

| Role | Email | Use |
|------|-------|-----|
| SPDC Office | `operations@spdc.in` or `office@sharnam.demo` | Full demo |
| Site | `site@sharnam.demo` | DPR, safety, checklists |
| Contractor | `nkinfra@sharnam.demo` | RA bills, BOQs, NCR response |
| Client | `client@sharnam.demo` | Read-only dashboards |

Password: **`Demo@1234`**

---

## 11. Related documents in this folder

| Doc | Use |
|-----|-----|
| [SPDC_DEMO_GUIDE.md](./SPDC_DEMO_GUIDE.md) | Short demo cheat sheet |
| [01-Whats-New.md](./01-Whats-New.md) | Feature highlights |
| [04-SharePoint-and-Files.md](./04-SharePoint-and-Files.md) | IT / SharePoint setup |
| [08-Quality-Safety-DPR-WPR-Guide.md](./08-Quality-Safety-DPR-WPR-Guide.md) | Quality/report deep dive |
| [09-Project-Setup-Sheets-Required.md](./09-Project-Setup-Sheets-Required.md) | Minimum Excel uploads |
| [12-Live-Client-UAT-Workbook.md](./12-Live-Client-UAT-Workbook.md) | Sign-off during UAT |

---

## 12. Closing message for the client

Sharnam Portal is not “another IT tool.” It is the **spine of your PMC delivery**: the same ISO folders you already use, the same Excel layouts your clients recognise, but with **one login**, **automatic emails**, **contractor participation**, and **every PDF and Excel export filed where admins can find it**.

The transformation journey is deliberate: **CRM → award → setup directory & vendors → seed once → run daily on live registers.** That is how data stops leaking between email, Excel, and site WhatsApp — and how SPDC scales across more projects without more chaos.

---

*Document version: September 2026 · aligns with portal commit `151f0ec` and demo prep sprint.*
