# Deep production UAT — SHAR/SNT/26-27/Voltamp Transformers Ltd. — 2026-10-13

> **Superseded for handover review.** Workflow + page guide + gap list: [`docs/WORKFLOW_UAT_HANDOVER.md`](../../WORKFLOW_UAT_HANDOVER.md).  
> **Next run (14 Oct):** after WPR chart/matrix co-branding + checklist `sharePointMs:0` + deep-UAT asserts deploy — `UAT_PURGE=1 node scripts/prod-deep-uat.mjs`. WPR client pack must show ≥6 charts, Communication Matrix sheet, ≥2 logos; PPTX co-branded.

Portal https://portal.spdc.in (build ff28b54) · SharePoint library: https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/SHAR%2FSNT%2F26-27%2FVoltamp%20Transformers%20Ltd.

**48 / 61 steps passed.** Project module data was cleared first (team + communication matrix kept). Three working weeks: Week 39 21 Sept–26 Sept · Week 40 28 Sept–03 Oct · Week 41 05 Oct–10 Oct. Every record was created through the portal API by the role that owns it — no client spreadsheets were uploaded.

## Logins used

| Role | Login | Does |
|---|---|---|
| office | operations@spdc.in | PMC desk: registers, closes NCRs/RFIs, certifies bills, WPR |
| site | jaideep.parmar@spdc.in | Jaideep Parmar: attendance, DPRs, RFIs, NCRs, observations, MB |
| planning | planning.estimation@spdc.in | activity register, S-curve |
| vendor | sanjaythakor.reeca@gmail.com | Reeca: checklist fills, NCR responses, RA bills |
| client | deven_mktg@voltamptransformers.com | Voltamp: read-only, concerns, client signature |
| consultant | ashish.chobe@shahntalati.com | Shah & Talati: answers RFIs, markups |

## Steps

