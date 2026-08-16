# Global masters vs project seed — what Sharnam needs

Send this to the client PMO so they know **what to prepare once (org-wide)** vs **what to load per new project**.

| Bucket | Upload where | Reused on every project? |
|--------|--------------|---------------------------|
| **Global master** | **Master → Global masters** (office only) | **Yes** — pick / assign, do not re-upload template |
| **Project seed register** | **Project module → Import / seed** | **No** — one copy per project |
| **Not a master** | **Cost → BOQ** (per structure) | **Never global** |

**Rule:** BOQ / monitoring quantities are **always project-specific** (one upload per structure/package). MB and BBS **line templates** are global; quantities are edited on the project after pick.

---

## 1. Global masters (upload once — reuse on all projects)

Office maintains these under **Master module → Global masters** (`/master` → Global masters tab).

### 1.1 Cost measurement line masters

| Master | Portal | Source Excel (typical) | Notes |
|--------|--------|------------------------|-------|
| **MB sheet master** | Master → Global masters → **MB sheets** | Tabs named `* MB` from `SPDC_Budget_Arvind 49.xls` or standalone `.xls` (Dormitory MB, Electric MB, Plumbing MB, …) | Project **Cost → MB** tab → *Add from global master* → pick package lines |
| **BBS sheet master** | Master → Global masters → **BBS sheets** | Tabs named `* BBS` from same budget workbook or standalone BBS `.xls` | Project **Cost → BBS** tab → pick lines; link bend diagrams from shape master |
| **BBS shape code library** | Master → Global masters → **BBS shape codes** | Maintained in portal (code, bend info, optional SVG diagram) | Pairs with BBS rows — not a separate Excel master file |

**Explicitly NOT global:** BOQ / monitoring / GFC qty columns → **Cost → BOQ** per project structure only.

---

### 1.2 Checklist masters (four families)

All live under **Master → Global checklist master** (`/master/checklists`) — one family at a time.

| Master | Family in portal | Reference Excel to seed / upload | Used for |
|--------|------------------|----------------------------------|----------|
| **Drawing check master** | `DrawingCheck` | `Drwing check master checklist.xlt.xls` | Pre-upload gate before GFC revision is accepted |
| **Site / Final Index master** | `SiteExecution` | `Final Index.xlsx` | Site execution checklists filled vs drawing + revision |
| **Quality inspection (QI) master** | `QualityInspection` | Client QI template `.xlsx` (upload via checklist master → Import Excel) | Procore-style quality inspections vs published drawings |
| **Safety checklist master** | `Safety` | Client safety inspection template `.xlsx` (upload via checklist master) | Safety fills with photos + signature |

**After global upload:** on each new project → **Checklist → Assign** (or seed assigns demo templates) so site can fill.

---

### 1.3 Optional global line-item templates

| Master | Portal | When to use |
|--------|--------|-------------|
| **Custom sheet item templates** | `/custom-sheets` (linked from Master → Global masters) | Generic formula registers (payment summary layout, ISO trackers) you want to clone — **not** BOQ |
| **CRM comparative template** | CRM (office) | `Comparative Statement - R2.xlsx` — bid compare only, not construction registers |

---

## 2. QAP — template vs master (important)

| Item | Type | File | Where |
|------|------|------|-------|
| **QAP weekly register** | **Project seed** (not global master today) | `Quality Assurance Plan Week 50.xlsx` | **Quality → QAP** — week rows with Contractor / PMC / Client OK |
| **QAP activity catalog** | Optional reference | Same file or office standard list | Re-import or copy each project; feeds **WPR quality section** |

**Convention:** QAP = planned weekly sign-off register. It is **not** the same as QI checklist master (`QualityInspection` family). NCR stays in **Quality → NCR**; safety observations stay in **Safety**.

If the client wants one standard QAP activity list for all projects, keep a single reference Excel and **re-seed / import per project** when the project starts — do not mix it into BOQ or global MB.

---

## 3. Project-only seed registers (each new project)

Load when setting up **SPDC-xxx** after quotation award. Filenames should match the [10-Master-Documents-Checklist](./10-Master-Documents-Checklist.md) manifest.

### 3.1 Cost (project-specific only)

| Register | File / action | Portal |
|----------|---------------|--------|
| **BOQ / monitoring** | Per-structure Excel from budget (Civil Dormitory, Electric, …) | **Cost → BOQ** — one package name per structure |
| **Cashflow periods** | `Cashflow - Dashboard.xlsx` | Cost → Cashflow |
| **Vendor bills** | `Payment Summary - VIATRIX - Copy.xlsx` | Cost → Vendor bills |

