# Sharnam portal — production UAT (all users · all modules)

Three projects are tested on **portal.spdc.in**:

| Project | What is tested | Data |
|---|---|---|
| **SPDC-ARVIND-01** — Worker dormitory, Santej | Running project: daily / weekly work continues on the loaded data | Arvind client files (loaded) |
| **SPDC-ARVIND-NTX** — NTX building | Second running project, same steps where data exists | Arvind NTX files (loaded) |
| **SPDC-VOLTAMP-01** — Voltamp Transformers Ltd. | **Real onboarding from zero**: project card → parties → client files → first DPR / WPR | Voltamp's own files (section 3) |

**How to record evidence.** Every step has an ID (`OFF-12`). For each step write Pass / Fail, the project, the login and attach one screenshot named by the ID (`OFF-12.png`).
A failure is sent to the SPDC portal team with the ID, login, project and screenshot. ✅ = what you should see. 📸 = screenshot.

**Cadence.** D = daily · W = weekly · M = monthly · P = once per project.

---

## 0. Logins

| Role | Login (UAT) | Portal role | Can | Cannot |
|---|---|---|---|---|
| Admin | `baibhabmustafi@gmail.com` / `admin@sharnam.demo` | admin | Everything, users and access, audit trail, UAT data | — |
| Office (PMC office) | `operations@spdc.in` | office | All project modules incl. Cost, Finance, COP, imports, publishing, closing NCRs | HR payroll |
| Site engineer | `hitesh.rajput@spdc.in`, `pratik.solanki@spdc.in` | site_employee | Check-in, DPR, measurement (MB / BBS / BOQ qty), observations, NCR / CAR raise, cubes, safety, checklists, hindrance / milestones, photos, day log, vouchers | Budget, cashflow, finance, COP, closing NCRs |
| Planning | `planning.estimation@spdc.in` | site_employee | As site + S-curve, Planned vs Actual, MS Project | As site |
| Design consultant | `ak@consultant.demo` | employee | Drawings, design coordination, RFI answers, checklists | Finance |
| Contractor | `site@bhavanainfra.demo` (Bhavana Infra) | vendor | Action desk (NCR / CAR, safety notices, RA bill stage), raise RA bill (stage 1), assigned checklist fills, bids, own attendance | Close anything, see other companies' items |
| Client | `projects@arvind.demo` (Arvind) · Voltamp client login after A-6 | client | Dashboards, drawings, reports, sign WPR, raise RFI / concern | Edit registers |
| HR | `anushka.jha@spdc.in` | hr | HRMS: users, attendance review, leave, payroll, recruitment, offers | Project modules |

Party logins use the password set at onboarding; SPDC staff use their own password.

---

## 1. Admin — before UAT starts (P)

| ID | Step | ✅ Expected |
|---|---|---|
| ADM-1 | Office admin → **Access · Users**: every login above is active with the role shown | Roles match the table |
| ADM-2 | Open **DPR maker** on any project — read the SharePoint banner at the top | No "SharePoint not live / Mock · Offline" warning (Azure connected) |
| ADM-3 | Mail stays on hold for UAT (`PORTAL_MAIL_LIVE=false`, `GRAPH_MAIL_ENABLED=false`) | No client e-mails go out |
| ADM-4 | **UAT data** → Load the Arvind data (only if ARVIND-01 / NTX are empty) | Arvind sheets loaded, "done" |
| ADM-5 | **Dashboard**: only real projects listed — delete test projects (CRMT…, SPDC-UAT-…) | Clean list |
| ADM-6 | **Audit trail**: filter today | Every UAT action below appears with user and time |
| ADM-7 | **All-project DMS**: open ARVIND-01 → ISO folders 02 … 10 | Folders exist in SharePoint |

---

## 2. Which client file feeds which screen and which report

Use this table on Voltamp (upload) and to re-check Arvind (already loaded — re-upload one file to prove the import).

