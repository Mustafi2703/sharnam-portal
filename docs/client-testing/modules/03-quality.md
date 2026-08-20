# Module 03 — Quality

**Test order:** #4  
**Hub:** `/projects/:id/hub/quality`  
**Source workbooks:** `Quality Dashboard.xlsx` · `Quality Assurance Plan Week 50.xlsx` · NCR / Cube registers (seeded on demo)

---

## Tool nav tabs (module strip)

Dashboard · SOR Log · **Site observation** · **Site instruction** · Checklist summary · CAR/NCR register · Cube Test · **Quality Assurance Plan** · QI & checklist fills · Quality checklist master · QI fill log · Request QI fill

> **Separation:** Quality checklists (`QualityInspection`) are **only** under `/quality/checklist-master`. **Drawing check** = Drawings module. **Safety** = Safety module. **Site execution** checklists = Field module. RFIs opened from Quality show **Request QI fill** only (no Ask PMC / drawing / safety pills).

---

## Workbook → portal map

| Client Excel sheet | Portal route | Purpose |
|--------------------|--------------|---------|
| Dashboard | `/inspections` | Week KPIs, concreting, QI fills, charts |
| SOR Log | `?sheet=sor-log` | Site observation summary (live totals from site obs/instruction registers) |
| Site observation | `?sheet=site-observation` | Raise/edit site observations — inline form + popup modal; feeds SOR Log |
| Site instruction | `?sheet=site-instruction` | Raise/edit site instructions — inline form + popup modal; feeds SOR Log |
| Sheet1 + Sheet2 | `?sheet=checklist-summary` | Checklist catalog + filled-by-discipline |
| CAR register / NCR 01 | `?sheet=car-register` | Raise / edit / close NCR & CAR — inline form + popup modal |
| Cube Test / SPDC Cube Register | `?sheet=cube-test` | SPDC grouped specimens — **inline edit**, test agency, pass/fail KPIs, auto sync template |
| QAP Detail + Week 50 | **`/qap`** | Full QAP (~295 rows), daily checks, **Load Week 50 template**, scrollable grid |
| Procore QI + fills | `?sheet=qi` | Raise QI, assignee/office fill, Pass/Fail/N/A |

Legacy `?sheet=qap-detail` redirects to **`/qap`**.

---

## Page: Quality dashboard

| | |
|--|--|
| **Route** | `/projects/:id/inspections` |
| **Purpose** | Quality Performance Report KPIs + pie charts (NCR, cube, QAP, fills). |

### Features

| Feature | Notes |
|---------|-------|
| KPI tiles | Week, concreting m³, samples, open QI, open NCRs |
| QAP open / done | Links to **Quality Assurance Plan** (`/qap`) |
| Charts | NCR/CAR status, cube results, QAP status, fills by discipline/day |
| DPR mapping | Which fills feed DPR/WPR quality section |

### Meeting changes (log in session → dev builds → re-test)

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |
| 2 | | | | Open | ☐ |
| 3 | | | | Open | ☐ |

### Client sign-off
- [ ] Page approved for UAT

---

## Page: SOR Log

| | |
|--|--|
| **Route** | `/projects/:id/inspections?sheet=sor-log` |

Register table from **SOR Log** sheet — observation type, total, open, closed, closure rate. Totals update live when rows are added on **Site observation** or **Site instruction** tabs.

---

## Page: Site observation

| | |
|--|--|
| **Route** | `/projects/:id/inspections?sheet=site-observation` |

Inline add form + **Edit** popup modal. Fields: title, description, location, severity, status, issued to, corrective action. Feeds SOR Log.

| Action | API |
|--------|-----|
| List | `GET /api/checklist/project/:id/quality-site-records?type=Site Observation` |
| Add | `POST .../quality-site-records` |
| Edit | `PATCH .../quality-site-records/:id` |

---

## Page: Site instruction

| | |
|--|--|
| **Route** | `/projects/:id/inspections?sheet=site-instruction` |

Same UX as site observation; record type **Site Instruction**. Feeds SOR Log.

### Meeting changes

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |

---

## Page: Checklist summary

| | |
|--|--|
| **Route** | `/projects/:id/inspections?sheet=checklist-summary` |

Sheet2 live fill counts by discipline + Sheet1 catalog with **onboarded / filled status**. Daily / weekly / monthly fill graphs for DPR. **Onboard all Sheet1 types** creates missing templates in Quality (and Safety / Workpermits in Safety master) and assigns them to the project. Fill log stays at **QI fill log**.

### Meeting changes

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | Client | Catalog must onboard all Sheet1 types; summary shows fill status + daily/weekly/monthly graphs for DPR | P1 | Done | ☐ |

---

## Page: CAR / NCR register

| | |
|--|--|
| **Route** | `/projects/:id/inspections?sheet=car-register` |

### Form: Raise NCR / CAR
| Field | API |
|-------|-----|
| kind (NCR/CAR), number, ncrType, description, location, contractor | `POST /api/checklist/project/:id/ncr` |
| Edit (popup modal) | `PATCH .../ncr/:id` — status, type, description, location, planned/actual closure |
| Close | `PATCH .../ncr/:id` with `status: Closed` |