| ID | Result | Login | Step | Notes |
|---|---|---|---|---|
| SYS-1 | ✅ | office | Portal health and database | commit ff28b54 · 977 users |
| SYS-2 | ✅ | office | SharePoint connected (Sharnam Projects drive) | Sharnam Projects · drive Documents |
| LOG-office | ✅ | office | office login | Saurabh Prajapati · office · operations@spdc.in |
| LOG-site | ✅ | site | site login | Jaideep Parmar · site_employee · jaideep.parmar@spdc.in |
| LOG-planning | ✅ | planning | planning login | Planning & Estimation · site_employee · planning.estimation@spdc.in |
| LOG-vendor | ✅ | vendor | vendor login | Reeca Infrastructure Pvt. Ltd. · vendor · sanjaythakor.reeca@gmail.com |
| LOG-client | ✅ | client | client login | Deven Mody · client · deven_mktg@voltamptransformers.com |
| LOG-consultant | ✅ | consultant | consultant login | Ashish Chobe · employee · ashish.chobe@shahntalati.com |
| SET-1 | ✅ | office | Voltamp project: team, contractor link, communication matrix | SHAR/SNT/26-27/Voltamp Transformers Ltd. · 6 members · Reeca linked · matrix 11 rows · 5 contacts (Client: Deven Mody, PMC: Nirav Parekh, PMC: Jaideep Parmar, Consultant: Ashish Chobe, Contractor: Sanjay Thakor) |
| SET-2 | ✅ | office | Clear the project's module data from the admin panel (team + communication matrix kept) | cleared · 6 members kept · 11 matrix rows kept · SharePoint files are never deleted by the portal (older files stay; this run's files are listed by date) |
| SET-3 | ✅ | office | Site pin for the attendance geofence | pin 22.0528, 73.1223 · 500 m |
| ATT-1 | ✅ | office | Jaideep's three weeks of site attendance (HR desk back-fills Mon–Fri with the Voltamp site) | 15 days marked present at Voltamp (21 Sept – 09 Oct) |
| ATT-2 | ✅ | site | Jaideep checks in today with selfie + GPS inside the site geofence | checked in 22:54 · Auto-verified · Karjan , Vadodara |
| DWG-1 | ✅ | office | Office builds the master drawing register (9 lines across Architecture / Structure / MEP / PEB) | 9 register lines · 9 enriched with package / type / consultant / dates |
| DWG-2 | ❌ | site | Site engineer passes the Drawing Check gate and uploads R0 PDFs for 5 GFC drawings; office publishes | drawing check 504 <html> |
| DWG-3 | ❌ | site | Week 2: VT-ST-101 revised to R1 after the coordination clash (new Drawing Check, R0 superseded) | drawing check 504 <html> |
| DWG-4 | ✅ | office | Register dashboard + Excel / PDF exports; registers published to SharePoint 04.02 | 9 lines · register xlsx 63KB · GFC log xlsx 26KB · GFC log pdf 30KB · dashboard pdf 30KB · registers publishing in background |
| DWG-5 | ✅ | client | Client sees the published drawings, cannot add or upload | sees 9 drawings · add refused 403 |
| DCI-1 | ❌ | site | Site logs a Structure / MEP clash (pedestal P3 vs cable trench) to the consultant on the matrix, with a drawing markup | markup 504 <html> |
| DCI-2 | ✅ | office | Office sends 5 follow-ups (the 6th is refused) and escalates the issue to an RFI for the consultant | follow-ups 1,2,3,4,5 · 6th refused · escalated by office → SPDC-RFI-001 (assigned to consultant) · re-escalation refused |
| DCI-3 | ❌ | consultant | Consultant answers the escalated RFI with a markup; office closes it and the coordination issue | consultant markup 504 <html> |
| DCI-4 | ✅ | site | Second issue (door swing vs DB panel): 2 follow-ups, resolved without escalation; coordination register exports | issue 2 closed after 2 follow-ups · register xlsx 25KB · pdf 30KB |
| RFI-1 | ✅ | site | Site raises 6 SPDC RFIs over 3 weeks to the consultant on the communication matrix (contractor's proposed solution on each) | refused without solution (400) · SPDC-RFI-002, SPDC-RFI-003, SPDC-RFI-004, SPDC-RFI-005, SPDC-RFI-006, SPDC-RFI-007 |
| RFI-2 | ❌ | office | Office follow-ups to the consultant (per the matrix) and a consultant markup on the anchor-bolt RFI | markup 504 <html> |
| RFI-3 | ✅ | consultant | Consultant answers 4 RFIs (official response); office closes 3, one stays answered-open; 2 remain open with reminders | closed SPDC-RFI-002, SPDC-RFI-003, SPDC-RFI-004 · register {"Open":3,"Answered":1,"Closed":3} · vendor sees ? · client close refused 403 |
| RFI-4 | ✅ | client | Client raises 2 concerns; office answers and closes one | CON-008 answered + closed · CON-009 open |
| RFI-5 | ✅ | office | RFI register Excel / HTML and a filled RFI form; fill log shows the test RFIs | register 114KB · html 37KB · form SPDC-RFI-002 114KB (forms auto-filed under 03.06 Open / Closed) |
| CHK-1 | ❌ | vendor | QI fill-RFI: site asks Reeca to fill the Raft/Footing pre-pour inspection; contractor submits with photos + signature; client signs; office approves and closes the RFI | vendor submit 504 <html> |
| CHK-2 | ❌ | vendor | Site-execution checklists (Anchor bolt fixing — PEB, Pour card) filled by Reeca each week, approved by office | submit Checklist For Anchor Bolt Fixing 504 <html> |
| CHK-3 | ❌ | site | Safety F-01: Reeca requests clearance for work at height; Jaideep inspects (12 lines, photos, signature); office records S1 Cleared | F-01 fill 504 <html> |
| CHK-4 | ❌ | vendor | PPE & induction checklist (3 photos per line) by Reeca; fill log lists every fill with status | submit 504 <html> |
| QA-1 | ✅ | office | QAP: 3 weekly plans × 3 activities (office) → QAP workbook published to 08.01 | 9 QAP lines · xlsx 31KB · published |
| QA-2 | ✅ | site | Cube register: one cast group per week (site), 7-day loads entered for weeks 1–2 (IS 516 strength) | Week 39: 6 specimens · 7-day loads in · Week 40: 6 specimens · 7-day loads in · Week 41: 6 specimens · xlsx 19KB |
| QA-3 | ✅ | site | Site observations + site instructions each week (SOR log); contractor cannot issue an instruction | 6 records (4 closed, 2 open) · vendor instruction refused 403 · xlsx 25KB |
| QA-4 | ✅ | site | Week 1 NCR: site raises → Reeca responds + signs → office follow-up → office verifies and closes with sign-off → NCR form PDF | NCR-682375 · vendor close refused 403 · signed by contractor · closed by office · activity ? events · PDF 31KB |
| QA-5 | ✅ | site | Week 2 CAR (repeat cover-block failures): raised, answered with signature, closed; week 3 NCR left open after the contractor's response | CAR-743105 closed (attn Sanjay Thakor  · Civil  · Reeca Infrastructure Pvt. Ltd.) · NCR-803294 open (contractor answered) · fill log 200 · NCR register 69KB · CAR register 69KB |
| QA-6 | ✅ | office | Quality dashboard (charts) saved to SharePoint 08.01; vendor sees only its own NCRs | NCRs 3 · cubes 24 · vendor desk 3 items · 08_QUALITY_HSE_AND_ENVIRONMENT/08.01_Quality_Plans_and_Inspection_Test_Plans (filed in background) |
| SAF-1 | ✅ | site | Daily safety log for all 15 site days (manpower, TBT, inductions, permits, PPE %) by the site engineer | 15 days logged · manpower 34–64 · 15 toolbox talks |
| SAF-2 | ✅ | site | Safety records across the weeks: unsafe-act observations, a near miss, a toolbox talk record (one per week closed by office) | 6 records · project total 6 |
| SAF-3 | ✅ | site | Week 2 safety NCR: site issues → Reeca records root cause / actions (cannot close) → office closes; form PDF | UAT-2026-10-13 Edge protection missing at the mezzanine slab · vendor close refused 403 · closed by office · PDF 30KB |
| SAF-4 | ✅ | office | Weekly safety packs published for weeks 1–3 (→ 08.07) and the safety module Excel saved to SharePoint | Week 39 35KB · Week 40 35KB · Week 41 35KB |
| PRG-1 | ✅ | planning | Planning sets up the activity register (6 activities with BOQ scope, planned dates, weekly plan) and 6 milestones | 6 activities · 6 milestones |
| PRG-2 | ✅ | site | Hindrances (one per week, site), risks and statutory approvals (office), planned-vs-actual values per week | 3 hindrances (2 resolved) · 3 risks · 2 approvals · 3 PvA weeks |
| PRG-3 | ✅ | planning | Planning generates the S-curve; progress summary; Planned-vs-Actual Excel saved to SharePoint 07.08 | 10 S-curve points · milestones 6 · hindrances 3 · risks 3 · 07_EXECUTION_AND_DELIVERY/07.08_Progress_Measurement_SCurve (filed in background) |
| CST-1 | ✅ | office | Office builds the budget (headings + 6 lines) and the BOQ monitoring sheet (6 items = the activity register) | budget 6 lines · BOQ 6 items · budgeted ₹8,40,00,000 |
| CST-2 | ✅ | site | Site books measurements each week (MB: nos × L × B × H) and bar bending schedule lines; arithmetic checked | 6 MB lines (last 4×12×0.3×0.45 = 6.48 cum) · 4 BBS lines (16 mm × 2.4 m × 18 = 68.27 kg) |
| CST-3 | ✅ | office | Cashflow for the three weeks; cost Excels; site cannot download the budget; sheets saved to SharePoint | budget 29KB · boq 30KB · mb 28KB · bbs 28KB · cashflow 29KB · site budget 403 · 4 sheets in SharePoint |
| FIN-1 | ✅ | office | Work order for Reeca (civil package) | VT/WO/CIV/001 · ₹2,24,00,000 · retention 5% · advance 10% |
| FIN-2 | ❌ | vendor | Week 1: Reeca raises RA-01 with its bill workbook (refused without a file); office Corrected → Certified → Certificate of Payment PDF | ra 504 <html> |
| FIN-3 | ❌ | office | Week 3: measured quantities pushed to the BOQ; office raises RA-02 from the BOQ abstract (MB → bill); vendor sees both bills | ra from boq 400 RA-02 already exists on this project |
| FIN-4 | ❌ | office | COP register PDF, payment summary and PR tracker saved to SharePoint 09.01; finance overview | SharePoint save (All COPs (PDF register)) 400 Export failed (404): {"error":"No COPs yet"} |
| DPR-1 | ✅ | site | Week 39: Jaideep saves + publishes the daily progress report for 5 days (→ SharePoint 07.02/CIVIL), cumulative carried from the previous day | 21 Sept, 22 Sept, 23 Sept, 24 Sept, 25 Sept published · cum excavation 450 cum · man-days to date 175 · carry-forward verified |
| DPR-2 | ✅ | site | Week 40: Jaideep saves + publishes the daily progress report for 5 days (→ SharePoint 07.02/CIVIL), cumulative carried from the previous day | 28 Sept, 29 Sept, 30 Sept, 01 Oct, 02 Oct published · cum excavation 900 cum · man-days to date 353 · carry-forward verified |
| DPR-3 | ✅ | site | Week 41: Jaideep saves + publishes the daily progress report for 5 days (→ SharePoint 07.02/CIVIL), cumulative carried from the previous day | 05 Oct, 06 Oct, 07 Oct, 08 Oct, 09 Oct published · cum excavation 900 cum · man-days to date 532 · carry-forward verified |
| DPR-4 | ✅ | site | 15 published DPRs on the recent list; one DPR Excel downloads; site cannot publish a client's report as client | 15 DPRs published · 09 Oct excel 55KB · client save refused 403 |
| WPR-1 | ✅ | office | Week 39: office builds the weekly report from the DPRs, checks "till previous week" = last week's "till date", publishes xlsx + client pack + PPTX + PDF (→ 10.01) | report no. undefined · 28 sections · 8 executed rows · excavation till prev 0 + week 450 = 450 · wpr.xlsx 110KB · wpr-client.xlsx 163KB · wpr.pptx 2723KB |
| WPR-2 | ✅ | office | Week 40: office builds the weekly report from the DPRs, checks "till previous week" = last week's "till date", publishes xlsx + client pack + PPTX + PDF (→ 10.01) | report no. undefined · 28 sections · 17 executed rows · excavation till prev 450 + week 450 = 900 · wpr.xlsx 110KB · wpr-client.xlsx 163KB · wpr.pptx 2851KB |
| WPR-3 | ✅ | office | Week 41: office builds the weekly report from the DPRs, checks "till previous week" = last week's "till date", publishes xlsx + client pack + PPTX + PDF (→ 10.01) | report no. undefined · 28 sections · 23 executed rows · excavation till prev 900 + week 0 = 900 · wpr.xlsx 111KB · wpr-client.xlsx 163KB · wpr.pptx 2949KB |
| WPR-4 | ❌ | client | Report numbers run 1 → 3; client can open the week-3 WPR but cannot edit | report numbers NaN,NaN,NaN |
| VER-1 | ✅ | client | Client is read-only and sees only Voltamp; vendor sees only its own bills / NCRs | client write refused 403 · client projects SHAR/SNT/26-27/Voltamp Transformers Ltd. · vendor projects 1 · vendor budget 403 |
| VER-2 | ✅ | office | SharePoint library: sync and list every file this run wrote (modified today) across the ISO folders | 320 files written today across 21 folders · DPR files today 31 · 10.01 files today 30 |

## Continuity checks

- DPR day-to-day carry-forward checked on 14 days; 0 mismatches.
- WPR Week 39: ✅ till previous week = last week's till date for all 6 activities
- WPR Week 40: ✅ till previous week = last week's till date for all 6 activities
- WPR Week 41: ✅ till previous week = last week's till date for all 6 activities

## Reports published

| Report | Week | SharePoint path |
|---|---|---|
| WPR no. undefined | Week 39 (w/e 2026-09-27) | `` |
| WPR no. undefined | Week 40 (w/e 2026-10-04) | `` |
| WPR no. undefined | Week 41 (w/e 2026-10-11) | `` |
| DPR | 2026-09-21 (31 man-days) | `` |
| DPR | 2026-09-22 (35 man-days) | `` |
| DPR | 2026-09-23 (37 man-days) | `` |
| DPR | 2026-09-24 (35 man-days) | `` |
| DPR | 2026-09-25 (37 man-days) | `` |
| DPR | 2026-09-28 (36 man-days) | `` |
| DPR | 2026-09-29 (32 man-days) | `` |
| DPR | 2026-09-30 (36 man-days) | `` |
| DPR | 2026-10-01 (38 man-days) | `` |
| DPR | 2026-10-02 (36 man-days) | `` |
| DPR | 2026-10-05 (33 man-days) | `` |
| DPR | 2026-10-06 (37 man-days) | `` |
| DPR | 2026-10-07 (33 man-days) | `` |
| DPR | 2026-10-08 (37 man-days) | `` |
| DPR | 2026-10-09 (39 man-days) | `07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records/CIVIL/DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-09-1791915363772.xlsx` — [open](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records/CIVIL/DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-09.xlsx) |

## Records created (look for these in the portal)

- **drawings**: VT-AR-001
- **rfis**: SPDC-RFI-002, SPDC-RFI-003, SPDC-RFI-004, SPDC-RFI-005, SPDC-RFI-006, SPDC-RFI-007, CON-008
- **ncrs**: NCR-682375, CAR-743105, UAT-2026-10-13 Edge protection missing at the mezzanine slab

## Files written to SharePoint today

Open the project library above, then the folder; every file below was created or refreshed by this run.

### 04_DESIGN_AND_INFORMATION_MANAGEMENT/04.02_Drawings_and_Specifications

- [Approval-GFC-Drawing-Log.pdf](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/04_DESIGN_AND_INFORMATION_MANAGEMENT/04.02_Drawings_and_Specifications/Approval-GFC-Drawing-Log.pdf)
- [Approval-GFC-Drawing-Log.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B12B1BC82-03C4-4071-B86E-DCBF62CBC74C%7D&file=Approval-GFC-Drawing-Log.xlsx&action=default&mobileredirect=true)
- [Design-Coordination-Register.pdf](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/04_DESIGN_AND_INFORMATION_MANAGEMENT/04.02_Drawings_and_Specifications/Design-Coordination-Register.pdf)
- [Design-Coordination-Register.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B840C901E-C3F7-417B-8E32-BDB865F8FEF2%7D&file=Design-Coordination-Register.xlsx&action=default&mobileredirect=true)
- [Drawing-Check-Master-Log.csv](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BDDD3706B-E2D9-43D4-9EC7-12A7F94D2E79%7D&file=Drawing-Check-Master-Log.csv&action=default&mobileredirect=true)
- [DRAWING-REGISTER.csv](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B1EBD7FBE-CA32-4B1B-AAE6-E9DF470F2D7A%7D&file=DRAWING-REGISTER.csv&action=default&mobileredirect=true)
- [DRAWING-REGISTER-01.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B32D27BFC-B087-4E57-81B3-9B2E65E1D0F0%7D&file=DRAWING-REGISTER-01.xlsx&action=default&mobileredirect=true)
- [DRAWING-REGISTER-Dashboard.pdf](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/04_DESIGN_AND_INFORMATION_MANAGEMENT/04.02_Drawings_and_Specifications/DRAWING-REGISTER-Dashboard.pdf)
- [Master-Drawing-Register.pdf](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/04_DESIGN_AND_INFORMATION_MANAGEMENT/04.02_Drawings_and_Specifications/Master-Drawing-Register.pdf)

### 04_DESIGN_AND_INFORMATION_MANAGEMENT/04.04_Clash_Detection_Design_Coordination

_No files dated today (0 files, 1 sub-folders: Markups)._

### 04_DESIGN_AND_INFORMATION_MANAGEMENT/04.04_Clash_Detection_Design_Coordination/Markups

_No files dated today (0 files, 1 sub-folders: VT-ST-101)._

### 03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control

_No files dated today (0 files, 4 sub-folders: _Registers, Closed, Markups, Open)._

### 03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open

- [CON-003_2026-10-12.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/CON-003_2026-10-12.html)
- [CON-003_2026-10-12.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B333C8157-F136-45F9-9FF7-4F0FBA590B43%7D&file=CON-003_2026-10-12.xlsx&action=default&mobileredirect=true)
- [CON-003_2026-10-12-1791847939893.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B92565081-A270-4754-9DFC-1D8DAA6E6EED%7D&file=CON-003_2026-10-12-1791847939893.xlsx&action=default&mobileredirect=true)
- [CON-003_2026-10-12-1791848102011.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/CON-003_2026-10-12-1791848102011.html)
- [CON-004_2026-10-12.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/CON-004_2026-10-12.html)
- [CON-004_2026-10-12.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B68EC0FF2-EAAF-4A50-B6EC-8DCEEABF517B%7D&file=CON-004_2026-10-12.xlsx&action=default&mobileredirect=true)
- [CON-004_2026-10-12-1791846424282.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B1A5AD3DB-21DB-4753-9668-F0BAE4A35CB4%7D&file=CON-004_2026-10-12-1791846424282.xlsx&action=default&mobileredirect=true)
- [CON-004_2026-10-12-1791846509204.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/CON-004_2026-10-12-1791846509204.html)
- [CON-004_2026-10-12-1791848000004.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B5AFD2D1E-DA81-4509-B4AD-C91F319E320F%7D&file=CON-004_2026-10-12-1791848000004.xlsx&action=default&mobileredirect=true)
- [CON-004_2026-10-12-1791848151588.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/CON-004_2026-10-12-1791848151588.html)
- [CON-005_2026-10-12.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/CON-005_2026-10-12.html)
- [CON-005_2026-10-12.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B4CDA6991-28DF-4181-B3B2-23D5443387A0%7D&file=CON-005_2026-10-12.xlsx&action=default&mobileredirect=true)
- [CON-008_2026-10-13.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/CON-008_2026-10-13.html)
- [CON-008_2026-10-13.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B8DE2A1A7-AFD0-4201-B13F-B93EE870115A%7D&file=CON-008_2026-10-13.xlsx&action=default&mobileredirect=true)
- [CON-008_2026-10-13-1791913182799.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B91768536-41F6-4764-BF84-376EA1284CE3%7D&file=CON-008_2026-10-13-1791913182799.xlsx&action=default&mobileredirect=true)
- [CON-008_2026-10-13-1791913313878.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/CON-008_2026-10-13-1791913313878.html)
- [CON-009_2026-10-13.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/CON-009_2026-10-13.html)
- [CON-009_2026-10-13.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B9802DAED-3B76-4D08-96AE-18E729A063B9%7D&file=CON-009_2026-10-13.xlsx&action=default&mobileredirect=true)
- [CON-009_2026-10-13-1791913206486.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B8350936B-8F1D-4DE2-9F93-B45C85634FF5%7D&file=CON-009_2026-10-13-1791913206486.xlsx&action=default&mobileredirect=true)
- [CON-009_2026-10-13-1791913337593.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/CON-009_2026-10-13-1791913337593.html)
- [SPDC-RFI-001_2026-10-12.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/SPDC-RFI-001_2026-10-12.html)
- [SPDC-RFI-001_2026-10-12.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BCBB2E4B7-6190-4D2A-87D7-4B73D9033EF4%7D&file=SPDC-RFI-001_2026-10-12.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-001_2026-10-12-1791846248643.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B8A9A728E-1B77-42EA-A68D-2BF8A5DFFC51%7D&file=SPDC-RFI-001_2026-10-12-1791846248643.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-001_2026-10-12-1791846354808.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/SPDC-RFI-001_2026-10-12-1791846354808.html)
- [SPDC-RFI-001_2026-10-12-1791847818788.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BB5806071-201D-4EE3-A8A8-E771037E7CC0%7D&file=SPDC-RFI-001_2026-10-12-1791847818788.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-001_2026-10-12-1791847970485.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/SPDC-RFI-001_2026-10-12-1791847970485.html)
- [SPDC-RFI-001_2026-10-13.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/SPDC-RFI-001_2026-10-13.html)
- [SPDC-RFI-001_2026-10-13.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B385EC9AE-C73C-4A6C-86CA-8C542A038369%7D&file=SPDC-RFI-001_2026-10-13.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-001_2026-10-13-1791912721419.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B923B0B77-73BE-4FF3-89C1-A3AD72A78229%7D&file=SPDC-RFI-001_2026-10-13-1791912721419.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-001_2026-10-13-1791912818267.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/SPDC-RFI-001_2026-10-13-1791912818267.html)
- [SPDC-RFI-002_2026-10-12.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/SPDC-RFI-002_2026-10-12.html)
- [SPDC-RFI-002_2026-10-12.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BC6D934B5-FB8C-492D-9F5C-2AD68E6D586A%7D&file=SPDC-RFI-002_2026-10-12.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-002_2026-10-12-1791846315645.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B553406B2-0714-401C-A0F1-8B3A6FE2174D%7D&file=SPDC-RFI-002_2026-10-12-1791846315645.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-002_2026-10-12-1791846414628.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/SPDC-RFI-002_2026-10-12-1791846414628.html)
- [SPDC-RFI-002_2026-10-12-1791847879687.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BC62612E8-C8ED-4656-AA76-B0862DDBDC44%7D&file=SPDC-RFI-002_2026-10-12-1791847879687.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-002_2026-10-12-1791848039567.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/SPDC-RFI-002_2026-10-12-1791848039567.html)
- [SPDC-RFI-002_2026-10-13.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/SPDC-RFI-002_2026-10-13.html)
- [SPDC-RFI-002_2026-10-13.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BD38EA15C-0CAA-4CE8-A704-F500B9DCD456%7D&file=SPDC-RFI-002_2026-10-13.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-002_2026-10-13-1791912904450.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BAC0804E3-441E-4597-9F5B-952A3FCC06A0%7D&file=SPDC-RFI-002_2026-10-13-1791912904450.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-002_2026-10-13-1791913000849.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/SPDC-RFI-002_2026-10-13-1791913000849.html)
- [SPDC-RFI-003_2026-10-12.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/SPDC-RFI-003_2026-10-12.html)
- [SPDC-RFI-003_2026-10-12.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B129EBBEF-BD5C-4E76-B50A-D411AEE8F805%7D&file=SPDC-RFI-003_2026-10-12.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-003_2026-10-13.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/SPDC-RFI-003_2026-10-13.html)
- [SPDC-RFI-003_2026-10-13.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BEDAF95F9-883A-4269-AD23-0F086CC158E8%7D&file=SPDC-RFI-003_2026-10-13.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-003_2026-10-13-1791912926475.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BD7C6B7C4-8803-4806-B20C-DA9F0FE1888D%7D&file=SPDC-RFI-003_2026-10-13-1791912926475.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-003_2026-10-13-1791913025234.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/SPDC-RFI-003_2026-10-13-1791913025234.html)
- [SPDC-RFI-004_2026-10-13.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/SPDC-RFI-004_2026-10-13.html)
- [SPDC-RFI-004_2026-10-13.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B9823DAF8-4505-4827-B808-D9D32FB32D6D%7D&file=SPDC-RFI-004_2026-10-13.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-004_2026-10-13-1791912947153.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BB583BF74-1523-4F55-9DFE-6EEA072C390B%7D&file=SPDC-RFI-004_2026-10-13-1791912947153.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-004_2026-10-13-1791913045538.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/SPDC-RFI-004_2026-10-13-1791913045538.html)
- [SPDC-RFI-005_2026-10-13.html](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/SPDC-RFI-005_2026-10-13.html)
- [SPDC-RFI-005_2026-10-13.xlsx](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/SPDC-RFI-005_2026-10-13.xlsx)
- [SPDC-RFI-006_2026-10-13.html](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/SPDC-RFI-006_2026-10-13.html)
- [SPDC-RFI-006_2026-10-13.xlsx](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/SPDC-RFI-006_2026-10-13.xlsx)
- [SPDC-RFI-007_2026-10-13.html](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/SPDC-RFI-007_2026-10-13.html)
- [SPDC-RFI-007_2026-10-13.xlsx](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open/SPDC-RFI-007_2026-10-13.xlsx)

### 03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Closed

- [CON-008_2026-10-13.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Closed/CON-008_2026-10-13.html)
- [CON-008_2026-10-13.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B3DD70E1B-6078-4F24-A98C-9906F7A3E632%7D&file=CON-008_2026-10-13.xlsx&action=default&mobileredirect=true)
- [CON-008_2026-10-13-1791913227489.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BEC20AB08-3111-4237-B6D6-35B3D8D66D99%7D&file=CON-008_2026-10-13-1791913227489.xlsx&action=default&mobileredirect=true)
- [CON-008_2026-10-13-1791913355582.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Closed/CON-008_2026-10-13-1791913355582.html)
- [SPDC-RFI-001_2026-10-13.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Closed/SPDC-RFI-001_2026-10-13.html)
- [SPDC-RFI-001_2026-10-13.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B56470373-3427-44E6-87F2-1E024D581146%7D&file=SPDC-RFI-001_2026-10-13.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-001_CLOSED_2026-10-13.csv](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B2786853B-941E-41DB-84DF-7499B848409B%7D&file=SPDC-RFI-001_CLOSED_2026-10-13.csv&action=default&mobileredirect=true)
- [SPDC-RFI-001_FORM_2026-10-13.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B855DC321-D2DB-4B0D-A28C-D014700CED5A%7D&file=SPDC-RFI-001_FORM_2026-10-13.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-002_2026-10-12.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Closed/SPDC-RFI-002_2026-10-12.html)
- [SPDC-RFI-002_2026-10-12.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BD69E8275-4CBD-4975-BC2A-C1AA9B60DC96%7D&file=SPDC-RFI-002_2026-10-12.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-002_2026-10-13.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Closed/SPDC-RFI-002_2026-10-13.html)
- [SPDC-RFI-002_2026-10-13.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B4E9E3978-4F0B-49B2-9083-B13D9BF44A74%7D&file=SPDC-RFI-002_2026-10-13.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-002_2026-10-13-1791913179683.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B3FCF59B5-31B0-4EE4-9D5E-CF0A9651F3CF%7D&file=SPDC-RFI-002_2026-10-13-1791913179683.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-002_2026-10-13-1791913311734.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Closed/SPDC-RFI-002_2026-10-13-1791913311734.html)
- [SPDC-RFI-002_CLOSED_2026-10-13.csv](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B87BA66A0-F770-426F-B367-B4A4F4527C3E%7D&file=SPDC-RFI-002_CLOSED_2026-10-13.csv&action=default&mobileredirect=true)
- [SPDC-RFI-002_CLOSED_2026-10-13-1791913177107.csv](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B787A08D7-6415-4F0A-989E-E84BAC0CA7A8%7D&file=SPDC-RFI-002_CLOSED_2026-10-13-1791913177107.csv&action=default&mobileredirect=true)
- [SPDC-RFI-002_FORM_2026-10-13.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B22A77589-EA77-4A28-BD57-6951FBAAA5CE%7D&file=SPDC-RFI-002_FORM_2026-10-13.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-002_FORM_2026-10-13-1791913310106.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B4A515699-F7DE-4FF8-854B-F45FE6188B77%7D&file=SPDC-RFI-002_FORM_2026-10-13-1791913310106.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-003_2026-10-13.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Closed/SPDC-RFI-003_2026-10-13.html)
- [SPDC-RFI-003_2026-10-13.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B8D352517-2B66-4525-8ACC-62CCB36CB958%7D&file=SPDC-RFI-003_2026-10-13.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-003_2026-10-13-1791913181001.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B40A2E842-F52C-4881-92B2-65B6B7C9C6CC%7D&file=SPDC-RFI-003_2026-10-13-1791913181001.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-003_2026-10-13-1791913312327.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Closed/SPDC-RFI-003_2026-10-13-1791913312327.html)
- [SPDC-RFI-003_CLOSED_2026-10-13.csv](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B738876B1-FC07-48B8-A612-783F93B20DB7%7D&file=SPDC-RFI-003_CLOSED_2026-10-13.csv&action=default&mobileredirect=true)
- [SPDC-RFI-003_CLOSED_2026-10-13-1791913178074.csv](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B4B46FC3E-A799-4158-B92D-CA339BC7E8F5%7D&file=SPDC-RFI-003_CLOSED_2026-10-13-1791913178074.csv&action=default&mobileredirect=true)
- [SPDC-RFI-003_FORM_2026-10-13.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B5B593D93-2270-4820-AA2B-BCED195E119F%7D&file=SPDC-RFI-003_FORM_2026-10-13.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-003_FORM_2026-10-13-1791913310719.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B632765BF-2D3C-419D-85A5-9A5986030172%7D&file=SPDC-RFI-003_FORM_2026-10-13-1791913310719.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-004_2026-10-13.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Closed/SPDC-RFI-004_2026-10-13.html)
- [SPDC-RFI-004_2026-10-13.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B8C8A6145-CA7C-40DD-A8D9-D45B91F5D2A6%7D&file=SPDC-RFI-004_2026-10-13.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-004_2026-10-13-1791913181869.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BF6CE43C6-6F3B-4A94-AACD-4AF352A293BA%7D&file=SPDC-RFI-004_2026-10-13-1791913181869.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-004_2026-10-13-1791913313244.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Closed/SPDC-RFI-004_2026-10-13-1791913313244.html)
- [SPDC-RFI-004_CLOSED_2026-10-13.csv](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B168188B4-6D65-4CA6-BC35-A619EA6E0574%7D&file=SPDC-RFI-004_CLOSED_2026-10-13.csv&action=default&mobileredirect=true)
- [SPDC-RFI-004_CLOSED_2026-10-13-1791913179092.csv](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B218D4182-AE9D-45D7-8DD9-29EF2518986C%7D&file=SPDC-RFI-004_CLOSED_2026-10-13-1791913179092.csv&action=default&mobileredirect=true)
- [SPDC-RFI-004_FORM_2026-10-13.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BBA7B3882-3284-42E8-80BE-E2BA6B798CD9%7D&file=SPDC-RFI-004_FORM_2026-10-13.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-004_FORM_2026-10-13-1791913311358.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BF0F1EFDA-721E-4FB8-B368-C96474C9C7DE%7D&file=SPDC-RFI-004_FORM_2026-10-13-1791913311358.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-005_2026-10-13.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Closed/SPDC-RFI-005_2026-10-13.html)
- [SPDC-RFI-005_2026-10-13.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BD64DE0CF-7933-4815-A976-A11DAE6A2D5E%7D&file=SPDC-RFI-005_2026-10-13.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-005_2026-10-13-1791913182178.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BAE140C71-A4D2-4A1D-9C03-5C0BF0FFE3CC%7D&file=SPDC-RFI-005_2026-10-13-1791913182178.xlsx&action=default&mobileredirect=true)
- [SPDC-RFI-005_2026-10-13-1791913313560.html](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Closed/SPDC-RFI-005_2026-10-13-1791913313560.html)

### 03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Markups

_No files dated today (0 files, 2 sub-folders: VT-PEB-001, VT-ST-101)._

### 03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/_Registers

- [SPDC_RFI_Form_and_Register.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B37179317-BF8D-44D3-BBC6-3744679259EC%7D&file=SPDC_RFI_Form_and_Register.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791841147254.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B8955B003-B619-46B4-B596-0D1066B45E15%7D&file=SPDC_RFI_Form_and_Register-1791841147254.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791841199486.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BEB1C496A-FDDC-450F-9D15-642BC8867736%7D&file=SPDC_RFI_Form_and_Register-1791841199486.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791841248969.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BD2E06788-2713-417A-A7BE-817FA6BE6538%7D&file=SPDC_RFI_Form_and_Register-1791841248969.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791841295924.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B00D986C5-DAE0-492E-B44F-D7FC41025B5E%7D&file=SPDC_RFI_Form_and_Register-1791841295924.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791841333873.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B3BD0D8E5-79DD-4286-9A87-92C4BB427742%7D&file=SPDC_RFI_Form_and_Register-1791841333873.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791846426279.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B03F62FC7-8495-4DB0-B211-DEBAD0710934%7D&file=SPDC_RFI_Form_and_Register-1791846426279.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791846442750.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BA5CCE722-03EB-4D43-8686-36A76FD9FB25%7D&file=SPDC_RFI_Form_and_Register-1791846442750.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791846467917.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B4B9FBF81-B04B-454E-BF03-56CE53C69E09%7D&file=SPDC_RFI_Form_and_Register-1791846467917.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791846518315.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BA77EA98D-FF63-4AE6-92C2-4A6E04FE66EB%7D&file=SPDC_RFI_Form_and_Register-1791846518315.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791848124370.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B50889140-AE1D-49B3-A170-9DE5364A5AB0%7D&file=SPDC_RFI_Form_and_Register-1791848124370.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791848178268.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B813A96BA-0EF2-4B0E-9CBD-9F7A1A307791%7D&file=SPDC_RFI_Form_and_Register-1791848178268.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791848221798.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B4FA2379D-C0EB-44A9-B815-693545E4284C%7D&file=SPDC_RFI_Form_and_Register-1791848221798.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791848256510.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B1C7C90A0-15E6-4A8E-8F0B-72287E5D01F6%7D&file=SPDC_RFI_Form_and_Register-1791848256510.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791848298128.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BBDDF2457-371A-4DA3-B0D6-F0815047A092%7D&file=SPDC_RFI_Form_and_Register-1791848298128.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791898409855.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B53A7FBC9-0E0E-42A2-BE59-B7DE3FC865D7%7D&file=SPDC_RFI_Form_and_Register-1791898409855.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791898412943.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BC0EC0789-4EF9-4CD9-A7B7-4700D8C9F5F2%7D&file=SPDC_RFI_Form_and_Register-1791898412943.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791898446093.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BCC7ECEEA-510F-43E2-B6A7-AADB5DF0F154%7D&file=SPDC_RFI_Form_and_Register-1791898446093.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791898478007.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BE1C42ADF-565F-46A5-B9AD-A161DBA8CB93%7D&file=SPDC_RFI_Form_and_Register-1791898478007.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791898496260.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BFD57531D-4D6E-4FA0-A07D-735101E8C27F%7D&file=SPDC_RFI_Form_and_Register-1791898496260.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791898497354.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B1C8E20A3-26FD-4C93-A53F-E90A2330F276%7D&file=SPDC_RFI_Form_and_Register-1791898497354.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791898523554.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B2DD56E3B-988E-42F6-9466-87D6AF288B41%7D&file=SPDC_RFI_Form_and_Register-1791898523554.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791898546422.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BBDCF3D4E-CAEC-4AA2-A9AA-193D6BA7F9FA%7D&file=SPDC_RFI_Form_and_Register-1791898546422.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791898634273.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BAE9479E8-E3CC-4421-A82C-5FD2B956C6CE%7D&file=SPDC_RFI_Form_and_Register-1791898634273.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791898635006.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B668220B0-B782-4230-A21A-9BB3E6031241%7D&file=SPDC_RFI_Form_and_Register-1791898635006.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791898635930.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BE6D72E65-5D0C-4E46-A9D9-748198B4DB65%7D&file=SPDC_RFI_Form_and_Register-1791898635930.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791898636500.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B8F8D36A9-B6E0-4FCB-93A9-8C890594F8E9%7D&file=SPDC_RFI_Form_and_Register-1791898636500.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791898637024.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B7D3DC9B7-CFBC-4BF7-BAC1-3DCB0F9AB635%7D&file=SPDC_RFI_Form_and_Register-1791898637024.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791898660853.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B9BA07364-05F6-45DE-BC49-D8F72EE1672E%7D&file=SPDC_RFI_Form_and_Register-1791898660853.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791898684504.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BBE8B5BA5-8987-4FA6-8C8C-0A539DB66111%7D&file=SPDC_RFI_Form_and_Register-1791898684504.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791912909829.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B969E9E59-4720-4FFB-B4B8-5B2934AC5C2B%7D&file=SPDC_RFI_Form_and_Register-1791912909829.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791913013750.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B67BA3369-E4A5-4241-934C-028D4018DEC5%7D&file=SPDC_RFI_Form_and_Register-1791913013750.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791913034775.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BAF16D9F9-069C-4333-9E75-18EA32A88B22%7D&file=SPDC_RFI_Form_and_Register-1791913034775.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791913055257.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B9F515D4E-CF81-40AD-8D0C-A4E00EECCF11%7D&file=SPDC_RFI_Form_and_Register-1791913055257.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791913077368.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B275B4CAC-1375-4161-99D6-656ECDF7D7C4%7D&file=SPDC_RFI_Form_and_Register-1791913077368.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791913100461.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B19F55034-6C49-4888-9E84-54E850A08A4F%7D&file=SPDC_RFI_Form_and_Register-1791913100461.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791913130502.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BE32843DB-7870-48B9-AD46-1D16A0A52DE8%7D&file=SPDC_RFI_Form_and_Register-1791913130502.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791913325111.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B31C51D65-4096-4988-AFBA-A473CE2C62E1%7D&file=SPDC_RFI_Form_and_Register-1791913325111.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791913325915.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B5BCF9FFD-7C9C-4617-951D-37736251CC72%7D&file=SPDC_RFI_Form_and_Register-1791913325915.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791913327056.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B3C21A6DE-AF8E-442B-A1B8-61E6B3D550E8%7D&file=SPDC_RFI_Form_and_Register-1791913327056.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791913327705.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B114E8552-C18F-49BD-9433-87C44662D599%7D&file=SPDC_RFI_Form_and_Register-1791913327705.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791913328300.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B5A35E02F-34EC-4EAE-9F45-1BB8C3F7B2AD%7D&file=SPDC_RFI_Form_and_Register-1791913328300.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791913349374.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B54836E0C-F5C5-405B-A065-E9B4B4AA6213%7D&file=SPDC_RFI_Form_and_Register-1791913349374.xlsx&action=default&mobileredirect=true)
- [SPDC_RFI_Form_and_Register-1791913366886.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B0BF1E2A8-B6A3-4A8B-B517-E9846E0E1568%7D&file=SPDC_RFI_Form_and_Register-1791913366886.xlsx&action=default&mobileredirect=true)

### 08_QUALITY_HSE_AND_ENVIRONMENT/08.01_Quality_Plans_and_Inspection_Test_Plans

- [2026-10-12-Quality_Assurance_Plan_Week_50.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B116A7C4B-402E-40CF-B6DB-7FF5514ED0C2%7D&file=2026-10-12-Quality_Assurance_Plan_Week_50.xlsx&action=default&mobileredirect=true)
- [Quality-Assurance-Plan-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-Week-39.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BA133ED28-4411-421C-A1BB-5E1D225D390C%7D&file=Quality-Assurance-Plan-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-Week-39.xlsx&action=default&mobileredirect=true)
- [Quality-Assurance-Plan-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-Week-40.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BF96C5A62-622E-4BA9-ACCD-37328AB3E917%7D&file=Quality-Assurance-Plan-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-Week-40.xlsx&action=default&mobileredirect=true)
- [Quality-Assurance-Plan-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-Week-41.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BD26D78CD-8538-477A-8439-1550BD91CDE1%7D&file=Quality-Assurance-Plan-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-Week-41.xlsx&action=default&mobileredirect=true)
- [Quality-Assurance-Plan-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-Week-42.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B2BD9839E-633F-4C53-9D66-F3CCEE1CDB23%7D&file=Quality-Assurance-Plan-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-Week-42.xlsx&action=default&mobileredirect=true)
- [Quality-Assurance-Plan-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-Week-43.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BA367D4C7-610C-4CEC-98C1-98D83B6E5F28%7D&file=Quality-Assurance-Plan-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-Week-43.xlsx&action=default&mobileredirect=true)
- [Quality-Assurance-Plan-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-Week-44.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BF494D582-EE5A-4F92-9CA6-D966C9915FD6%7D&file=Quality-Assurance-Plan-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-Week-44.xlsx&action=default&mobileredirect=true)
- [Quality-Assurance-Plan-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-Week-45.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B2138DF44-3E30-46D2-A144-E4DCA1CC8793%7D&file=Quality-Assurance-Plan-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-Week-45.xlsx&action=default&mobileredirect=true)
- [Quality-Assurance-Plan-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-Week-46.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BF73A5F83-27BB-48DE-8AD0-132D0FA26233%7D&file=Quality-Assurance-Plan-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-Week-46.xlsx&action=default&mobileredirect=true)
- [Quality-Assurance-Plan-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-Week-50.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B565075D5-EB69-409B-B749-0E2B5104A398%7D&file=Quality-Assurance-Plan-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-Week-50.xlsx&action=default&mobileredirect=true)
- [Quality-Dashboard-SHAR_SNT_26-27_Voltamp_Transformers_Ltd..xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B2E8843EF-B56C-436E-A9A6-0F9AD8908E9A%7D&file=Quality-Dashboard-SHAR_SNT_26-27_Voltamp_Transformers_Ltd..xlsx&action=default&mobileredirect=true)

### 08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards

- [1.0-1.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/1.0-1.png)
- [1.0-1-1791848225562.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/1.0-1-1791848225562.png)
- [1.0-1-1791898618648.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/1.0-1-1791898618648.png)
- [1.0-1-1791913289281.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/1.0-1-1791913289281.png)
- [1.0-1-1791913333996.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/1.0-1-1791913333996.png)
- [1.0-2.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/1.0-2.png)
- [1.0-2-1791848316196.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/1.0-2-1791848316196.png)
- [1.0-2-1791898807613.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/1.0-2-1791898807613.png)
- [1.0-2-1791913399308.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/1.0-2-1791913399308.png)
- [1.0-2-1791913446133.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/1.0-2-1791913446133.png)
- [1.0-3.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/1.0-3.png)
- [1.0-3-1791848406473.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/1.0-3-1791848406473.png)
- [1.0-3-1791898993718.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/1.0-3-1791898993718.png)
- [1.0-3-1791913513483.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/1.0-3-1791913513483.png)
- [1.0-3-1791913552421.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/1.0-3-1791913552421.png)
- [10-1.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/10-1.png)
- [10-1-1791913707351.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/10-1-1791913707351.png)
- [10-1-1791913734163.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/10-1-1791913734163.png)
- [10-2.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/10-2.png)
- [10-2-1791913789855.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/10-2-1791913789855.png)
- [10-2-1791913818132.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/10-2-1791913818132.png)
- [10-3.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/10-3.png)
- [10-3-1791913878309.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/10-3-1791913878309.png)
- [10-3-1791913910939.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/10-3-1791913910939.png)
- [1-1.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/1-1.png)
- [11-1.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/11-1.png)
- [11-1-1791913977328.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/11-1-1791913977328.png)
- [11-1-1791914011731.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/11-1-1791914011731.png)
- [1-1-1791848506914.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/1-1-1791848506914.png)
- [1-1-1791898871794.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/1-1-1791898871794.png)
- [1-1-1791913607093.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/1-1-1791913607093.png)
- [1-1-1791913616509.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/1-1-1791913616509.png)
- [1-1-1791913672390.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/1-1-1791913672390.png)
- [11-2.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/11-2.png)
- [11-2-1791914077005.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/11-2-1791914077005.png)
- [11-2-1791914109466.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/11-2-1791914109466.png)
- [11-3.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/11-3.png)
- [11-3-1791914166464.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/11-3-1791914166464.png)
- [11-3-1791914199679.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/11-3-1791914199679.png)
- [1-2.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/1-2.png)
- [12-1.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/12-1.png)
- [12-1-1791914252975.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/12-1-1791914252975.png)
- [12-1-1791914285776.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/12-1-1791914285776.png)
- [1-2-1791848616213.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/1-2-1791848616213.png)
- [1-2-1791899051825.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/1-2-1791899051825.png)
- [1-2-1791913657998.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/1-2-1791913657998.png)
- [1-2-1791913668818.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/1-2-1791913668818.png)
- [1-2-1791913745021.png](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/1-2-1791913745021.png)
- [1-3-1791913720579.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/1-3-1791913720579.png)
- [1-3-1791913829097.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/1-3-1791913829097.png)
- [1-3.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/1-3.png)
- [12-2-1791914336857.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/12-2-1791914336857.png)
- [12-2.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/12-2.png)
- [12-3-1791914422675.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/12-3-1791914422675.png)
- [12-3.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/12-3.png)
- [2-1-1791913802887.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/2-1-1791913802887.png)
- [2-1-1791913923402.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/2-1-1791913923402.png)
- [2-1.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/2-1.png)
- [2-2-1791913894575.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/2-2-1791913894575.png)
- [2-2-1791914025471.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/2-2-1791914025471.png)
- [2-2.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/2-2.png)
- [2-3-1791913993080.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/2-3-1791913993080.png)
- [2-3-1791914121130.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/2-3-1791914121130.png)
- [2-3.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/2-3.png)
- [3-1-1791914093389.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/3-1-1791914093389.png)
- [3-1-1791914209474.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/3-1-1791914209474.png)
- [3-1.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/3-1.png)
- [3-2-1791914183676.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/3-2-1791914183676.png)
- [3-2-1791914295025.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/3-2-1791914295025.png)
- [3-2.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/3-2.png)
- [3-3-1791914264736.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/3-3-1791914264736.png)
- [3-3-1791914374092.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/3-3-1791914374092.png)
- [3-3.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/3-3.png)
- [9-1-1791913544539.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/9-1-1791913544539.png)
- [9-1.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/9-1.png)
- [9-2-1791913598095.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/9-2-1791913598095.png)
- [9-2.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/9-2.png)
- [9-3-1791913648075.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/9-3-1791913648075.png)
- [9-3.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/9-3.png)
- [signature-1791912303196.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/signature-1791912303196.png)
- [signature-1791912363518.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/signature-1791912363518.png)
- [signature-1791912425158.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/signature-1791912425158.png)
- [signature-1791913107043.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/signature-1791913107043.png)
- [signature-1791913168818.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/signature-1791913168818.png)
- [signature-1791913229173.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/signature-1791913229173.png)
- [signature-1791913290757.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/signature-1791913290757.png)
- [signature-1791913372253.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/signature-1791913372253.png)
- [signature-1791913434008.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/signature-1791913434008.png)
- [signature-1791913494553.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/signature-1791913494553.png)
- [signature-1791913556638.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/signature-1791913556638.png)
- [signature-1791913619842.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/signature-1791913619842.png)
- [signature.png](/uploads/onedrive/SHAR/SNT/26-27/Voltamp Transformers Ltd./08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards/signature.png)

### 08_QUALITY_HSE_AND_ENVIRONMENT/08.03_Testing_Test_Report_Control

- [2026-10-12-SPDC_CUBE_REGISTER__1_.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BC59E5A51-25B7-4D4F-B923-AC887EB93D63%7D&file=2026-10-12-SPDC_CUBE_REGISTER__1_.xlsx&action=default&mobileredirect=true)
- [SPDC-Cube-Register-SHAR_SNT_26-27_Voltamp_Transformers_Ltd..xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B0E4E8BC1-F108-411A-9DAA-2A53FEFAA0AF%7D&file=SPDC-Cube-Register-SHAR_SNT_26-27_Voltamp_Transformers_Ltd..xlsx&action=default&mobileredirect=true)

### 08_QUALITY_HSE_AND_ENVIRONMENT/08.06_Control_of_Nonconforming_Output

_No files dated today (0 files, 2 sub-folders: Quality, Safety)._

### 08_QUALITY_HSE_AND_ENVIRONMENT/08.07_Hazard_Identification_Risk_Assessment

- [Sharnam-safety-SHAR_SNT_26-27_Voltamp_Transformers_Ltd..xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B4B73E5D2-1539-4422-A28E-E1980029EBE6%7D&file=Sharnam-safety-SHAR_SNT_26-27_Voltamp_Transformers_Ltd..xlsx&action=default&mobileredirect=true)

### 07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records/CIVIL

- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-21.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BC12B537A-F63C-44BF-951B-DA19544C1709%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-21.xlsx&action=default&mobileredirect=true)
- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-21-1791914691440.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B63F01F5F-F361-4435-B341-FD3955DBEEE2%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-21-1791914691440.xlsx&action=default&mobileredirect=true)
- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-22.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BC3049AC3-1708-49D3-B5D0-3A17DD57A3D8%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-22.xlsx&action=default&mobileredirect=true)
- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-22-1791914733512.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B782B75E5-3B09-4D33-8956-B5F5FE971D3C%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-22-1791914733512.xlsx&action=default&mobileredirect=true)
- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-23.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BE29667E2-D488-457D-94A6-061EDAAFF91F%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-23.xlsx&action=default&mobileredirect=true)
- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-23-1791914781572.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B49D12D78-A2F4-46D2-B829-5F85CCEA6BAE%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-23-1791914781572.xlsx&action=default&mobileredirect=true)
- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-24.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B2BE3BBD8-650B-46DE-B68F-C4474B1C3C2D%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-24.xlsx&action=default&mobileredirect=true)
- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-24-1791914833836.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B44411697-3F64-4167-8123-3B1B2F5D9178%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-24-1791914833836.xlsx&action=default&mobileredirect=true)
- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-25.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B17B0168D-B1D7-4AED-B840-EB6605612100%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-25.xlsx&action=default&mobileredirect=true)
- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-25-1791914880725.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B63A20A6C-7F60-4ED6-9E68-C8736956064C%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-25-1791914880725.xlsx&action=default&mobileredirect=true)
- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-28.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BD27BED2D-0DFF-407D-AD69-86D793518749%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-28.xlsx&action=default&mobileredirect=true)
- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-28-1791914932847.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B0F80AAA6-508D-4641-856B-9D9D232B18DB%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-28-1791914932847.xlsx&action=default&mobileredirect=true)
- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-29.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BEB4EEAF2-CC77-426B-9B53-B0C1C042CE92%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-29.xlsx&action=default&mobileredirect=true)
- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-29-1791914983674.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B9112BA84-E442-45BC-8EE5-E2DCB5ABDE25%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-29-1791914983674.xlsx&action=default&mobileredirect=true)
- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-30.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BC70C83AC-9897-4E68-9ADD-0754F2B0E5E6%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-30.xlsx&action=default&mobileredirect=true)
- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-30-1791915030568.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B3659A131-58E6-44BC-A5A9-5E3B1F393368%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-09-30-1791915030568.xlsx&action=default&mobileredirect=true)
- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-01.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B9E2A22BE-AB82-4BD7-8400-05DD54B646AA%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-01.xlsx&action=default&mobileredirect=true)
- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-01-1791915083125.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BAE11B047-3DC7-4840-8840-F7D8327F992C%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-01-1791915083125.xlsx&action=default&mobileredirect=true)
- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-02.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BB93D1605-9813-4A36-B16E-DB9B2CE79089%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-02.xlsx&action=default&mobileredirect=true)
- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-02-1791915132616.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B79F63EF8-9590-492D-8A0B-25F453ADD267%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-02-1791915132616.xlsx&action=default&mobileredirect=true)
- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-05.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B5C0BF926-CB21-4C4E-A7CC-B95DCFAAD9EB%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-05.xlsx&action=default&mobileredirect=true)
- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-05-1791915176571.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B264370D1-57F7-46DD-991F-A70D29CB9BB4%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-05-1791915176571.xlsx&action=default&mobileredirect=true)
- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-06.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BF2CC5324-7D32-4B0B-B83F-E48546644F13%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-06.xlsx&action=default&mobileredirect=true)
- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-06-1791915227434.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BFCB6EAB8-D415-47DB-8763-0C16162EB0C4%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-06-1791915227434.xlsx&action=default&mobileredirect=true)
- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-07.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B12F264FF-1FB9-4432-9AD0-FAEC4CA87525%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-07.xlsx&action=default&mobileredirect=true)
- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-07-1791915278466.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B3C1CC65C-250A-47BC-A038-691E3D82962E%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-07-1791915278466.xlsx&action=default&mobileredirect=true)
- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-08.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B112C183E-4F16-4A9A-9F14-2538194A7F06%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-08.xlsx&action=default&mobileredirect=true)
- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-08-1791915325641.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B77921924-1D34-4A64-8DFE-21CA6D620581%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-08-1791915325641.xlsx&action=default&mobileredirect=true)
- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-09.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BC880055E-A935-49F2-A4BF-F827C1493DBC%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-09.xlsx&action=default&mobileredirect=true)
- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-09-1791915363772.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B58B7BD48-7E0B-45EF-BE35-AE743CA9B5C5%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-09-1791915363772.xlsx&action=default&mobileredirect=true)
- [DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-12.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B32823CA2-5507-467D-BAA8-9A44AE5528AC%7D&file=DPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-CIVIL-2026-10-12.xlsx&action=default&mobileredirect=true)