### 3.2 Progress

| Register | File |
|----------|------|
| Planned vs actual | `Planned Vs. Actual Dashboard.xlsx` |
| Progress overview | `Progress Overview.xlsx` |
| Milestones | `Milestone tracking.xlsx` |
| Hindrances | `HInderance Register Dashboard.xlsx` |
| Risks | `Risk Register - Dashboard 1.xlsx` |
| Legal approvals | `Legal Approvals - Dashboard.xlsx` |
| Monthly progress | `Monthly Progress Dashboard.xlsx` |
| Schedule / S-curve | MS Project **XML export** (not Excel master) |

### 3.3 Quality (registers — not checklist master)

| Register | File |
|----------|------|
| Quality dashboard KPIs | `Quality Dashboard.xlsx` |
| NCR / CAR | `NCR 01 .xlsx` |
| Cube tests | `SPDC CUBE REGISTER (1).xlsx` |
| QAP week rows | `Quality Assurance Plan Week 50.xlsx` |

### 3.4 Safety (registers — not checklist master)

| Register | File |
|----------|------|
| Safety dashboard KPIs | `Safety Dashboard.xlsx` |
| Safety NCR / observations | `Safety NCR.xlsx` |

### 3.5 Drawings & closure

| Register | File |
|----------|------|
| Master drawing register | `DRAWING REGISTER - 01.xlsx` |
| GFC / approval log | `Approval  &  GFC Drawing Log.xlsx` |
| Snaglist | `Snaglist - Sharnam PMC.xlsx` |
| Lessons learnt | `Lessons Learnt - Sharnam PMC.xls` |
| Closure report | `Project Closure Report.docx` |

### 3.6 Portal-only (no Excel master)

| Item | Portal |
|------|--------|
| Design coordination issues | Drawings → Design coordination |
| Communication matrix | Comms → Matrix (optional Excel `Communication Matrix_BPCL (1).xlsx`) |
| GFC PDF/DWG files | Drawings → upload per sheet |
| DPR / WPR live data | DPR Maker / WPR Maker (templates `DPR-Sharnam PMC…xlsx`, `WPR File.xlsx` are export layouts only) |

---

## 4. Minimum client pack summary

### Once per organization (global masters)

| # | Deliverable |
|---|-------------|
| 1 | MB sheet templates (all trade packages you measure) |
| 2 | BBS sheet templates (all rebar schedules) |
| 3 | BBS shape code list (or agree portal entry) |
| 4 | `Drwing check master checklist.xlt.xls` |
| 5 | `Final Index.xlsx` |
| 6 | Quality inspection checklist Excel(s) |
| 7 | Safety checklist Excel(s) |

### Per new project (seed registers)

| # | Deliverable |
|---|-------------|
| 1 | BOQ / monitoring **per structure** (not shared global file) |
| 2 | Progress dashboard pack (planned vs actual, milestones, hindrance, risk, legal) |
| 3 | Quality pack (dashboard, NCR, cubes, QAP week) |
| 4 | Safety pack (dashboard, NCR) |
| 5 | `DRAWING REGISTER - 01.xlsx` (+ GFC uploads) |
| 6 | Optional: cashflow, snaglist, lessons learnt, CRM comparative |

---

## 5. New project setup order

```text
1. Office creates project (Master → Projects) + enables modules
2. Global masters already loaded (§1) — assign checklist types to project
3. Cost → upload BOQ per structure
4. Cost → MB / BBS → pick lines from global master
5. Import project seed Excel pack (§3) or run seed sync from Sharnam_modules_docs/
6. Drawings → seed register → publish GFC
7. Site fills checklists · office runs DPR / WPR
```

**Sync command (dev / Hostinger):**

```bash
SHARNAM_EXCEL_ROOT=/path/to/Sharnam_modules_docs node scripts/sync-reference-sheets.mjs
npm run db:seed
```

---

## 6. Related docs

| Doc | Topic |
|-----|-------|
| [10-Master-Documents-Checklist.md](./10-Master-Documents-Checklist.md) | Full filename manifest |
| [05-Sheet-Connection-Maps.md](./05-Sheet-Connection-Maps.md) | BOQ vs MB/BBS global rule |
| [09-Project-Setup-Sheets-Required.md](./09-Project-Setup-Sheets-Required.md) | DPR / WPR minimum uploads |