| Client file | Upload in | Feeds | Report / output it generates |
|---|---|---|---|
| `SPDC_Budget_<project>.xls` (all 36 tabs) | Cost → BOQ / Monitoring → **Upload Structure / BOQ** (full workbook) | Budget WBS, Monitoring per package, MB, BBS, rate differences | Cost sheet Excels, Finance CAPEX, **RA bill from BOQ**, DPR BOQ lines, S-curve weights |
| `Cashflow - Dashboard.xlsx` | Cost → Cash Flow Chart → **Upload sheet** | Planned / actual cashflow periods | Cashflow chart, WPR cashflow, Finance overview |
| `Planned Vs. Actual Dashboard.xlsx` | Progress → Planned vs Actual → **Upload** | Activities, manpower, weekly qty, cashflow | PvA Excel (charts), WPR planned vs actual, S-curve baseline |
| MS Project `.xml` | Progress → MS Project → **Import** | Tasks with planned dates | S-curve, activity schedule |
| `Milestone tracking.xlsx`, `HInderance Register Dashboard.xlsx`, `Risk Register - Dashboard 1.xlsx`, `Legal Approvals - Dashboard.xlsx` | Progress → each register → **+ Add row** (Arvind: loaded) | Registers | Progress Excel (status charts), WPR sections |
| `Lessons Learnt - Sharnam PMC.xls`, `Snaglist - Sharnam PMC.xlsx` | Closure → Lessons learnt / Snaglist → **+ Add row** | Registers | Closure report |
| `Monthly Progress Dashboard.xlsx` (SOR log) | Quality → SOR Log (baseline) | Observation / instruction / NCR totals | Quality statistics, WPR quality page |
| `Quality Assurance Plan Week NN.xlsx` | Quality → Quality Assurance Plan → **Upload sheet** | QAP week rows | QAP Excel (drop-downs), Quality dashboard |
| `SPDC CUBE REGISTER.xlsx` | Quality → Cube Test → **Import SPDC Excel** | Cube groups (7 / 28-day) | Cube register (client format), DPR quality, WPR cube stats |
| `NCR 01.xlsx`, `Safety NCR.xlsx` | Built in — records are raised in the app | NCR / CAR, safety NCR | NCR form Excel / PDF |
| `Safety Dashboard.xlsx` | Safety → Dashboard (HIRA) + **Opening balance** card | HIRA, safe man-hours to date | Safety week Excel, WPR HSE statistic |
| `SPDC_Request_for_Inspection_Form.xlsx`, `SPDC_Activity_Inspection_Checklist_Format.xlsx`, `SPDC_Safety_Inspection_Request_and_Checklists.xlsx` | Built in — Inspection → IR (F-01), activity checklist (F-02) | Checklist masters | Filled IR / checklist Excel + PDF with photos |
| `DRAWING REGISTER - 01.xlsx` | Drawings → Master register → **Import** | Drawing list | Register Excel |
| `Approval & GFC Drawing Log.xlsx` | Drawings → Approval & GFC log → **Import** | GFC log | GFC log Excel / PDF |
| `DCI_<project>.xlsx` | Drawings → Design coordination → **Import** | Clash / coordination items | Coordination register, RFIs |
| `Communication Matrix_<project>.xlsx` | Project setup → Communication matrix | Contacts by role | Matrix Excel, meeting invitees |
| `SPDC_RFI_Form_and_Register.xlsx` | Built in — RFIs are raised in the app | RFI register | RFI form + register Excel |
| `PR Tracker-NN.xlsx` | Finance → PR Tracker → **Import** | PRs, invoice processing | PR / Invoice tracker Excel, WPR procurement |
| `Site Materials-NN.xls` | Progress → WPR trackers → **Import** | Material stock | WPR material page |
| `Payment Summary - <contractor>.xlsx` | Finance → Bill registers → **Upload Payment Summary** | RA bill registers by discipline | Payment summary Excel |
| Contractor RA bill workbook (`*_RA BILL_*.xlsm`) | Finance → RA Bill Tracker (contractor raises, PMC uploads Corrected / Certified) | RA bill stages | **COP** Excel + PDF, cashflow actuals |
| `Comparative Statement - R2.xlsx` | CRM → Bid management → package → vendor BOQs | Vendor BOQs | Comparative statement Excel |
| `Project Closure Report.docx` | Closure → Closure report → **Upload** | Closure report | Filed to SharePoint 10 |
| `WPR <dates>.xlsx` / `WPR File.xlsx` | Built in — WPR client-format workbook | — | WPR Excel, PPTX, client workbook (8 charts) |

