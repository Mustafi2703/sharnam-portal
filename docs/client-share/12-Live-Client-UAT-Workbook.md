# Sharnam Portal — Live Client UAT Workbook

**Prepared for:** SPDC / Sharnam PMC  
**Portal (live):** https://portal.spdc.in  
**Demo project:** SPDC-DEMO-01 — Sharnam Demo Dormitory Project  
**Document version:** August 2026 · Rev 01  
**Purpose:** One shared document for client testing — log changes live, tick sign-off, track sessions.

---

## How to use this in Google Docs

1. Open **Google Drive** → create folder: `Sharnam Portal — Client UAT`.
2. **Upload this file** (`.md`) or **copy all text** into a new Google Doc.
   - Google Drive: **New → File upload** → select this file → open with Google Docs (or paste into blank Doc).
3. Rename the Doc: **Sharnam Portal — Live UAT Workbook**.
4. **Share** with SPDC leads and module owners → role **Editor** (so they can type during meetings).
5. Keep **one live copy** — do not email PDFs back and forth; edit this Doc only.
6. After each session: add rows to **Section 2 (Change log)** and tick **Section 4 (Sign-off)** when a page passes.

**Tip:** Pin the Doc in Drive. Use **Table → Insert row** below existing rows when the change log fills up.

---

## Section 1 — Quick access

| Item | Value |
|------|-------|
| Office login | https://portal.spdc.in/login/office |
| Site login | https://portal.spdc.in/login/site |
| Client login | https://portal.spdc.in/login/client |
| Demo password | Demo@1234 (change on production when agreed) |
| Test project | SPDC-DEMO-01 |
| Drawings module | Project → **Drawings** → use tabs: GFC register, Master register, Site register |

**Roles to use in testing**

| Role | Email (demo) | Use for |
|------|--------------|---------|
| Office | office@sharnam.demo | Full module walkthrough, uploads, registers |
| Site | site@sharnam.demo | Field flows, attendance, site checklists |
| Client | client@sharnam.demo | Read-only / client view confirmation |

---

## Section 2 — Live change log (edit every session)

Add a **new row at the top** after each meeting. Dev team marks **Status** when built.

| Date | Module / page | Raised by | Change requested | Priority | Owner | Status | Re-test date |
|------|---------------|-----------|------------------|----------|-------|--------|--------------|
| 2026-08-17 | Drawings · GFC | Client | Many file updates per revision; no duplicate R2 rows | P1 | Dev | Done | |
| 2026-08-17 | Drawings · Register | Client | Master + Site registers from workbook; signatures on upload | P1 | Dev | Done | |
| 2026-08-17 | Drawings · Register | Client | Remove redundant Client register tab | P2 | Dev | Done | |
| 2026-08-17 | Drawings · Checklist log | Client | No Site / Quality / Safety tabs inside Drawings module | P2 | Dev | Done | |
| 2026-08-17 | Drawings · GFC vs Master | Client | Separate GFC upload from master DCI schedule; master filters by package | P1 | Dev | Done | |
| | | | | P1 / P2 / P3 | | Open / In progress / Done / Won't fix / Deferred | |
| | | | | | | | |
| | | | | | | | |

**Status meanings**

| Status | Meaning |
|--------|---------|
| Open | Agreed — not started |
| In progress | Development working |
| Done | Deployed — please re-test |
| Won't fix | Out of scope (note reason in Change column) |
| Deferred | Phase 2 / after go-live |

---

## Section 3 — Session schedule

Tick **Done** when session completed. Write brief notes in the last column.

| # | Session | Suggested attendees | Done | Session date | Notes |
|---|---------|---------------------|:----:|--------------|-------|
| 1 | Master · Directory · Vendors | Office + IT | ☐ | | |
| 2 | **Drawings** (GFC · registers · signatures) | Office + PMC | ☐ | | |
| 3 | Documents (DMS) | Office + Client | ☐ | | |
| 4 | Quality | Office + Client | ☐ | | |
| 5 | Safety | Office + HSE | ☐ | | |
| 6 | Progress | Office + Client | ☐ | | |
| 7 | Field · Photos · Diary | Site + Office | ☐ | | |
| 8 | Comms · Matrix · MoM | Office + Client | ☐ | | |
| 9 | Cost · Finance | Office | ☐ | | |
| 10 | Reports · DPR · WPR | Office + Client | ☐ | | |
| 11 | Closure · Snaglist | Office + Client | ☐ | | |

---

## Section 4 — Module sign-off summary