### 07_EXECUTION_AND_DELIVERY/07.08_Progress_Measurement_SCurve

- [2026-10-12-Planned_Vs._Actual_Dashboard.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B99BD7664-24C1-4893-AE2E-79EC20F06164%7D&file=2026-10-12-Planned_Vs._Actual_Dashboard.xlsx&action=default&mobileredirect=true)
- [Planned-Vs-Actual-SHAR_SNT_26-27_Voltamp_Transformers_Ltd..xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B6C31E24F-04CF-47D9-BFFD-E21CE63A2230%7D&file=Planned-Vs-Actual-SHAR_SNT_26-27_Voltamp_Transformers_Ltd..xlsx&action=default&mobileredirect=true)

### 02_PLANNING/02.05_Cost_Estimates_Budget_Development

- [Budget-WBS.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BD179B083-75DE-445B-BDA3-FB6C0AB3ECD9%7D&file=Budget-WBS.xlsx&action=default&mobileredirect=true)

### 02_PLANNING/02.07_Cash_Flow_Forecast_Monitoring

- [Cashflow.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B6A0B72C0-85C8-4FE1-814D-5F1AEB200F44%7D&file=Cashflow.xlsx&action=default&mobileredirect=true)

### 05_PROCUREMENT_AND_CONTRACTS/05.01_Procurement_Strategy_and_Packages