---

## 3. Voltamp — onboarding from zero (office · P, then D / W)

| ID | Login | Step | ✅ Expected |
|---|---|---|---|
| VOL-1 | office | CRM → **Project setup** → New project: code `SPDC-VOLTAMP-01`, name, site / city, PMC SPDC, start / end dates | Project card created; SharePoint ISO folders 01–10 created |
| VOL-2 | office | Same page: **Client** = Voltamp Transformers Ltd. + client login e-mail; **Consultants**; **Vendors / contractors** (tick or *Add on Vendors*); **SPDC team** (site engineer, planning) | Directory lists every party; client and contractor logins created / linked |
| VOL-3 | office | **Work packages** (Civil, PEB, Electrical, Fire …) | Packages on the project card |
| VOL-4 | office | **Communication matrix**: one contact per role | Matrix Excel downloads with the Voltamp names |
| VOL-5 | office | Cost → Upload **Voltamp budget workbook** (`SPDC_Budget_Voltamp.xls`) | Budget, Monitoring per package, MB, BBS tabs filled — counts shown |
| VOL-6 | office | Cost → Cash Flow Chart → Upload Voltamp cashflow | Chart shows planned / actual |
| VOL-7 | planning | Progress → Planned vs Actual → Upload Voltamp PvA (or MS Project XML) → S-curve → **Generate from schedule** | Activities listed; S-curve planned line |
| VOL-8 | office | Quality → QAP → Upload Voltamp QAP; Cube Test → *New cube group* | QAP week rows; cube header shows **Voltamp / client / contractor from the directory** |
| VOL-9 | office | Safety → Dashboard → **Opening balance** (safe man-hours to date, LTI-free days) | Week pack carries the opening balance |
| VOL-10 | office | Drawings → Master register → Import Voltamp drawing register; GFC log | Registers filled; upload one revision → published |
| VOL-11 | office | Finance → COP → **Work orders / POs**: one PO per contractor (WO value, budget code, GST) | PO list |
| VOL-12 | office | Progress → Milestones / Hindrance / Risk / Legal: + one each | Progress Excel shows them |
| VOL-13 | site | Day 1: **check in** → DPR (section 5 SITE-2) | First DPR published with Voltamp header |
| VOL-14 | office | Week 1: WPR (section 4 OFF-30) | WPR report no. 1, Voltamp header lines, charts |
| VOL-15 | client | Voltamp client login → project desk | Only Voltamp visible; read-only; WPR sign-off box |
| VOL-16 | admin | Audit trail → filter SPDC-VOLTAMP-01 | Every onboarding step logged |

Steps OFF / SITE / CON / CLI below are then run on **all three projects** (Voltamp from VOL-13 on).

---

## 4. Office (`operations@spdc.in`)

**Project & directory**

| ID | Cad. | Step | ✅ Expected |
|---|---|---|---|
| OFF-1 | P | Project home → **Live project setup**: edit client contact, add a vendor | Saved; directory updated |
| OFF-2 | P | Directory · Office / Site / Client / Contractor tabs | Each party with role and login status |
| OFF-3 | P | **Sign-off register**: upload your signature | Signature used on checklists / RFI exports |

**Drawings & documents**

