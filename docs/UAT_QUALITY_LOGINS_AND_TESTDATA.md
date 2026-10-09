# Quality module — logins, tools and test data

Companion to `UAT_QUALITY.md` (the step-by-step). This file says **who can do what in each tool** and gives **test data taken from the client's own sheets**, so every tester enters the same values and gets the same answers.

Client sheets used (in `module_prompts/Sharnam_modules_docs 2/`): `Quality Assurance Plan Week 50.xlsx`, `SPDC CUBE REGISTER (1).xlsx`, `NCR 01 .xlsx`, `Quality Dashboard.xlsx`, `SPDC_Request_for_Inspection_Form.xlsx`, `SPDC_Activity_Inspection_Checklist_Format.xlsx`.

## 1. Logins

| Code | Login | Role in the portal |
|---|---|---|
| O | Admin / office (your own SPDC login) | Everything |
| E | SPDC staff / planning (`employee`) | Add and edit QAP, cubes, NCR; import files |
| S | Site engineer, e.g. `pratik.solanki@spdc.in` (`site_employee`) | Add and edit QAP, cubes, NCR; fill checklists; site records |
| V | Contractor, e.g. `site@bhavanainfra.demo` (`vendor`) | Site observations / instructions; fills assigned checklists; answers NCRs and RFIs |
| D | Design consultant, e.g. `ak@consultant.demo` | RFIs and design coordination only. **No Quality writes.** |
| C | Client, e.g. `projects@arvind.demo` | Read-only (can raise a concern, sign a report) |

Party logins use `Demo@1234`. SPDC staff keep their own passwords.

## 2. Who can do what in each tool

✅ allowed · 👁 view only · ⛔ blocked (the screen shows "read-only" or the button is missing)

| Tool | O | E | S | V | D | C |
|---|---|---|---|---|---|---|
| Dashboard (week picker, charts, Excel / PDF / Save to SharePoint) | ✅ | ✅ | ✅ | 👁 | 👁 | 👁 |
| QAP: view, download XLSX / PDF | ✅ | ✅ | ✅ | 👁 | 👁 | 👁 |
| QAP: import Week 50 file | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ |
| QAP: add section / row, mark Done, delete | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ |
| QAP: **Publish quality pack** | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ |
| Cube Test: add group, enter loads, edit, delete | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ |
| Cube Test: import cube register file | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ |
| CAR / NCR register: add row | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ |
| NCR: follow-up / close | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| NCR fill log: fill NCR 01 form, export | ✅ | ✅ | ✅ | 👁 | 👁 | 👁 |
| Site observation / Site instruction: add, add photos | ✅ | ✅ | ✅ | ✅ | ⛔ | ⛔ |
| SOR Log (totals) | ✅ | ✅ | ✅ | 👁 | 👁 | 👁 |
| Request for Inspection F-01: raise | ✅ | ✅ | ✅ | ✅ | check — the RFI route allows staff roles, so a consultant may be able to raise one | raise a concern only |
| F-01: respond / record result A-D | ✅ | ✅ | ✅ | ✅ | ✅ (RFIs) | ⛔ |
| Quality IR master / Site checklist master (templates) | ✅ | ✅ | 👁 | 👁 | 👁 | 👁 |
| Fill quality / site checklist (assigned) | ✅ | ✅ | ✅ | ✅ | ⛔ | ⛔ |
| Fill logs: approve / reject / delete | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Quality files (SharePoint folder) | ✅ | ✅ | ✅ | 👁 | 👁 | 👁 |
| Another project's Quality URL | 404 | 404 | 404 | 404 | 404 | 404 |

Run each ⛔ cell as a test: log in as that role, try the action, and screenshot the refusal.
The matrix follows the role checks in the code (QAP, cube, NCR, site records, review and RFI routes were read; the rest are expected behaviour). If a cell behaves differently, record it as a defect and tell us which way it should go.

## 3. Test data

Enter these **exactly**, in the order given. Expected answers are calculated with the client's formulas: strength = load (kN) ÷ 22.5; test dates = cast date + 7 / + 28 days; 7-day passes at ≥ 0.67 × grade; 28-day passes when the average of three is ≥ grade.

### 3.1 QAP (Week 50 file)
**Easiest:** O or E imports `Quality Assurance Plan Week 50.xlsx` — rows load by section.
**By hand** (S or O, **+ Add section** then **+ Add row**), from the client's Week 50 sheet:

| Sr | Activity | Description | Frequency | Code of conformance | Test agency | Contractor | PMC | Client | Records |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Site Survey | Confirmation of Calibrated Equipment | Service agency due date | Approved external agency | QC Engr | QC Engr | Review | Random | Calibration Certificate |
| 1 | Site Survey | Building lay out and setback | Every layout | Approved Drawing | Surveyor | Site Engr | Witness | Witness | Setting out plan |
| 1 | Site Survey | Bench Mark shifting & TBM Preparation | Once established | Client reference | Surveyor | Site engr | Witness | Witness | Level book |
| 2 | Excavation | Disposal of black cotton soil and yellow soil | Every foundation and trench | Client reference | Site Engr | QC Engr | Witness | Random | Work Check List |
| 2 | Excavation | Confirmation for completion of survey activity | Every foundation and trench | Approved Drawing | Site Engr | QC Engr | Witness | Random | Work Check List |

Then: mark row 1 Done with remarks **Completed** → status **Done**; leave the others **Open**.
Expected: the Dashboard QAP done count rises by 1; the XLSX has Yes/No colours and drop-downs.

