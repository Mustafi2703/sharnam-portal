# Sharnam Portal — UAT Guide (Arvind data)

One guide for the client UAT. Every step says what to open, what to do, and what to screenshot (📸).
Projects used: **SPDC-ARVIND-NTX** (NTX building, week 3) and **SPDC-ARVIND-01** (worker dormitory, 23–29 Jul).
Portal: https://portal.spdc.in · UAT password for party logins: `Demo@1234` · Emails stay on hold until sign-off.

---

## 0. Before you start (admin, once)

1. Sign in as admin → left menu **Office admin → UAT data**.
2. **1. Load the Arvind data** → click **Load Arvind data**. Wait until the status shows **done** (a few minutes). 📸 the status and the two Arvind project tiles.
3. **2. Delete test projects** → tick CRMT1, CRMT2, CRMT3, UATDRW (and any other test project) → type `DELETE` → **Delete project(s)**. 📸 the empty list.
4. **3. Switch off test logins** → tick the `.test` logins → **Switch off**. 📸
5. Open **Dashboard** → only the two Arvind projects are listed. 📸

### Logins to use

| Who | Login | Sees |
|---|---|---|
| SPDC admin / office | your own SPDC login (e.g. operations@spdc.in) | everything |
| HR | anushka.jha@spdc.in | HRMS |
| Site engineer | e.g. pratik.solanki@spdc.in | site desk, check-in, fills |
| Client (read-only) | projects@arvind.demo | Arvind projects, view + sign + raise concern |
| Consultant | ak@consultant.demo | RFIs, design coordination, drawings |
| Contractor | site@bhavanainfra.demo | contractor desk, fills, safety |

SPDC staff keep their own passwords. Party logins (`.demo`) use `Demo@1234`.

---

## 1. Dashboard
1. Dashboard → **All Projects** table: RFIs (information), Inspections, Checklist requests, Next meeting, NCR/CAR, Safety, GFC drawings. 📸
2. Click a number (e.g. RFIs) → it opens that register. 📸
3. Click the NTX row → lists below: open RFIs, open inspections, meetings, due dates. 📸

## 2. CRM (office login)
1. **CRM → Clients**: Arvind Limited with both projects. 📸
2. **Consultants** and **Vendors / Contractors** tabs: A.K. Consultant, Bhavana Infra, NK Infra (Viatrix). 📸
3. **Projects** → open SPDC-ARVIND-01 **Edit setup** → client, consultants, contractors, **SPDC Team**. 📸
4. **Activate portal** on a party → login created. 📸
5. **Proposals** / **Comparative statement (R2)** → open the comparative, download Excel. 📸 screen + 📸 the Excel.
6. **Comms → Matrix** (project) → communication matrix → **Export Excel / PDF** (Sharnam branded). 📸 both files.

## 3. HRMS (HR login)
1. **Masters → Departments and Roles**: add a department and a role, then delete the test ones. 📸
2. **Recruitment → Requisition**: raise one (department + role from the masters) → Approve. 📸
3. **Resumes**: add a candidate with resume → **Scorecard**: schedule R1/R2/R3 and fill the SPDC scorecard. 📸
4. **Offers → Make an offer**: candidate, role, joining date, CTC (see the split), letter details → **Preview offer letter** 📸 → **Save offer and generate letter** → download **Offer letter (Word)** + **Annexure I (Excel)**. 📸 both files.
5. **Mark sent → Candidate accepted → Pre-joining checklist** (documents, BGV, medical, emp code) 📸 → **Generate appointment letter** 📸 → **Create portal login** (note the one-time password) 📸.
6. **Letters**: pick the person → stage tabs **Pre-joining / On joining / During employment / Exit** → generate each letter → **Full screen preview**. 📸 each letter (Offer, Appointment, NDA, Confirmation, Promotion, Warning, Asset return, Exit, Relieving, Experience, NDA post-employment).
7. **Attendance → Site locations**: pin SPDC-ARVIND-01 on the map with a radius. 📸
8. Site engineer login → **Check in** with selfie at site → "location verified". 📸 Then HR **Attendance → Review & hours**: verify / reject / edit times / add a missed day / Month log (Excel). 📸
9. **Leave**: apply (site login) → approve (HR). 📸 **Attendance & calendar → Team calendar**. 📸
10. **Payroll**: attendance table → **Generate all staff** → open a payslip PDF → **Edit** (days / amounts) → saved. Add one **Staff not on the portal** and generate their payslip. 📸
11. **Training** and **Vouchers**: open each, add one entry. 📸