- [BOQ-all.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BE0D59774-F592-48DE-9494-6E44A9E1CB20%7D&file=BOQ-all.xlsx&action=default&mobileredirect=true)

### 09_COMMERCIAL_AND_CHANGE/09.02_Joint_Measurement

- [MB-all.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B1D9D5BBC-BCCC-4383-BA86-B973D3CA73C4%7D&file=MB-all.xlsx&action=default&mobileredirect=true)

### 09_COMMERCIAL_AND_CHANGE/09.01_Interim_Bill_Verification_Certification

_No files dated today (0 files, 3 sub-folders: RA-RA-01, RA-RA-02, RA-RA-UAT-7779)._

### 10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.01_Progress_Reporting_MIS

- [_wpr_pdf_1791900349998.pptx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B8992B8BD-7B39-4C36-94BC-F561818233BA%7D&file=_wpr_pdf_1791900349998.pptx&action=edit&mobileredirect=true)
- [_wpr_pdf_1791900425752.pptx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B192D8BBC-8BC2-470B-A9F0-26638021E2B7%7D&file=_wpr_pdf_1791900425752.pptx&action=edit&mobileredirect=true)
- [_wpr_pdf_1791900491873.pptx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BEC9DFD4D-0ED6-4505-9F55-951AF5A741CD%7D&file=_wpr_pdf_1791900491873.pptx&action=edit&mobileredirect=true)
- [_wpr_pdf_1791915454096.pptx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BFC5E784D-B41F-403C-A5E5-6DA5614674BE%7D&file=_wpr_pdf_1791915454096.pptx&action=edit&mobileredirect=true)
- [_wpr_pdf_1791915520082.pptx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B60A68DC2-D137-406D-B7AC-5C7AEEAAD0E5%7D&file=_wpr_pdf_1791915520082.pptx&action=edit&mobileredirect=true)
- [_wpr_pdf_1791915581437.pptx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B9CD3FB3F-27B5-496A-8F5D-C048C8B8D319%7D&file=_wpr_pdf_1791915581437.pptx&action=edit&mobileredirect=true)
- [WPR-ClientPack-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-09-27.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B3DD935FB-0749-41F1-9093-3142A44362CD%7D&file=WPR-ClientPack-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-09-27.xlsx&action=default&mobileredirect=true)
- [WPR-ClientPack-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-09-27-1791915416864.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BA3257C69-FF06-4D5F-AB1B-54C4135C24F1%7D&file=WPR-ClientPack-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-09-27-1791915416864.xlsx&action=default&mobileredirect=true)
- [WPR-ClientPack-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-04.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B1BF76C68-1E16-4ADC-BC4E-6A67C840F919%7D&file=WPR-ClientPack-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-04.xlsx&action=default&mobileredirect=true)
- [WPR-ClientPack-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-04-1791915486312.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B6983EBEC-3F61-4202-B209-1A9FB72E2BF9%7D&file=WPR-ClientPack-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-04-1791915486312.xlsx&action=default&mobileredirect=true)
- [WPR-ClientPack-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-11.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BDCB22510-9D0C-4913-B693-CFA1B8569179%7D&file=WPR-ClientPack-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-11.xlsx&action=default&mobileredirect=true)
- [WPR-ClientPack-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-11-1791915536527.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B0895B54D-4A96-424A-BFA6-B0F31B613D68%7D&file=WPR-ClientPack-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-11-1791915536527.xlsx&action=default&mobileredirect=true)
- [WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-09-27.pdf](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.01_Progress_Reporting_MIS/WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-09-27.pdf)
- [WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-09-27.pptx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BD03A958B-16DD-43F4-86E6-660F2E197F41%7D&file=WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-09-27.pptx&action=edit&mobileredirect=true)
- [WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-09-27.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BA94B0028-9A39-427B-AAB3-0FF80A95679D%7D&file=WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-09-27.xlsx&action=default&mobileredirect=true)
- [WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-09-27-1791915391351.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B98CA876B-4618-4C25-8376-DAB2C9250649%7D&file=WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-09-27-1791915391351.xlsx&action=default&mobileredirect=true)
- [WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-09-27-1791915445032.pptx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B3383F7B1-3156-4659-B7E7-F2679D8FB505%7D&file=WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-09-27-1791915445032.pptx&action=edit&mobileredirect=true)
- [WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-09-27-1791915520741.pdf](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.01_Progress_Reporting_MIS/WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-09-27-1791915520741.pdf)
- [WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-04.pdf](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.01_Progress_Reporting_MIS/WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-04.pdf)
- [WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-04.pptx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BE56F0210-F1E4-4C5B-B3B3-94351B77BED8%7D&file=WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-04.pptx&action=edit&mobileredirect=true)
- [WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-04.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BF9A2F3D6-E4C3-4345-ADA3-DB94A4D11BBC%7D&file=WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-04.xlsx&action=default&mobileredirect=true)
- [WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-04-1791915447295.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BF427751A-9451-4C1A-924D-78D2D3EB5020%7D&file=WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-04-1791915447295.xlsx&action=default&mobileredirect=true)
- [WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-04-1791915515900.pptx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B8E7708F0-5E12-4525-B063-6A84583C70D3%7D&file=WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-04-1791915515900.pptx&action=edit&mobileredirect=true)
- [WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-04-1791915597706.pdf](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.01_Progress_Reporting_MIS/WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-04-1791915597706.pdf)
- [WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-11.pdf](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.01_Progress_Reporting_MIS/WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-11.pdf)
- [WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-11.pptx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B8A7CD5B8-42DE-4289-8AF6-9115D2DAAFD1%7D&file=WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-11.pptx&action=edit&mobileredirect=true)
- [WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-11.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7B273D8AA2-2240-4F00-9A95-A02AA1375256%7D&file=WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-11.xlsx&action=default&mobileredirect=true)
- [WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-11-1791915503866.xlsx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BA2EBB468-74EA-4E04-A37A-EA71817A2E88%7D&file=WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-11-1791915503866.xlsx&action=default&mobileredirect=true)
- [WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-11-1791915576935.pptx](https://spdcsmb.sharepoint.com/sites/SharnamProjects/_layouts/15/Doc.aspx?sourcedoc=%7BCA41BEB8-557D-4D8F-A676-E44DE1729447%7D&file=WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-11-1791915576935.pptx&action=edit&mobileredirect=true)
- [WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-11-1791915669782.pdf](https://spdcsmb.sharepoint.com/sites/SharnamProjects/Shared%20Documents/Sharnam%20Portal/SHAR_SNT_26-27_Voltamp_Transformers_Ltd/10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.01_Progress_Reporting_MIS/WPR-SHAR_SNT_26-27_Voltamp_Transformers_Ltd.-2026-10-11-1791915669782.pdf)

## Export paths saved by the run

- **Master drawing register + GFC log (live + weekly copy)** — `04_DESIGN_AND_INFORMATION_MANAGEMENT/04.02_Drawings_and_Specifications`
- **Design coordination register (auto-published)** — `04_DESIGN_AND_INFORMATION_MANAGEMENT/04.04_Clash_Detection_Design_Coordination`
- **SPDC RFI forms (Open / Closed) + register** — `03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control`
- **QAP workbook + quality dashboard** — `08_QUALITY_HSE_AND_ENVIRONMENT/08.01_Quality_Plans_and_Inspection_Test_Plans`
- **Cube register (client format)** — `08_QUALITY_HSE_AND_ENVIRONMENT/08.03_Testing_Test_Report_Control`
- **NCR / CAR forms + register** — `08_QUALITY_HSE_AND_ENVIRONMENT/08.06_Control_of_Nonconforming_Output`
- **NCR register + CAR register (separate, NCR 01 layout)** — `08_QUALITY_HSE_AND_ENVIRONMENT/08.06_Control_of_Nonconforming_Output/Quality/_Registers (SPDC_NCR_Register.xlsx · SPDC_CAR_Register.xlsx)`
- **Quality dashboard (charts)** — `08_QUALITY_HSE_AND_ENVIRONMENT/08.01_Quality_Plans_and_Inspection_Test_Plans (filed in background)`
- **Safety week pack Week 39** — `08_QUALITY_HSE_AND_ENVIRONMENT/08.07_Hazard_Identification_Risk_Assessment`
- **Safety week pack Week 40** — `08_QUALITY_HSE_AND_ENVIRONMENT/08.07_Hazard_Identification_Risk_Assessment`
- **Safety week pack Week 41** — `08_QUALITY_HSE_AND_ENVIRONMENT/08.07_Hazard_Identification_Risk_Assessment`
- **Safety module Excel** — `08_QUALITY_HSE_AND_ENVIRONMENT/08.07_Hazard_Identification_Risk_Assessment (filed in background)`
- **Planned vs Actual Excel (charts)** — `07_EXECUTION_AND_DELIVERY/07.08_Progress_Measurement_SCurve (filed in background)`
- **Budget WBS** — `02_PLANNING/02.05_Cost_Estimates_Budget_Development (filed in background)`
- **BOQ monitoring** — `05_PROCUREMENT_AND_CONTRACTS/05.01_Procurement_Strategy_and_Packages (filed in background)`
- **Measurement book** — `09_COMMERCIAL_AND_CHANGE/09.02_Joint_Measurement (filed in background)`
- **Cashflow** — `02_PLANNING/02.07_Cash_Flow_Forecast_Monitoring (filed in background)`
- **DPRs Week 39 (5 files)** — `07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records/CIVIL`
- **DPRs Week 40 (5 files)** — `07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records/CIVIL`
- **DPRs Week 41 (5 files)** — `07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records/CIVIL`
- **WPR Week 39 (report no. undefined)** — `10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.01_Progress_Reporting_MIS`
- **WPR Week 40 (report no. undefined)** — `10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.01_Progress_Reporting_MIS`
- **WPR Week 41 (report no. undefined)** — `10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.01_Progress_Reporting_MIS`

## Failures to fix

- **DWG-2** (site) Site engineer passes the Drawing Check gate and uploads R0 PDFs for 5 GFC drawings; office publishes — drawing check 504 <html>
- **DWG-3** (site) Week 2: VT-ST-101 revised to R1 after the coordination clash (new Drawing Check, R0 superseded) — drawing check 504 <html>
- **DCI-1** (site) Site logs a Structure / MEP clash (pedestal P3 vs cable trench) to the consultant on the matrix, with a drawing markup — markup 504 <html>
- **DCI-3** (consultant) Consultant answers the escalated RFI with a markup; office closes it and the coordination issue — consultant markup 504 <html>
- **RFI-2** (office) Office follow-ups to the consultant (per the matrix) and a consultant markup on the anchor-bolt RFI — markup 504 <html>
- **CHK-1** (vendor) QI fill-RFI: site asks Reeca to fill the Raft/Footing pre-pour inspection; contractor submits with photos + signature; client signs; office approves and closes the RFI — vendor submit 504 <html>
- **CHK-2** (vendor) Site-execution checklists (Anchor bolt fixing — PEB, Pour card) filled by Reeca each week, approved by office — submit Checklist For Anchor Bolt Fixing 504 <html>
- **CHK-3** (site) Safety F-01: Reeca requests clearance for work at height; Jaideep inspects (12 lines, photos, signature); office records S1 Cleared — F-01 fill 504 <html>
- **CHK-4** (vendor) PPE & induction checklist (3 photos per line) by Reeca; fill log lists every fill with status — submit 504 <html>
- **FIN-2** (vendor) Week 1: Reeca raises RA-01 with its bill workbook (refused without a file); office Corrected → Certified → Certificate of Payment PDF — ra 504 <html>
- **FIN-3** (office) Week 3: measured quantities pushed to the BOQ; office raises RA-02 from the BOQ abstract (MB → bill); vendor sees both bills — ra from boq 400 RA-02 already exists on this project
- **FIN-4** (office) COP register PDF, payment summary and PR tracker saved to SharePoint 09.01; finance overview — SharePoint save (All COPs (PDF register)) 400 Export failed (404): {"error":"No COPs yet"}
- **WPR-4** (client) Report numbers run 1 → 3; client can open the week-3 WPR but cannot edit — report numbers NaN,NaN,NaN