### 3.2 Cube register (from `SPDC CUBE REGISTER (1).xlsx`)
Header should fill by itself from the project card and directory: project, client, PMC, contractor.

Use grade **M25**. Add each as a group (cast date only — test dates must fill by themselves).

| Group | Cast date | Description | 7-day loads (kN) | Expected 7-day | 28-day loads (kN) | Expected 28-day |
|---|---|---|---|---|---|---|
| 1 | 25-Dec-2025 | FOOTING D-11, D-10, D-9, D-8 | 414.9 / 394.87 / 424.8 | 18.44 / 17.55 / 18.88 → avg **18.29**, PASS | 630 / 571.5 / 652.5 | 28.00 / 25.40 / 29.00 → avg **27.47**, PASS |
| 2 | 26-Dec-2025 | FOOTING D-3, D-2 | 406.8 / 434.92 / 416.925 | 18.08 / 19.33 / 18.53 → avg **18.65**, PASS | 769.5 / 702 / 575.325 | 34.20 / 31.20 / 25.57 → avg **30.32**, PASS |
| 3 | 27-Dec-2025 | FOOTING D-2, C-… | 369.9 / 389.92 / 425.92 | 17.64 / 17.33 / 18.93 → avg **17.97**, PASS | 612 / 569.25 / 578.25 | 27.20 / 25.30 / 25.70 → avg **26.07**, PASS |
| 4 (fail) | 28-Dec-2025 | FOOTING C-9 (test failure) | 388.8 / 437.85 / 428.85 | avg **18.60**, PASS | 520 / 500 / 510 | 23.11 / 22.22 / 22.67 → avg **22.67**, **FAIL** |

Expected test dates: Group 1 → 01-Jan-2026 (7-day) and 22-Jan-2026 (28-day); each later group is one day later.
Checks: group 4 appears under **non-conformance due** on the Dashboard; editing one load recalculates strength, average and result; the Excel has no sample "Burckhardt" rows.
**Import test:** O imports the client file itself; groups 1–N load with the same results.

### 3.3 NCR / CAR (from `NCR 01 .xlsx` register)
Types come from the client's list: **Health and Safety, Environmental, Quality, General**.

| # | Issue date | Type | Contractor | Brief description | Location | Planned closure | Status |
|---|---|---|---|---|---|---|---|
| 1 | 05-Dec-2025 | General | Bhavana Infra | Project schedule: submitted schedule does not match the contract programme | Worker dormitory | 18-Feb-2026 | Open |
| 2 | 05-Dec-2025 | General | Bhavana Infra | Submission of the project schedule for the vaasthu works is incomplete | Worker dormitory | 18-Feb-2026 | Open |
| 3 | 05-Dec-2025 | Quality | Bhavana Infra | Mix design: submitted design does not meet the specified cement content | Worker dormitory | 18-Feb-2026 | Close (actual 26-Feb-2026) |

Checks: NCR number is assigned; the fill log opens the NCR 01 layout; **Export Excel** matches `NCR 01 .xlsx`; closing #1 updates the SOR Log NCR row (total 3, open 1, closed 1 after #3 is closed).

### 3.4 Site observations and instructions (V or S)
| Type | Title | Location | Severity | Photos |
|---|---|---|---|---|
| Observation | Honeycomb at stair landing | Block A, level 1 | High | 2 |
| Observation | Cover blocks missing at column starter bars | Block A, grid C-4 | Medium | 2 |
| Observation | Cube moulds not oiled before casting | Casting yard | Low | 1 |
| Instruction | Stop concreting until pour card is signed | Block A, level 2 | High | 1 |
| Instruction | Re-fix shuttering props before pour | Block A, level 2 | Medium | 0 |

Close the third observation. Expected SOR Log: Site Observation total 3, open 2, closed 1, closure 33%; Site Instruction total 2, open 2.

### 3.5 Request for Inspection F-01 (O raises, V or S responds)
| Field | Value |
|---|---|
| Activity | RCC column — Block A, grid A1–A4 |
| Location | Block A, level 1 |
| Quantity | 42 m³ |
| ITP ref. | ITP-RCC-01 |
| Drawing no. | S-01 (R1) |
| Checklist | RCC Column — Activity Inspection (SPDC/QA/F-02), 32 items |
| Assigned to | Site engineer from the directory |

Steps: raise → assignee fills the F-02 checklist (every line Yes / No / N/A, 3 photos, signature) → O records result **A** with clearance → status Approved → download the branded F-01. Then raise a second request and record result **C** → status Rejected; delete it.

### 3.6 DPR link and concreting
Add to the day's DPR: line **RCC column**, unit **m3**, quantity today **12**. The Dashboard for that week shows **Concreting this week = 12 m³**.

## 4. Order for one tester day

1. O: set up, import QAP and cube files (3.1, 3.2 import) — screenshots of the empty dashboard first.
2. S: add cube groups by hand (3.2), site records (3.4), checklist fill (3.5).
3. V: site observation and instruction (3.4), answer the F-01 (3.5), try a ⛔ action.
4. O: NCRs (3.3), F-01 result, approve fills, pick the week on the Dashboard, export Excel / PDF, **Save to SharePoint**, **Publish quality pack**.
5. D and C: log in, confirm the ⛔ cells, screenshot the refusals.
6. O: open SharePoint `08 Quality` and screenshot the files.

## 5. Record, do not fail
- **Organization Chart** in the client's dashboard workbook is an empty drawing; the export keeps it blank.
- QPI history for previous weeks is not stored; only the current week is written.
- Pie charts in the Excel export are skipped when every row has the same status.