## 4. Drawings (office / consultant)
1. Project → **Drawings hub**. 📸
2. **Approval & GFC log → Upload**: checklist first → revision + date → PDF/DWG (use `A_10_101_R0_ GROUND FLOOR PLAN.dwg`, then R1) → pick the discipline. 📸 each step.
3. **Master register**: planned date + criticality → delay in red. **Download Excel / PDF**. 📸 both files.
4. **Dashboard**: pick a week → location-wise, critical, delay, by-org charts. **Dashboard PDF**. 📸
5. **Design coordination**: assign an issue → follow-up → **Escalate to RFI**. 📸
6. **RFI register**: SPDC_RFI_Form_and_Register format → open an RFI → respond (consultant login) → close. Download the RFI form Excel. 📸
7. **Checklist fill log**: open a drawing check fill → Checklist PDF + Excel. 📸

## 5. Quality (office / site)
1. Project → **Quality hub** → **Dashboard**: pick a week → observations open vs closed, cube strength vs IS limit, fills by day / discipline. **Export Excel / PDF**. 📸
2. **Quality Assurance Plan**: Week 50 rows (from QAP Week 50.xlsx) → **+ Add Row** (all columns, pick-lists) → **Download XLSX** (Sharnam branded, drop-downs, Yes/No colours). 📸 screen + 📸 Excel.
3. **Inspection register**: Request for Inspection (F-01) and Activity Inspection (F-02) → download the Excel form. 📸
4. **QI & checklist fills**: fill a quality checklist with photos and signatures → Branded PDF + Excel. 📸
5. **CAR / NCR register** (NCR 01), **Cube test** (SPDC CUBE REGISTER), **SOR log / Site observation / Site instruction** → add one each → download. 📸

## 6. Safety
1. Project → **Safety** dashboard. 📸
2. Add a safety observation → close it. Safety NCR. 📸
3. **Safety inspection request** + safety checklist fill (SPDC_Safety_Inspection_Request_and_Checklists) → branded download. 📸
4. Contractor login → raise a safety record → visible to office. 📸

## 7. Progress, DPR and WPR
1. Project → **Progress**: Planned vs Actual, Milestones, Hindrance register, Legal approvals, Risk register, Lessons learnt. 📸 each dashboard.
2. **DPR maker** (dormitory, a day in 23–29 Jul) → fill → **Publish** → DPR Excel / PDF. 📸
3. **WPR maker** → week 52 (23–29 Jul) → refresh → **Publish** → WPR Excel + PPTX. 📸
4. Client login → **Reports** → open the WPR → sign as client. 📸

## 8. Client, consultant and contractor views
1. Client (`projects@arvind.demo`): dashboard, drawings view, RFIs, raise a concern, sign the weekly report. Try to edit anything else → "read-only". 📸
2. Consultant (`ak@consultant.demo`): respond to an RFI, design coordination. 📸
3. Contractor (`site@bhavanainfra.demo`): contractor desk, check-in, assigned checklist fill. 📸

## 9. SharePoint (Sharnam project drive)
Open the SPDC SharePoint site and 📸 each:
1. Project folders **SPDC-ARVIND-01** and **SPDC-ARVIND-NTX** → ISO folders 01–10.
2. Drawings → discipline → drawing → revision (PDF/DWG).
3. 08 Quality → QAP, inspection requests, checklist fills.
4. 10 Progress → DPR / WPR files.
5. RFI → `_Registers/SPDC_RFI_Form_and_Register.xlsx`.
6. SPDC_HRMS → 06_Records_Employee_Files → a person → 01_Joining (offer, appointment) and 06_Payslips; 07 Attendance; 08 Payroll.
7. SPDC_CRM → client and vendor files.

## 10. Excel and PDF formats to show the client
Download and 📸 one of each: Master drawing register (Excel + PDF), Drawing dashboard PDF, GFC log, RFI form + register, QAP, Inspection request (F-01 / F-02), checklist fill PDF + Excel, Cube register, NCR, Safety register, Communication matrix, DPR, WPR (Excel + PPTX), Offer letter + Annexure I, Appointment letter, Payslip PDF, Attendance month log.

---
When a step fails, note the step number, the login and a screenshot, and send it to the SPDC portal team.