| ID | Cad. | Step | ✅ Expected |
|---|---|---|---|
| OFF-4 | W | Drawings → Master register: add a drawing, upload revision R1, publish | Register row, revision in GFC log, file in SharePoint 04.02 |
| OFF-5 | W | Approval & GFC log → download Excel + PDF | Client layout, branded |
| OFF-6 | W | Design coordination: add a clash → **escalate to RFI** | RFI created, linked |
| OFF-7 | P | Documents (DMS): upload a file to 03 Support, open in SharePoint | File in the right ISO folder |

**Cost** (detail in `docs/UAT_EVIDENCE_PLAN.md` B1–B8)

| ID | Cad. | Step | ✅ Expected |
|---|---|---|---|
| OFF-8 | M | BOQ / Monitoring: + Section, + Subsection, + Item | Bands with the item under them |
| OFF-9 | M | Project CAPEX / monthly budget: + Heading, + line | Totals roll up |
| OFF-10 | W | Cash Flow Chart / Forecast / Tracking: + period | Chart updates |
| OFF-11 | M | Rate difference: + steel purchase row | Excess / saving computed |
| OFF-12 | W | Each sheet → **Download XLSX** and **Publish to SharePoint** | Branded workbook; "Saved … live copy + this week's copy" |

**Finance**

| ID | Cad. | Step | ✅ Expected |
|---|---|---|---|
| OFF-13 | P | COP → Work orders / POs → + PO | PO with WO value, budget code, GST, PAN |
| OFF-14 | W | RA Bill Tracker → contractor's bill → upload **Corrected**, then **Certified** (try Certified first) | Order enforced; Submitted → Checked → Certified |
| OFF-15 | M | RA Bill Tracker → **From BOQ** → package → quantities → Raise | Bill in the package discipline, BOQ abstract filed |
| OFF-16 | W | COP → pick the certified bill → Create COP | Every field fills (PO, WO value, PAN, GST, amounts, previous / cumulative) |
| OFF-17 | W | COP row → **PDF**; register → **All COPs (PDF)**, per discipline; **COPs → SharePoint** | Branded certificates; register by discipline |
| OFF-18 | W | COP → Certify → Mark paid | Cost → cashflow actuals update |
| OFF-19 | W | Payment summary, PR Tracker, Invoice processing → Download + Save to SharePoint | Branded workbooks with charts |
| OFF-20 | M | Finance → Overview | Billed / certified / paid by discipline |

**Quality**

| ID | Cad. | Step | ✅ Expected |
|---|---|---|---|
| OFF-21 | W | QAP: + row, Download, Publish | Week sheet with drop-downs |
| OFF-22 | W | Cube Test: check 7-day / 28-day results, **Recalculate IS 516** | Strength = load ÷ 22.5, averages, PASS / FAIL |
| OFF-23 | D | CAR / NCR register: open an NCR the contractor answered → verify → **Close** | Closed; contractor desk shows it under Closed |
| OFF-24 | W | Quality dashboard → Export Excel → **Save to SharePoint** | 6 client charts; file in 08.01 |

**Safety**

| ID | Cad. | Step | ✅ Expected |
|---|---|---|---|
| OFF-25 | D | Safety NCR Summary: open a contractor-answered safety NCR → **Close** | Closed (contractor cannot) |
| OFF-26 | W | Weekly desk → **Week Excel** → **File week to SharePoint** | HSE statistic: previous + this week = cumulative |
| OFF-27 | P | Opening balance card | Safe man-hours / LTI-free days carried |

**Progress, comms, reports, audit, closure**

| ID | Cad. | Step | ✅ Expected |
|---|---|---|---|
| OFF-28 | W | Planned vs Actual → weekly plan / actual → Download → Save to SharePoint | Charts; 07.08 folder |
| OFF-29 | W | Risk + Legal approvals: + one each, close one | Progress Excel status charts |
| OFF-30 | W | WPR maker → week ending → Excel, **PPTX**, **Client workbook** → **Publish** | Report no. carries on; 10.01 folder |
| OFF-31 | W | Comms → Agenda → generate agenda → MoM → action items → Follow-up | MoM Excel; open actions listed |
| OFF-32 | D | Comm log + Email / Outlook entry | Logged |
| OFF-33 | M | Audit & KPI → Findings, Site walk, KPI dashboard → upload pack | KPI roll-up |
| OFF-34 | P | Closure → Snaglist (+ row), Lessons learnt, Closure report upload | Closure report filed |
| OFF-35 | M | CRM → Bid management → comparative → award | Comparative Excel; awarded vendor on project |
| OFF-36 | P | Custom sheets → upload a sheet → edit → export | Branded export |

