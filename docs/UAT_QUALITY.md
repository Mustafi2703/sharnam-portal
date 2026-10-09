# Quality module — UAT (SPDC)

Run on a clean project (Voltamp) after **Manage → Clear module data** and **Clear Quality & Safety**. Every step says what to do, what must happen, and the screenshot to keep (📸 name). Client files are in `module_prompts/Sharnam_modules_docs 2/`.

**Logins:** office/admin (O), site engineer (S), contractor/vendor (V), client read-only (C), design consultant (D).
**Order matters:** 1 → 12. Each tool feeds the Dashboard and the weekly pack.

## What each tool is for (nothing is duplicated)

| Tab | One job | Client file it follows |
|---|---|---|
| Dashboard | Weekly performance view + the **quality pack** (Excel / PDF / Save to SharePoint) | Quality Dashboard.xlsx |
| Quality files | Browse the ISO 08 SharePoint folder | — |
| SOR Log | Observation / instruction / NCR totals (open, closed, closure %) | Quality Dashboard → SOR Log |
| Site observation | Register of observations (with photos) | Quality Dashboard → SOR |
| Site instruction | Register of instructions | Quality Dashboard → SOR |
| Checklist summary | Fills by discipline | Quality Dashboard → Sheet2 |
| CAR / NCR register | Register of NCR / CAR | NCR 01 → NCR REGISTER, CAR register |
| NCR / CAR fill log | Fill and track each NCR 01 form | NCR 01 → NCR CAR |
| Cube Test | Cube register with automatic dates, strength, average, pass/fail | SPDC CUBE REGISTER |
| QAP | Quality Assurance Plan rows, sign-offs, weekly **Publish quality pack** | Quality Assurance Plan Week 50 |
| Request for Inspection (F-01) | Raise, assign and track the RFI form | SPDC_Request_for_Inspection_Form |
| Quality IR master | Quality checklist templates | QI checklist Excel |
| Site checklist master | Activity checklist templates (F-02) | SPDC_Activity_Inspection_Checklist_Format |
| Fill quality / site checklist | Open the fill window (site, contractor) | — |
| Quality fill log / Site execution fill log | Every fill, review, branded PDF / Excel | — |

Removed as duplicates: *QI & checklist fills* (same F-01 request as the Request for Inspection tab; its old link now redirects), *Site checklists* (launcher for the masters and logs), the repeated link strip above every sheet, and the second "Publish quality pack" button on Cube Test.

## 0. Setup (O)
| # | Step | Expected | 📸 |
|---|---|---|---|
| 0.1 | Project card: client, consultant, **contractor**, PMC filled; directory has one person per role | Header of every export shows these names | Q0-card |
| 0.2 | Quality hub opens; tabs match the table above | No QI & checklist fills / Site checklists tab | Q0-tabs |
| 0.3 | Dashboard before any data | All counts 0, no sample figures anywhere | Q0-empty |

## 1. QAP (O)
| # | Step | Expected | 📸 |
|---|---|---|---|
| 1.1 | Upload `Quality Assurance Plan Week 50.xlsx` | Week 50 rows load by section (≈1,700 lines) | Q1-import |
| 1.2 | **+ Add section**, then **+ Add row** (fill every column; pick from lists) | Row appears under the section | Q1-add |
| 1.3 | Mark a row Done (remarks "Completed" or all days Yes) | Status Done; QAP done count goes up on the Dashboard | Q1-done |
| 1.4 | **Download XLSX** | SPDC-branded workbook, Yes/No colours, drop-downs, project header | Q1-xlsx |
| 1.5 | **Download PDF (HTML)** | Same rows, Sharnam logo | Q1-pdf |

## 2. Request for Inspection F-01 (O raises, D/V/S respond)
| # | Step | Expected | 📸 |
|---|---|---|---|
| 2.1 | Open the tab → form shows sections 1–5 of SPDC/QA/F-01; project, client, contractor pre-filled | Matches the client sheet | Q2-form |
| 2.2 | Fill activity, location, quantity, ITP ref., drawing no.; link a checklist; assign a person from the directory → **Raise** | Appears in the register with an IR number | Q2-raised |
| 2.3 | Assignee (S or V) opens it and fills the linked checklist | Fill appears in the Quality fill log | Q2-fill |
| 2.4 | O records the result A / B / C / D and clearance | Status changes; Approved for A/B | Q2-result |
| 2.5 | Download the branded IR form | F-01 layout, signature blocks | Q2-pdf |
| 2.6 | Delete one test request (O) | Removed from register and SharePoint | Q2-delete |

## 3. Checklists and fill logs (O / S / V)
| # | Step | Expected | 📸 |
|---|---|---|---|
| 3.1 | Quality IR master and Site checklist master list the client templates; open the F-02 "RCC Column" example (32 items) | Items and instructions complete | Q3-master |
| 3.2 | **Fill quality checklist** (S) → every line Yes / No / N/A, ≥3 photos, signature | Saves in the pop-up | Q3-fill |
| 3.3 | Quality fill log: row shows date, status, checklist, progress, actions | Fits the screen, no clipping | Q3-log |
| 3.4 | **More ▾** → Branded PDF, Branded Excel | Both open with project header and photos | Q3-export |
| 3.5 | O: **Approve** (closes linked request) / **Reject** (sends re-fill notice) | Status updates | Q3-review |
| 3.6 | Tick two test fills → **Delete selected** | Gone | Q3-delete |
| 3.7 | Repeat 3.2–3.4 for the Site execution fill log | Same behaviour | Q3-site |