### Meeting changes

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |

---

## Page: Cube Test

| | |
|--|--|
| **Route** | `/projects/:id/inspections?sheet=cube-test` |
| **Purpose** | SPDC CUBE REGISTER — multiple specimen rows per footing (7-day + 28-day) is **correct layout**. |

### Features

| Feature | Notes |
|---------|-------|
| Auto sync | `POST .../cubes/sync-template` on first open if register empty/partial (~429 specimens) |
| Summary KPIs | Specimens, groups, pass, fail, pending, test agencies logged |
| Inline edit | Sr, cast date, description, grade, **test agency**, weight, loads, strength, result — blur to save |
| Group edit | First row of each footing group updates all specimens in group (Sr, cast, desc, grade, agency) |
| DPR feed | Cubes with cast/test date = report day → DPR quality block (sets, 7d/28d results, agency) |

**API:** `GET .../quality-dashboard` (cubes[]) · `PATCH .../cubes/:id` · `POST .../cubes/sync-template`

### Meeting changes

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Done Aug 2026 | ☐ |

---

## Page: Quality Assurance Plan (QAP)

| | |
|--|--|
| **Route** | `/projects/:id/qap` |
| **Purpose** | **Single QAP page** — Week 50 + Detail sheet layout; full inline edit. |

### Features

| Feature | Notes |
|---------|-------|
| Activity sections | Grouped rows (Site Survey, Reinforcement, …) like Excel |
| Editable columns | Description, frequency, code, test agency, contractor performer/checker, PMC, client, records, remarks, daily checks, status |
| Auto sync | **Load Week 50 template** or auto on open when partial (&lt;250 lines or missing frequency columns) |
| Done / Reopen | Per line (office/admin) |
| Week filter | Week 50 (normalizes W50) |
| Add QAP line | Week, section, description, frequency, code, test agency |
| DMS upload | Master QAP Excel/PDF to quality plans folder |
| Scroll | Wide grid scrolls inside card — sticky header |

**API:** `GET .../quality-dashboard` · `PATCH .../qap/:id` · `POST .../qap/sync-template` · `POST .../qap/import`

### Meeting changes

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |
| 2 | | | | Open | ☐ |
| 3 | | | | Open | ☐ |

### Client sign-off
- [ ] Page approved for UAT

---

## Page: QI & checklist fills

| | |
|--|--|
| **Route** | `/projects/:id/inspections?sheet=qi` |
| **Purpose** | Procore-style quality inspection — **no drawing required**. |

### Form: Raise inspection
| Field | Notes |
|-------|-------|
| title, inspectionType | |
| checklistTemplateId | optional → seeds form lines |
| assignedToId, dueDate, location | **No published drawing dropdown** |
| status | Draft → Mark Ready → fill |

### Form: Checklist lines
| Field | Who can fill |
|-------|----------------|
| Pass / Fail / N/A, remarks, photos | **Assignee** + office/admin/site roles |
| Mark Ready / Close | Office/admin/site |

**API:** `POST /api/inspections/project/:id` · `PATCH .../items/:id`

### Meeting changes

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |
| 2 | | | | Open | ☐ |

---

## Page: Quality checklist master

| | |
|--|--|
| **Route** | `/projects/:id/quality/checklist-master` |
| **Family** | `QualityInspection` only — banner shows Sheet1 catalog count |

### Forms
Create template · Add line items · Excel import · Assign to project · `requirePhotosMin` (default 3 for QI)

### Meeting changes

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |

---

## Page: QI fill log

| | |
|--|--|
| **Route** | `/projects/:id/quality/checklist-logs` |

Branded download of quality checklist submissions — no create forms.

**Branded Excel** fills the real SPDC forms (navy/grey/yellow cells, OK=green, Not OK=red, NA=amber):

- Quality / Activity / Drawing / Site → `SPDC_Request_for_Inspection_Form.xlsx` + `SPDC_Activity_Inspection_Checklist_Format.xlsx`
- Safety → `SPDC_Safety_Inspection_Request_and_Checklists.xlsx`
- Drawing RFI-style → `SPDC_RFI_Form_and_Register.xlsx`

Same colour language as DPR / WPR template fills.

---

## Page: Checklist fill (fullscreen)

| | |
|--|--|
| **Route** | `/projects/:id/checklist/fill/:assignmentId?family=QualityInspection` |

Per-item Yes/No/N.A., remarks, photos → submit. Used from QI fill RFI or assignments.

---

## Page: Request QI fill (RFI)

| | |
|--|--|
| **Route** | `/projects/:id/rfis?kind=QualityInspection` |
| **Purpose** | Quality-scoped RFI — **only** QI checklist fill requests |

### Form
Subject, description, checklist to fill (QI assignments), assignee, vendor — **no linked drawing field**

### Meeting changes

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |

### Client sign-off
- [ ] Module Quality approved for UAT