---

## 5. Site engineer (`hitesh.rajput@spdc.in`) — run daily for a week

| ID | Cad. | Step | ✅ Expected |
|---|---|---|---|
| SITE-1 | D | **Check in** (selfie + GPS at site) | Project tools open only after check-in |
| SITE-2 | D | **DPR maker** → today → discipline → qty today on 2–3 lines, manpower, materials, safety, highlights → Save → **Publish** → XLSX / PDF | Header from the project card; *cum up to previous* carries from yesterday; DASHBOARD with S-curve |
| SITE-3 | D | Cost → **MB sheets**: + heading, + measurement (nos × L × B × H) | Qty computed; budget / cashflow tabs not available |
| SITE-4 | D | Cost → **BBS**: + bar (dia, cutting length m, nos) | Weight = d² ÷ 162 × total m |
| SITE-5 | D | Quality → **Site observation** with photo; next day close it | SOR totals +1 |
| SITE-6 | D | Quality → **Cube Test → New cube group** (cast date, grade, agency) → enter 7-day loads | Testing dates = cast + 7 / + 28 automatically; strength, average, PASS / FAIL |
| SITE-7 | W | Day 28: enter the 28-day loads on the 28-day rows | 28-day average and result |
| SITE-8 | D | Quality → **CAR / NCR register → + Add row** (NCR to a contractor, action required, planned closure) | NCR on the contractor's action desk |
| SITE-9 | D | Safety → **Log safety observation** / **NCR Form** issued to the contractor | On the contractor's action desk |
| SITE-10 | D | Safety → weekly desk: log today (manpower, toolbox talk, inductions, permits) | Week total and cumulative update |
| SITE-11 | D | Inspection → **Fill quality / safety / activity checklist** with photos and signature | Filled checklist Excel + PDF |
| SITE-12 | D | Progress → Hindrance / Milestones: + one | Registers |
| SITE-13 | D | Comms → Day log, Photos, **Daily expense voucher** | Saved; voucher in HR review |
| SITE-14 | D | Check out (near the check-in point) | Attendance day complete |

## 6. Planning (`planning.estimation@spdc.in`)

| ID | Cad. | Step | ✅ Expected |
|---|---|---|---|
| PLN-1 | W | Progress → Planned vs Actual → activity lines with planned start / end | Activities |
| PLN-2 | W | S-curve → **Generate from schedule** or **Upload baseline** (Date · Planned % · Actual %) | Chart and table in %; next DPR S-curve uses it |
| PLN-3 | M | MS Project → Import XML → Download XML | Round trip keeps dates |

## 7. Design consultant (`ak@consultant.demo`)

| ID | Cad. | Step | ✅ Expected |
|---|---|---|---|
| DES-1 | W | Drawings → Design coordination: comment on a clash | Logged |
| DES-2 | W | RFI register → answer an open RFI | RFI answered → office closes |
| DES-3 | W | Drawings → checklist fill log → fill a drawing check | Fill in the log |

## 8. Contractor (`site@bhavanainfra.demo`)

