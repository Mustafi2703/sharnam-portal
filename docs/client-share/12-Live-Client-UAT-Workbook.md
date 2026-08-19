# Sharnam Portal — Live Client UAT Workbook

**Prepared for:** SPDC / Sharnam PMC  
**Portal (live):** https://portal.spdc.in  
**Demo project:** SPDC-DEMO-01 — Sharnam Demo Dormitory Project  
**Document version:** August 2026 · Rev 01  
**Purpose:** One shared document for client testing — **features + UAT steps per page**, **meeting change stakes** (blank until session), sign-off.

---

## How to use this in Google Docs

1. Open **Google Drive** → create folder: `Sharnam Portal — Client UAT`.
2. **Upload this file** (`.md`) or **copy all text** into a new Google Doc.
3. Rename the Doc: **Sharnam Portal — Live UAT Workbook**.
4. **Share** with SPDC leads and module owners → role **Editor** (so they can type during meetings).
5. Keep **one live copy** — do not email PDFs back and forth; edit this Doc only.

**During the meeting (tomorrow and each session):**

- Walk each **page** in Section 5 (Drawings) or Section 6 (other modules).
- **Do not** edit the feature / test steps — those describe what is built today.
- **Do** add rows under **Meeting changes** on each page you review (blank stakes — fill live).
- Dev team updates **Dev status** → client ticks **Re-test** → tick **Sign-off** when page passes.

**After the meeting:** Dev builds from page stakes; optional copy to Section 2 for one backlog view.

**Tip:** Pin the Doc in Drive. Use **Table → Insert row** when a page stake fills up.

---

## Section 1 — Quick access

| Item | Value |
|------|-------|
| Office login | https://portal.spdc.in/login/office |
| Site login | https://portal.spdc.in/login/site |
| Client login | https://portal.spdc.in/login/client |
| Demo password | Demo@1234 (change on production when agreed) |
| Test project | SPDC-DEMO-01 |
| Drawings module | Project → **Drawings** → use tabs: GFC register, Master register |

**Roles to use in testing**

| Role | Email (demo) | Use for |
|------|--------------|---------|
| Office | office@sharnam.demo | Full module walkthrough, uploads, registers |
| Site | site@sharnam.demo | Field flows, attendance, site checklists |
| Client | client@sharnam.demo | Read-only / client view confirmation |

---

## Section 2 — Session backlog (optional — copy from page stakes)

After each meeting, optionally copy items from **per-page Meeting changes** (Section 5 / 6) here for one dev view. **Do not** use this section as the only place to log — log on each page first.

| Date | Module / page | Raised by | Change requested | Priority | Owner | Dev status | Re-test |
|------|---------------|-----------|------------------|----------|-------|------------|---------|
| | | | | P1 / P2 / P3 | | Open | ☐ |
| | | | | | | | ☐ |
| | | | | | | | ☐ |

**Status meanings**

| Dev status | Meaning |
|------------|---------|
| Open | Logged in meeting — not started |
| In progress | Development working |
| Done | Deployed — please re-test |
| Won't fix | Out of scope (note reason) |
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
| ~~Site Drawing Register~~ | *(removed — client decision)* | Receive/issue + signatures remain on GFC upload log |
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

**Meeting changes — GFC register** *(fill during session)*

| # | Change / issue | Priority | Dev status | Re-test |
|---|----------------|----------|------------|---------|
| 1 | | P1/P2/P3 | Open | ☐ |
| 2 | | | Open | ☐ |
| 3 | | | Open | ☐ |

### 5.3 Master register — step-by-step test

| Step | Action | Expected result | Pass |
|------|--------|-----------------|:----:|
| 1 | Open **Master register** | 41 lines; full DCI columns; **filters**: package, building, discipline, critical | ☐ |
| 2 | Filter **Package A** | Table shows Package A rows only | ☐ |
| 3 | Add line with all fields (package, dates, issued to, copies) | Row appears; delay auto-calculates if dates filled | ☐ |
| 4 | Find **AR-101** | Package, Building, Rev, Planned, Actual, Delay, Issued to, Copies, Critical | ☐ |
| 5 | After GFC upload on AR-101 | Row updates rev / dates / copies / **GFC link = Linked** | ☐ |