Mark **Pass** when critical path works on **your project data**. Add name + date when client approves.

| Module | Critical path (short) | Office | Site | Client | Pass | Sign-off name | Date |
|--------|----------------------|:------:|:----:|:------:|:----:|---------------|------|
| Master | Create project, enable modules | ☐ | — | — | ☐ | | |
| **Drawings** | GFC upload, registers, signatures, drawing check | ☐ | ☐ | ☐ | ☐ | | |
| Documents | ISO folders, upload, PDF preview | ☐ | ☐ | ☐ | ☐ | | |
| Quality | Dashboard, SOR, QI, NCR | ☐ | ☐ | ☐ | ☐ | | |
| Safety | Observations, safety NCR | ☐ | ☐ | — | ☐ | | |
| Field | Diary, photos, attendance | ☐ | ☐ | — | ☐ | | |
| Progress | Milestones, schedule | ☐ | — | ☐ | ☐ | | |
| Comms | Matrix → meeting → MoM | ☐ | ☐ | ☐ | ☐ | | |
| Cost | BOQ, MB, cashflow | ☐ | — | — | ☐ | | |
| Finance | PO, RA, invoices | ☐ | — | ☐ | ☐ | | |
| Reports | DPR / WPR PDF | ☐ | — | ☐ | ☐ | | |
| Closure | Snaglist, lessons learnt | ☐ | — | ☐ | ☐ | | |

---

## Section 5 — Drawings module (detailed UAT)

**Excel source:** `DRAWING REGISTER - 01.xlsx` (seeded on demo — 41 master lines)

### 5.1 Workbook → portal (what maps where)

| Your Excel sheet | Where in portal | What to verify |
|------------------|-----------------|----------------|
| Drawing & GFC Drawing Log | **GFC register** | Upload PDF/DWG only — revisions, signatures, publish |
| Master Drawing Register | **Master register** tab | Full DCI schedule — add lines here, **filter by package/building** |
| Site Drawing Register | **Site register** tab | R0–R6 matrix + **signature images** |
| Dashboard sheet | **Register dashboard** | Week KPIs + charts |
| Drawing check master | **Checklist manager** | Pre-upload checklist only (Drawings module) |

**Important:** Do **not** add master DCI rows on the GFC page. Master schedule and GFC file upload are **separate tabs**.

### 5.2 GFC register — step-by-step test

| Step | Action | Expected result | Pass |
|------|--------|-----------------|:----:|
| 1 | Open **Drawings → GFC register** | Title says **GFC register** — no “Add master line” form; link to Master register | ☐ |
| 2 | Expand **Log** on drawing **AR-101** | Upload history; **Site register — receive & issue** block visible when filled | ☐ |
| 3 | Click **Update files** on current revision | Modal shows PDF/DWG + **optional** receive/issue block (badge **Optional**) + signature pads | ☐ |
| 4a | Upload PDF only — skip receive/issue block | Upload succeeds; R column updates; Site register blank for that rev | ☐ |
| 4b | Fill received date, copies, draw **contractor signature**, Save (no new PDF) | Log shows signature thumbnail; Site register updates; no duplicate revision row | ☐ |
| 5 | Upload **new revision** (e.g. R3) | Drawing check runs first; then upload; R3 column fills | ☐ |
| 6 | **Replace PDF** on same revision | Same row updates — not a second R3 line | ☐ |
| 7 | **Export GFC CSV** | R0–Rn columns match screen | ☐ |

### 5.3 Master register — step-by-step test

| Step | Action | Expected result | Pass |
|------|--------|-----------------|:----:|
| 1 | Open **Master register** | 41 lines; full DCI columns; **filters**: package, building, discipline, critical | ☐ |
| 2 | Filter **Package A** | Table shows Package A rows only | ☐ |
| 3 | Add line with all fields (package, dates, issued to, copies) | Row appears; delay auto-calculates if dates filled | ☐ |
| 4 | Find **AR-101** | Package, Building, Rev, Planned, Actual, Delay, Issued to, Copies, Critical | ☐ |
| 5 | After GFC upload on AR-101 | Row updates rev / dates / copies / **GFC link = Linked** | ☐ |

### 5.4 Site register — step-by-step test

**Pending client decision:** Receive/issue dates and contractor/client signatures are **optional** on GFC upload until you confirm whether any fields should be mandatory.