| ID | Cad. | Step | ✅ Expected |
|---|---|---|---|
| CON-1 | D | Contractor home → **NCR / CAR · safety · RA bills** (action desk) | Items issued to Bhavana only, in *Your action / With PMC / Closed* |
| CON-2 | D | Open an NCR → record **work carried out** and sign → Save | Moves to *With PMC* |
| CON-3 | D | Try to **Close** it | Refused — only PMC closes |
| CON-4 | D | Safety NCR → root cause, immediate / long-term action, action taken | Moves to *With PMC* |
| CON-5 | W | Finance → RA Bill Tracker → **Raise RA bill** with the bill workbook (try without a file) | Submitted; refused without workbook; sees only own bills |
| CON-6 | W | Checklist inbox → fill an assigned checklist | Fill in the log |
| CON-7 | M | Bid management → open package → upload BOQ | BOQ in the comparative |
| CON-8 | D | Attendance & leave | Own attendance only |

## 9. Client (`projects@arvind.demo`, Voltamp client)

| ID | Cad. | Step | ✅ Expected |
|---|---|---|---|
| CLI-1 | W | Client home: open RFIs, inspections, NCR, safety, drawings counts | Counts match the project |
| CLI-2 | W | Project desk → **sign the weekly report** | Signature saved on the WPR |
| CLI-3 | W | Raise a concern / RFI | RFI in the register for office |
| CLI-4 | W | Try to edit a register (e.g. add a hindrance) | Refused (read-only) |
| CLI-5 | W | Reports → download the published WPR / DPR | Files open |

## 10. HR (`anushka.jha@spdc.in`)

| ID | Cad. | Step | ✅ Expected |
|---|---|---|---|
| HR-1 | D | HRMS → Attendance: today's check-ins with selfie, GPS, project | Site check-ins from SITE-1 listed |
| HR-2 | D | Leave: approve / reject a request | Status updates for the employee |
| HR-3 | M | Payroll → generate payslips → download PDF | Payslip per employee |
| HR-4 | M | Recruitment → candidate → offer letter | Offer issued |
| HR-5 | M | Expense vouchers: approve SITE-13 voucher | Approved |
| HR-6 | P | Users: add / deactivate a user, set role | Login works / blocked |

---

## 11. Daily / weekly / monthly rhythm (what must happen every period)

| When | Who | What | Output |
|---|---|---|---|
| Every working day | Site | Check-in → DPR → observations / NCR / safety log → MB / BBS → check-out | DPR (07.02), registers |
| Every working day | Contractor | Action desk — answer NCR / CAR / safety notices | Items move to *With PMC* |
| Every working day | Office | Close verified NCRs, review DPRs | Closed items |
| 19:00 IST daily | System | Day-close: registers rewritten to SharePoint for active projects | ISO folders current |
| Weekly (report day) | Office | PvA, safety week, quality dashboard, WPR → publish; COPs | WPR (10.01) + weekly copies |
| Monthly | Office / HR | Budget workbook, cashflow, rate difference, payroll, KPI audit | Cost / HR packs |

---

## 12. Production go-live checklist (admin)

| ID | Check | ✅ |
|---|---|---|
| GO-1 | Deploy the merged `main` to Hostinger (`npm run hostinger:build`) — it runs `prisma db push` (adds the new RA bill BOQ columns) | Build log ends without errors |
| GO-2 | First start logs `[cost] BBS weights recomputed …` and `[quality] cube testing dates filled …` once | Older BBS weights / cube dates corrected |
| GO-3 | `MOCK_ONEDRIVE=false` + `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` / `SHAREPOINT_SITE_URL` set | ADM-2 banner gone |
| GO-4 | `GRAPH_MAIL_ENABLED=false` and `PORTAL_MAIL_LIVE=false` during UAT; switch on only at sign-off | No mail before sign-off |
| GO-5 | Test projects deleted or set to *Closed* so the 19:00 day-close does not write their folders | Only real projects active |
| GO-6 | Database backup taken before UAT | Backup file noted |
| GO-7 | Every login in section 0 can sign in; site login lands on check-in | — |

Automated regression on a fresh project: `node scripts/uat-evidence/run.mjs` (50 steps, screenshots) and
`python3 scripts/uat-evidence/report.py <evidence-dir> <out.html>` — see `docs/UAT_EVIDENCE_PLAN.md`.