**Meeting changes — Master register** *(fill during session)*

| # | Change / issue | Priority | Dev status | Re-test |
|---|----------------|----------|------------|---------|
| 1 | | P1/P2/P3 | Open | ☐ |
| 2 | | | Open | ☐ |
| 3 | | | Open | ☐ |

### 5.4 Site register — step-by-step test

**Pending client decision:** Receive/issue dates and contractor/client signatures are **optional** on GFC upload until you confirm whether any fields should be mandatory.

| Step | Action | Expected result | Pass |
|------|--------|-----------------|:----:|
| 1 | Open **Site register** | Matrix: rows = receive/issue details; columns = R0–R6 | ☐ |
| 2 | After optional signature upload on AR-101 | Revision column shows dates, copies, **signature image** | ☐ |
| 3 | Compare with GFC **Log** block | Same dates and signatures when block was filled | ☐ |
| 4 | **Client decision** — record choice | Optional vs mandatory receive/issue fields | ☐ |

**Meeting changes — Site register** *(fill during session)*

| # | Change / issue | Priority | Dev status | Re-test |
|---|----------------|----------|------------|---------|
| 1 | | P1/P2/P3 | Open | ☐ |
| 2 | | | Open | ☐ |
| 3 | | | Open | ☐ |

### 5.5 Drawing checklist (Drawings module only)

| Step | Action | Expected result | Pass |
|------|--------|-----------------|:----:|
| 1 | **Checklist manager** | Drawing check templates only — **no** Quality / Safety tabs | ☐ |
| 2 | **Checklist fill log** | Drawing fills only — **no** Site / Quality / Safety filter pills | ☐ |
| 3 | New revision upload | Checklist required before new rev; not required for same-rev update | ☐ |

**Meeting changes — Checklist manager / fill log** *(fill during session)*

| # | Change / issue | Priority | Dev status | Re-test |
|---|----------------|----------|------------|---------|
| 1 | | P1/P2/P3 | Open | ☐ |
| 2 | | | Open | ☐ |
| 3 | | | Open | ☐ |

### 5.6 Design coordination

| Feature | Notes |
|---------|-------|
| Log clash / design issue | Discipline, location, linked GFC drawing |
| PDF preview | When GFC PDF uploaded for linked drawing |
| Close / Reopen | Issue status workflow |
| Escalate to Ask RFI | Pre-fills RFI from issue |

**Meeting changes — Design coordination** *(fill during session)*

| # | Change / issue | Priority | Dev status | Re-test |
|---|----------------|----------|------------|---------|
| 1 | | P1/P2/P3 | Open | ☐ |
| 2 | | | Open | ☐ |
| 3 | | | Open | ☐ |

### 5.7 Register dashboard & Drawing files

| Page | Features |
|------|----------|
| Register dashboard | Week KPIs · pie charts by discipline / type / critical |
| Drawing files | SharePoint ISO 04.02 folder browse |

**Meeting changes — Dashboard / Drawing files** *(fill during session)*

| # | Change / issue | Priority | Dev status | Re-test |
|---|----------------|----------|------------|---------|
| 1 | | P1/P2/P3 | Open | ☐ |
| 2 | | | Open | ☐ |
| 3 | | | Open | ☐ |

### 5.8 Drawings — client sign-off

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

For each module session: run the tests, then fill **Meeting changes** rows (do not pre-fill dev history).

### Documents (DMS)

| Test | Pass | Notes |
|------|:----:|-------|
| Browse ISO folder tree | ☐ | |
| Upload PDF — opens in viewer | ☐ | |
| Matrix party sees granted folder | ☐ | |

**Meeting changes — DMS**

| # | Change / issue | Priority | Dev status | Re-test |
|---|----------------|----------|------------|---------|
| 1 | | P1/P2/P3 | Open | ☐ |
| 2 | | | Open | ☐ |

### Quality