## 4. Site observation and instruction (S raises, V responds, O closes)
| # | Step | Expected | 📸 |
|---|---|---|---|
| 4.1 | Site observation → add one (title, location, severity) with 2 photos | Row + photos shown | Q4-obs |
| 4.2 | Site instruction → add one | Row shown | Q4-ins |
| 4.3 | Close the observation | Closed date set | Q4-close |
| 4.4 | SOR Log | Total / open / closed / closure % match the registers | Q4-sor |

## 5. NCR / CAR (O)
| # | Step | Expected | 📸 |
|---|---|---|---|
| 5.1 | CAR / NCR register → **+ Add row** (NCR 01 fields) | NCR number assigned | Q5-add |
| 5.2 | NCR / CAR fill log → open it and fill the form | NCR 01 layout | Q5-fill |
| 5.3 | Export the NCR as Excel | Branded NCR 01 (matches `NCR 01 .xlsx`) | Q5-xlsx |
| 5.4 | Close the NCR with action taken | Status closed; SOR Log NCR row updates | Q5-close |

## 6. Cube register (S enters, O reviews)
Formulas to check: test date = cast date + 7 / + 28 days; strength = load (kN) ÷ 22.5; average of 3; 7-day pass if ≥ 0.67 × grade; 28-day pass if average ≥ grade.

| # | Step | Expected | 📸 |
|---|---|---|---|
| 6.1 | Header shows project, client, PMC, contractor from the directory | Not blank | Q6-header |
| 6.2 | **Add** a group: cast date, description "Footing F1", grade **M25** | 7-day and 28-day test dates fill automatically | Q6-group |
| 6.3 | 7-day loads **410 / 420 / 405 kN** | 18.22 / 18.67 / 18.00 MPa, average **18.30**, **PASS** | Q6-7day |
| 6.4 | 28-day loads **640 / 650 / 630 kN** | 28.44 / 28.89 / 28.00, average **28.44**, **PASS** | Q6-28day |
| 6.5 | Second group, 28-day loads **520 / 500 / 510** | 23.11 / 22.22 / 22.67, average **22.67**, **FAIL** | Q6-fail |
| 6.6 | Dashboard | Cube charts, set average vs grade, non-conformance due lists the failed set | Q6-dash |
| 6.7 | Edit a load inline | Strength, average and result recalculate | Q6-edit |
| 6.8 | **Download XLSX** and **PDF** | Header filled, every group row complete, no client sample rows | Q6-xlsx |

## 7. Concreting and DPR link (S)
| # | Step | Expected | 📸 |
|---|---|---|---|
| 7.1 | In the DPR add a line "RCC column", unit m3, qty today 12 | Saved | Q7-dpr |
| 7.2 | Dashboard, same week | "Concreting this week" shows 12 m³ | Q7-conc |

## 8. Dashboard and weekly pack (O)
| # | Step | Expected | 📸 |
|---|---|---|---|
| 8.1 | Pick the week | KPIs: concreting, samples, passes, fills, open requests, open NCRs | Q8-kpi |
| 8.2 | Charts: observations open vs closed, cube strength vs limit, fills by day / discipline, NCR by status | Each chart labelled and filled | Q8-charts |
| 8.3 | Success rates, bad-practice photos | Rates and photos from the registers | Q8-rates |
| 8.4 | **Excel** | Dashboard A7 = week concreting, G7/L7/V7 = samples / 7-day pass / 28-day fails, QPI = average closure rate, checklist-by-discipline table, project QAP detail (no sample "Safari" rows) | Q8-xlsx |
| 8.5 | **PDF** | Branded report | Q8-pdf |
| 8.6 | **Save to SharePoint** (dashboard) | File in the ISO 08 Quality folder | Q8-sp |
| 8.7 | QAP → **Publish quality pack** | QAP + cube + dashboard + NCRs in `08 Quality` and `Weekly/{week}` | Q8-pack |

## 9. Roles (C, D, V)
| # | Step | Expected | 📸 |
|---|---|---|---|
| 9.1 | Client opens Quality | View only; no add/delete buttons | Q9-client |
| 9.2 | Contractor fills a checklist and responds to an NCR | Allowed | Q9-vendor |
| 9.3 | Another project's Quality URL | Not found | Q9-isolation |

## 10. SharePoint check (O)
Open `SPDC-VOLTAMP-01 / 08 Quality` and 📸 each: QAP, Cube register, Dashboard, NCRs, Request for Inspection forms, checklist fills, Site observations (photos), `Weekly/{week}`.

## Known gaps (record, do not fail the UAT)
- **Organization Chart** sheet in the client dashboard is empty in the client's own file; the export keeps it blank.
- **NCR register as one Excel** is not offered; each NCR exports on its own, and the register rows are in the Dashboard workbook (CAR register sheet).
- **QPI history** (previous weeks 12, 11, 10) is not stored; only the current week is written.
