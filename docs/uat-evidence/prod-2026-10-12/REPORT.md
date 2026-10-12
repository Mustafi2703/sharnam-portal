# Production UAT — SHAR/SNT/26-27/Voltamp Transformers Ltd. — 2026-10-12

Portal https://portal.spdc.in (build 56ff1c5) · SharePoint library: https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/SHAR%2FSNT%2F26-27%2FVoltamp%20Transformers%20Ltd.

**38 / 52 steps passed.** Week ending used for the WPR: 2026-10-17.

## Logins used

| Role | Login |
|---|---|
| office | operations@spdc.in |
| site | jaideep.parmar@spdc.in |
| planning | planning.estimation@spdc.in |
| vendor | sanjaythakor.reeca@gmail.com |
| client | deven_mktg@voltamptransformers.com |
| consultant | ashish.chobe@shahntalati.com |

## Steps

| ID | Result | Login | Step | Notes |
|---|---|---|---|---|
| SYS-1 | ✅ | office | Portal health and database | commit 56ff1c5 · 977 users |
| SYS-2 | ✅ | office | SharePoint connected (Sharnam Projects drive) | Sharnam Projects · https://spdcsmb.sharepoint.com/sites/SharnamProjects · drive Documents |
| LOG-office | ✅ | office | office login | Saurabh Prajapati · office · operations@spdc.in |
| LOG-site | ✅ | site | site login | Jaideep Parmar · site_employee · jaideep.parmar@spdc.in |
| LOG-planning | ✅ | planning | planning login | Planning & Estimation · site_employee · planning.estimation@spdc.in |
| LOG-vendor | ✅ | vendor | vendor login | Sanjay Thakor · vendor · sanjaythakor.reeca@gmail.com |
| LOG-client | ✅ | client | client login | Deven Mody · client · deven_mktg@voltamptransformers.com |
| LOG-consultant | ✅ | consultant | consultant login | Ashish Chobe · employee · ashish.chobe@shahntalati.com |
| SET-1 | ✅ | office | Voltamp project, team and contractor link | SHAR/SNT/26-27/Voltamp Transformers Ltd. · 5 members · Reeca linked now |
| SET-2 | ✅ | office | Site pin for attendance geofence | pin set 22.0528, 73.1223 · 500 m (Karjan) |
| ATT-1 | ✅ | site | Jaideep checks in at the Voltamp site (selfie + GPS) | checked in 03:03 · Auto-verified · Karjan , Vadodara |
| DWG-1 | ✅ | office | Import client drawing register (DRAWING REGISTER - 01) | {"lines":41,"source":"DRAWING REGISTER - 01.xlsx","picklists":["drawingTypes","disciplines","delayResponsibility"]} |
| DWG-2 | ✅ | office | Import Approval & GFC drawing log | {"drawings":28,"revisions":51,"skipped":20} |
| DWG-3 | ❌ | office | Add a register line and publish revision R1 (PDF) | revision 400 {"error":"Complete the Drawing Check Master checklist before uploading. Unlock token missing."} |
| DWG-4 | ✅ | office | Register dashboard, Excel and PDF exports | 67 register lines · register 69KB · GFC log xlsx 28KB · GFC log pdf 32KB · register dashboard pdf 30KB |
| DWG-5 | ❌ | office | Drawing registers written to SharePoint 04.02 | The operation was aborted due to timeout |
| DWG-6 | ✅ | office | Design coordination register import (DCI) | created 51 · updated 7 |
| DWG-7 | ✅ | site | Site opens the Drawing Check gate | ARCHITECTURAL DRAWING REVIEW CHECKLIST · 15 checks |
| DWG-8 | ✅ | client | Client sees drawings, cannot add one | sees 27 drawings · add refused 403 |
| RFI-1 | ✅ | office | Office raises two SPDC RFIs to the consultant | SPDC-RFI-002 · SPDC-RFI-003 |
| RFI-2 | ✅ | consultant | Consultant answers the first RFI | answered and closed by consultant |
| RFI-3 | ✅ | client | Client raises a concern | CON-004 · ClientConcern |
| RFI-4 | ✅ | office | RFI register Excel and form exports | ? RFIs · register 113KB · form 113KB (forms auto-filed in 03.06) |
| QA-1 | ✅ | office | Import client QAP sheet (Week 50) | imported 295 lines · Week 50 |
| QA-2 | ✅ | office | Add this week's QAP line, download, publish to SharePoint | excel 31KB · publish {"status":"running","startedAt":"2026-10-12T21:43:07.787Z","weekLabel":null,"files":[]} |
| QA-3 | ❌ | office | Import client cube register, then site adds a cube group | cube import 500 {"error":"Unexpected end of form"} |
| QA-4 | ✅ | site | Site logs a quality observation | UAT 2026-10-12 cover blocks missing at P3 |
| QA-5 | ❌ | site | Site raises NCR to Reeca | ncr 504 <html> |
| QA-6 | ❌ | vendor | Vendor answers from the action desk, cannot close | answer 404 {"error":"NCR not found"} |
| QA-7 | ❌ | office | Office closes the NCR; NCR form PDF | close 404 {"error":"NCR not found"} |
| QA-8 | ❌ | office | Quality dashboard Excel saved to SharePoint 08.01 | SharePoint save (Quality dashboard (6 charts)) 400 {"error":"fetch failed"} |
| SAF-1 | ✅ | site | Site logs today's safety day | manpower 42 · TBT 1 · inductions 3 |
| SAF-2 | ✅ | site | Site issues a safety NCR to Reeca | UAT 2026-10-12 edge protection missing at mezzanine |
| SAF-3 | ✅ | vendor | Vendor records action, cannot close | action saved · close refused 403 |
| SAF-4 | ❌ | office | Office closes safety NCR; week filed to SharePoint | SharePoint save (Safety module Excel) 400 {"error":"fetch failed"} |
| PRG-1 | ✅ | office | Import client Planned vs Actual dashboard | {"manpower":11,"cashflow":8} |
| PRG-2 | ✅ | site | Site adds milestone + hindrance; office adds risk + legal + PvA week | milestone · hindrance · risk · legal · PvA week saved |
| PRG-3 | ✅ | planning | Planning generates the S-curve | 19 points from 68 activities |
| PRG-4 | ❌ | office | Progress Excel saved to SharePoint 07.08 | SharePoint save (Planned vs Actual Excel (charts)) 400 {"error":"fetch failed"} |
| CST-1 | ❌ | office | Import SPDC budget workbook (all tabs) | workbook import 500 {"error":"Cannot require() ES Module /home/u252873650/domains/portal.spdc.in/hbuilds/versions/01a131db-c5b9-731c-9824-be7f00c38d3b/nodejs/seed/costFromBudget.ts in a cycle. A cycle involving require(esm) is not allowed to maintain invariants mandated by the ECMAScript specificati |
| CST-2 | ✅ | office | Office adds budget heading + line and a BOQ item | package Civil |
| CST-3 | ✅ | site | Site MB measurement (nos × nos) and BBS weight | MB 12 × 4 = 48 · BBS 16 mm × 2.4 m × 18 = 68.27 kg |
| CST-4 | ✅ | office | Cashflow period; cost Excels; site cannot take the budget | budget 29KB · boq 28KB · mb 27KB · bbs 27KB · cashflow 29KB · site budget 403, MB 200 |
| CST-5 | ❌ | office | Cost sheets saved to SharePoint (02.05 / 05.01 / 09.02 / 02.07) | SharePoint save (Budget WBS) 400 {"error":"fetch failed"} |
| FIN-1 | ✅ | office | Office adds a work order / PO for Reeca | UAT-PO-REECA-01 |
| FIN-2 | ✅ | vendor | Vendor raises RA bill (refused without workbook, then submitted) | RA-UAT-7779 Submitted · no-file 400 · vendor sees 1 bills |
| FIN-3 | ✅ | office | Office: Certified blocked before Corrected; then Corrected → Certified → COP + PDF | 01/REECA.INFRASTRUCTURE/2026-27 · PO UAT-PO-REECA-01 dt 01 Oct 2026 · net ₹16,38,500 · PDF 33KB |
| FIN-4 | ❌ | office | Payment summary import; COPs and trackers to SharePoint 09.01 | SharePoint save (All COPs (PDF register)) 400 {"error":"fetch failed"} |
| DPR-1 | ✅ | site | Jaideep saves and publishes today's DPR (→ SharePoint 07.02) | 1 lines · Published · 07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records/CIVIL/DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-12.xlsx · excel 55KB |
| WPR-1 | ❌ | office | Office generates WPR Excel / client workbook / PPTX and publishes (→ 10.01) | download.xlsx 500 {"error":"snapWeekEnding is not defined"} |
| CLI-1 | ❌ | client | Client: read-only, sees only Voltamp, can open the WPR | client wpr 500 |
| SP-1 | ✅ | office | SharePoint library sync and folder listing | 23 files written today across 15 ISO folders (see REPORT.md) |

## Files written to SharePoint today

Open the project library above, then the folder; every file below was created or refreshed by this run.

### 04_DESIGN_AND_INFORMATION_MANAGEMENT/04.02_Drawings_and_Specifications

- Approval-GFC-Drawing-Log.pdf
- Approval-GFC-Drawing-Log.xlsx
- Design-Coordination-Register.pdf
- Design-Coordination-Register.xlsx
- Drawing-Check-Master-Log.csv
- DRAWING-REGISTER.csv
- DRAWING-REGISTER-01.xlsx
- DRAWING-REGISTER-Dashboard.pdf
- Master-Drawing-Register.pdf

### 03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/_Registers

- SPDC_RFI_Form_and_Register.xlsx
- SPDC_RFI_Form_and_Register-1791841147254.xlsx
- SPDC_RFI_Form_and_Register-1791841199486.xlsx
- SPDC_RFI_Form_and_Register-1791841248969.xlsx
- SPDC_RFI_Form_and_Register-1791841295924.xlsx
- SPDC_RFI_Form_and_Register-1791841333873.xlsx

### 08_QUALITY_HSE_AND_ENVIRONMENT/08.01_Quality_Plans_and_Inspection_Test_Plans

- 2026-10-12-Quality_Assurance_Plan_Week_50.xlsx
- Quality-Assurance-Plan-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-Week-42.xlsx
- Quality-Assurance-Plan-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-Week-50.xlsx
- Quality-Dashboard-SHAR_SNT_26-27_Voltamp_Transformers_Ltd..xlsx

### 08_QUALITY_HSE_AND_ENVIRONMENT/08.03_Testing_Test_Report_Control

- 2026-10-12-SPDC_CUBE_REGISTER__1_.xlsx
- SPDC-Cube-Register-SHAR_SNT_26-27_Voltamp_Transformers_Ltd..xlsx

### 08_QUALITY_HSE_AND_ENVIRONMENT/08.06_Control_of_Nonconforming_Output

_No files dated today (0 files total, 2 sub-folders)._

### 08_QUALITY_HSE_AND_ENVIRONMENT/08.07_Hazard_Identification_Risk_Assessment

_No files dated today (0 files total, 1 sub-folders)._

### 07_EXECUTION_AND_DELIVERY/07.08_Progress_Measurement_SCurve

- 2026-10-12-Planned_Vs._Actual_Dashboard.xlsx

### 02_PLANNING/02.05_Cost_Estimates_Budget_Development

_No files dated today (0 files total, 0 sub-folders)._

### 02_PLANNING/02.07_Cash_Flow_Forecast_Monitoring

_No files dated today (0 files total, 0 sub-folders)._

### 05_PROCUREMENT_AND_CONTRACTS/05.01_Procurement_Strategy_and_Packages

_No files dated today (0 files total, 0 sub-folders)._

### 09_COMMERCIAL_AND_CHANGE/09.02_Joint_Measurement

_No files dated today (0 files total, 0 sub-folders)._

### 09_COMMERCIAL_AND_CHANGE/09.01_Interim_Bill_Verification_Certification

_No files dated today (0 files total, 1 sub-folders)._

### 07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records

_No files dated today (0 files total, 1 sub-folders)._

### 07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records/CIVIL

- DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-12.xlsx

### 10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.01_Progress_Reporting_MIS

_No files dated today (0 files total, 0 sub-folders)._

## Export paths saved by the run

- **QAP workbook** — `08_QUALITY_HSE_AND_ENVIRONMENT/08.01_Quality_Plans_and_Inspection_Test_Plans`
- **Safety week pack** — `Sharnam Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.07_Hazard_Identification_Risk_Assessment/Weekly/2026-10-12_to_2026-10-12/Safety-Dashboard-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-12.xlsx`
- **Planned vs Actual (client upload archived)** — `07_EXECUTION_AND_DELIVERY/07.08_Progress_Measurement_SCurve/2026-10-12-Planned_Vs._Actual_Dashboard.xlsx` — [open](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B99BD7664-24C1-4893-AE2E-79EC20F06164%7D&file=2026-10-12-Planned_Vs._Actual_Dashboard.xlsx&action=default&mobileredirect=true)
- **DPR 2026-10-12 CIVIL** — `07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records/CIVIL/DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-12.xlsx` — [open](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records/CIVIL/DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-12.xlsx)

## Failures to fix

- **DWG-3** (office) Add a register line and publish revision R1 (PDF) — revision 400 {"error":"Complete the Drawing Check Master checklist before uploading. Unlock token missing."}
- **DWG-5** (office) Drawing registers written to SharePoint 04.02 — The operation was aborted due to timeout
- **QA-3** (office) Import client cube register, then site adds a cube group — cube import 500 {"error":"Unexpected end of form"}
- **QA-5** (site) Site raises NCR to Reeca — ncr 504 <html>
- **QA-6** (vendor) Vendor answers from the action desk, cannot close — answer 404 {"error":"NCR not found"}
- **QA-7** (office) Office closes the NCR; NCR form PDF — close 404 {"error":"NCR not found"}
- **QA-8** (office) Quality dashboard Excel saved to SharePoint 08.01 — SharePoint save (Quality dashboard (6 charts)) 400 {"error":"fetch failed"}
- **SAF-4** (office) Office closes safety NCR; week filed to SharePoint — SharePoint save (Safety module Excel) 400 {"error":"fetch failed"}
- **PRG-4** (office) Progress Excel saved to SharePoint 07.08 — SharePoint save (Planned vs Actual Excel (charts)) 400 {"error":"fetch failed"}
- **CST-1** (office) Import SPDC budget workbook (all tabs) — workbook import 500 {"error":"Cannot require() ES Module /home/u252873650/domains/portal.spdc.in/hbuilds/versions/01a131db-c5b9-731c-9824-be7f00c38d3b/nodejs/seed/costFromBudget.ts in a cycle. A cycle involving require(esm) is not allowed to maintain invariants mandated by the ECMAScript specificati
- **CST-5** (office) Cost sheets saved to SharePoint (02.05 / 05.01 / 09.02 / 02.07) — SharePoint save (Budget WBS) 400 {"error":"fetch failed"}
- **FIN-4** (office) Payment summary import; COPs and trackers to SharePoint 09.01 — SharePoint save (All COPs (PDF register)) 400 {"error":"fetch failed"}
- **WPR-1** (office) Office generates WPR Excel / client workbook / PPTX and publishes (→ 10.01) — download.xlsx 500 {"error":"snapWeekEnding is not defined"}
- **CLI-1** (client) Client: read-only, sees only Voltamp, can open the WPR — client wpr 500