| Test | Pass | Notes |
|------|:----:|-------|
| Quality dashboard KPIs | ☐ | `/inspections` |
| SOR Log tab | ☐ | `?sheet=sor-log` — live totals from site obs/instruction |
| **Site observation** | ☐ | `?sheet=site-observation` — inline form + Edit popup |
| **Site instruction** | ☐ | `?sheet=site-instruction` — inline form + Edit popup |
| Checklist summary (Sheet1 catalog) | ☐ | `?sheet=checklist-summary` |
| CAR / NCR register | ☐ | Raise inline + **Edit popup** + close |
| Cube Test register (SPDC format) | ☐ | `?sheet=cube-test` — inline form + Edit popup |
| **Quality Assurance Plan** | ☐ | **`/qap`** — Week 50 columns, daily checks, **Import Excel**, **Download Excel/PDF** |
| RFI branded export | ☐ | Reports → RFI register — full columns + linked drawing |
| QI raise + assignee fill | ☐ | `?sheet=qi` — **no drawing required** |
| Quality checklist master | ☐ | `/quality/checklist-master` — QI family only |
| Request QI fill RFI | ☐ | Scoped page — no Ask PMC / drawing / safety pills |

**Do not test here:** Drawing checklist (Drawings module) · Safety checklist (Safety module) · Site checklists (Field)

**Meeting changes — Quality**

| # | Change / issue | Priority | Dev status | Re-test |
|---|----------------|----------|------------|---------|
| 1 | | P1/P2/P3 | Open | ☐ |
| 2 | | | Open | ☐ |

### Safety

| Test | Pass | Notes |
|------|:----:|-------|
| Safety dashboard / sheets | ☐ | |
| Safety checklist (separate from Quality) | ☐ | |

**Meeting changes — Safety**

| # | Change / issue | Priority | Dev status | Re-test |
|---|----------------|----------|------------|---------|
| 1 | | P1/P2/P3 | Open | ☐ |
| 2 | | | Open | ☐ |

### Field

| Test | Pass | Notes |
|------|:----:|-------|
| Site diary | ☐ | |
| Photos upload → SharePoint | ☐ | |
| Attendance punch (site login) | ☐ | |

**Meeting changes — Field**

| # | Change / issue | Priority | Dev status | Re-test |
|---|----------------|----------|------------|---------|
| 1 | | P1/P2/P3 | Open | ☐ |
| 2 | | | Open | ☐ |

### Progress

| Test | Pass | Notes |
|------|:----:|-------|
| Overview KPIs | ☐ | `/progress` |
| Milestones register | ☐ | `?tab=milestones` |
| **Planned vs Actual — qty register** | ☐ | `?tab=planned` — Wk plan / Wk act (this week, not Cost) |
| Planned vs Actual — weekly manpower | ☐ | Same page |
| Planned vs Actual — RA cashflow table | ☐ | Same pack; **not** Cost cashflow |
| Import / export Excel | ☐ | Client `Planned Vs. Actual Dashboard.xlsx` |
| Monthly / hindrance / risk | ☐ | |

**Do not test here:** Cost BOQ / MB / BBS / Cash Flow Chart (Cost module)

**Meeting changes — Progress**

| # | Change / issue | Priority | Dev status | Re-test |
|---|----------------|----------|------------|---------|
| 1 | | P1/P2/P3 | Open | ☐ |
| 2 | | | Open | ☐ |

### Comms · Cost · Finance · Reports · Closure

| Module | Key test | Pass | Notes |
|--------|----------|:----:|-------|
| Comms | Matrix → meeting → MoM | ☐ | |
| Cost | BOQ / MB / BBS / cashflow (INR months) | ☐ | Not weekly qty PVA |
| Finance | PO / RA shell | ☐ | |
| Reports | DPR / WPR PDF | ☐ | |
| Closure | Snaglist register | ☐ | |

**Meeting changes — Comms / Cost / Finance / Reports / Closure**

| # | Module | Change / issue | Priority | Dev status | Re-test |
|---|--------|----------------|----------|------------|---------|
| 1 | | | P1/P2/P3 | Open | ☐ |
| 2 | | | | Open | ☐ |
| 3 | | | | Open | ☐ |

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

**Go-live recommendation:** ☐ Approved for pilot  ☐ Approved with conditions  ☐ Not yet — list blockers in **page Meeting changes** stakes (Section 5 / 6)

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