| Step | Action | Expected result | Pass |
|------|--------|-----------------|:----:|
| 1 | Open **Site register** | Matrix: rows = receive/issue details; columns = R0–R6 | ☐ |
| 2 | After optional signature upload on AR-101 | Revision column shows dates, copies, **signature image** | ☐ |
| 3 | Compare with GFC **Log** block | Same dates and signatures when block was filled | ☐ |
| 4 | **Client decision** — record choice | Optional vs mandatory fields (see 5.6) | ☐ |

### 5.5 Drawing checklist (Drawings module only)

| Step | Action | Expected result | Pass |
|------|--------|-----------------|:----:|
| 1 | **Checklist manager** | Drawing check templates only — **no** Quality / Safety tabs | ☐ |
| 2 | **Checklist fill log** | Drawing fills only — **no** Site / Quality / Safety filter pills | ☐ |
| 3 | New revision upload | Checklist required before new rev; not required for same-rev update | ☐ |

### 5.6 Drawings — issues / changes (add rows during testing)

| Date | Page | Issue or change | Pass after fix |
|------|------|-----------------|:--------------:|
| 2026-08-17 | GFC / Site register | Keep receive/issue + signatures **optional** until client confirms workflow | ☐ |
| | GFC register | | ☐ |
| | Master register | | ☐ |
| | Site register | | ☐ |
| | Checklist | | ☐ |
| | Design coordination | | ☐ |
| | | | ☐ |

### 5.7 Drawings — client sign-off

| Page | Approved | Name | Date | Comments |
|------|:--------:|------|------|----------|
| GFC register | ☐ | | | |
| Master register | ☐ | | | |
| Site register | ☐ | | | |
| Register dashboard | ☐ | | | |
| Checklist manager / fill log | ☐ | | | |
| Design coordination | ☐ | | | |
| **Whole Drawings module** | ☐ | | | |

---

## Section 6 — Other modules (summary checklist)

Use one row per issue during your session. Detail is in internal module docs if needed.

### Documents (DMS)

| Test | Pass | Notes |
|------|:----:|-------|
| Browse ISO folder tree | ☐ | |
| Upload PDF — opens in viewer | ☐ | |
| Matrix party sees granted folder | ☐ | |

### Quality

| Test | Pass | Notes |
|------|:----:|-------|
| Quality dashboard KPIs | ☐ | |
| SOR Log tab | ☐ | |
| QI checklist fill + evidence | ☐ | |

### Safety

| Test | Pass | Notes |
|------|:----:|-------|
| Safety dashboard / sheets | ☐ | |
| Safety checklist (separate from Quality) | ☐ | |

### Field

| Test | Pass | Notes |
|------|:----:|-------|
| Site diary | ☐ | |
| Photos upload → SharePoint | ☐ | |
| Attendance punch (site login) | ☐ | |

### Comms · Cost · Finance · Reports · Closure

| Module | Key test | Pass | Notes |
|--------|----------|:----:|-------|
| Comms | Matrix → meeting → MoM | ☐ | |
| Cost | BOQ / cashflow view | ☐ | |
| Finance | PO / RA shell | ☐ | |
| Reports | DPR / WPR PDF | ☐ | |
| Closure | Snaglist register | ☐ | |

---

## Section 7 — Cross-cutting checks (once per UAT cycle)

| Check | Pass | Notes |
|-------|:----:|-------|
| SharePoint upload success (file or attendance photo) | ☐ | |
| PDF opens in-app (not download-only) | ☐ | |
| Audit trail shows upload / publish events | ☐ | |
| Client cannot upload drawings (unless granted) | ☐ | |
| RFI labels: Information vs Inspection correct | ☐ | |

---

## Section 8 — Final project sign-off

| Role | Name | Signature / initial | Date |
|------|------|---------------------|------|
| SPDC Project lead | | | |
| SPDC IT | | | |
| Sharnam / Dev team | | | |

**Go-live recommendation:** ☐ Approved for pilot  ☐ Approved with conditions  ☐ Not yet — list blockers in Section 2

**Conditions / blockers (if any):**

1.  
2.  
3.  

---

## Appendix — Session notes (blank templates)

### Session ___ — Module: ___________

- **Date:**  
- **Attendees:**  
- **Pages reviewed:**  
- **Decisions:**  
- **Actions for dev team:**  

---

*This workbook is the client-facing live document. Internal route-level detail: `docs/client-testing/modules/` in the repo.*

*Related: [03-Module-Test-Plan.md](./03-Module-Test-Plan.md) · [02-Logins-and-Access.md](./02-Logins-and-Access.md) · [10-Master-Documents-Checklist.md](./10-Master-Documents-Checklist.md)*
