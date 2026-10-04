# HR Desk UAT Script

The full CRM and HRMS run is in `docs/CRM_HRMS_UAT.md` (C1–C11, then H1–H17). Use that one to share and verify. This file is the shorter HR-only pass.

Date: 29 Sep 2026  
Portal: https://portal.spdc.in  
Sign in as the HR Head. Do not send onboarding email. Do not delete the Voltamp project.

UI rule for this run: every label, button, heading, and table header uses a capital first letter on each word. Names, PAN, email, and amounts stay as typed. Refresh once before the first screenshot.

People already on the desk:

- Requisition 1, Site, Project Manager (Site): UAT Ravi Site (score 89.1, Advance) and UAT Amit Site (score 60, Reject).
- Requisition 2, HR, HR Executive: UAT Meera HR (score 85.3, Advance).
- Ravi: EMP-101039, offer OFR-750925, CTC now ₹23,10,000 after the approved 10% hike (was ₹21,00,000). Basic ₹88,326. HRA ₹35,331.
- Meera: EMP-368804, offer OFR-264435. CTC, PAN, and bank are still blank.
- October 2026 has one payslip for Ravi from before the hike (old ₹21,00,000 figures) until that month is generated again.

Each test below has the WhatsApp line to send with the screenshots of that screen.

## 1. HR Desk

Open the HR desk. Left menu and the top bar should read People Lifecycle, Time & Pay, Documents & Masters, Administration, and Hire, Pay, And File.

WhatsApp:

Sharnam Portal — UAT 1 | HR Desk | 29 Sep 2026
The HR desk opens with title-case menus: Recruitment, Onboarding, Attendance, Leave, Vouchers, Payroll, Letters, Employee Files, Masters, Activity, and Users.
Screenshot: full desk with the left menu and the top bar.

## 2. Recruitment

Open Recruitment. Requisition 1 and Requisition 2 are Approved. Open Resumes and confirm three people. Open a scored row and confirm Save Scorecard is visible.

WhatsApp:

Sharnam Portal — UAT 2 | Recruitment | 29 Sep 2026
Two approved requisitions. Three candidates. Scorecard can be saved and is filed on SharePoint.
Screenshot: requisition list, then one open scorecard.

## 3. Compare

Open Compare. Requisition 1 should show Ravi leading Amit. Requisition 2 should show Meera. Onboard is on the leading scored person.

WhatsApp:

Sharnam Portal — UAT 3 | Compare | 29 Sep 2026
Ravi leads Amit on the site role. Meera stands on the HR role. Onboard opens the checklist for the person we hire.
Screenshot: both compare cards.

## 4. Onboarding

Open Onboarding. Ravi and Meera are on the joinee desk. Open Ravi. Ticks stay local until Save Checklist. Appointment is Open Letter, not a raw link. Activity opens in a window.

WhatsApp:

Sharnam Portal — UAT 4 | Onboarding | 29 Sep 2026
Ravi OFR-750925 and Meera OFR-264435 are on the joinee desk. Checklist saves in one step. Portal login is already linked.
Screenshot: joinee list, then Ravi’s checklist after Save Checklist.

## 5. Users Setup

Open Users. Click Setup on Ravi. The first block is Used On Every Payslip: PAN, Aadhaar, bank, IFSC, PF, UAN, ESI, joining date, birth date, grade, band, location, cost center, payroll area. CTC is ₹23,10,000. Basic and HRA filled from the calculator. The list stays Set PAN, Bank, PF until those are saved.

WhatsApp:

Sharnam Portal — UAT 5 | Employee Setup | 29 Sep 2026
PAN, bank, PF, and CTC are set once on Setup. Every month’s payslip uses them. Working days, loss of pay, and TDS are entered on Payroll for that month.
Screenshot: Ravi’s Setup window, top of the payslip block, then the CTC row.

## 6. Attendance

Open Attendance. The month calendar is the register. A site, vendor, or employee check-in needs a photo and location. That photo shows on the day. Office and HR stay one tap. Nobody has punched today yet, so this screenshot is the empty day plus the punch panel.

WhatsApp:

Sharnam Portal — UAT 6 | Attendance | 29 Sep 2026
Site, vendor, and employee check-in uses a photo and map. The HR desk shows that photo on the day. No punch is on file for today yet.
Screenshot: attendance calendar, then a site check-in with the photo if you do one on a phone.

## 7. Leave And Vouchers

Open Leave, then Vouchers. Both registers are empty and ready for a new row. Do not need a delete.

WhatsApp:

Sharnam Portal — UAT 7 | Leave And Vouchers | 29 Sep 2026
Leave and voucher registers are empty and ready. A new leave or voucher can be added from the form on each page.
Screenshot: Leave page, then Vouchers page.

## 8. Payroll

Open Payroll. Year 2026. Month 10 Oct to see Ravi’s slip. The generate form labels are Employee, Working Days, Loss Of Pay (Days), TDS, Basic Override, HRA Override, and Special Allowance Override. Overrides stay blank. The register column is Staff, and the row shows UAT Ravi Site and EMP-101039, not a user id. September is empty.

WhatsApp:

Sharnam Portal — UAT 8 | Payroll | 29 Sep 2026
Generate fields are named. Blank overrides use the CTC calculator. October register shows UAT Ravi Site, not a user id. That slip is still the pre-hike amount until generated again.
Screenshot: generate form, then the October register.

## 9. Pay Hike

Open Pay Hikes. Pick UAT Ravi Site. Current CTC, basic, and HRA fill from his setup (₹23,10,000, ₹88,326, ₹35,331). Type a new CTC and the new basic and HRA fill from the calculator. The approved hike on file is ₹21,00,000 to ₹23,10,000, 10%, status Approved. Do not submit another hike unless you want a second change.

WhatsApp:

Sharnam Portal — UAT 9 | Pay Hike | 29 Sep 2026
Current pay fills from employee setup. New basic and HRA fill from the CTC calculator. Approving the hike wrote ₹23,10,000, basic ₹88,326, and HRA ₹35,331 onto Ravi.
Screenshot: the hike form with Ravi selected, then the hike register row.

## 10. Letters, Files, Masters, Activity

Open Letters, Employee Files, Masters, then Activity. Letters open as SharePoint links. Activity is a count plus a window, not a long page scroll.

WhatsApp:

Sharnam Portal — UAT 10 | Letters, Files, Masters, Activity | 29 Sep 2026
Letters and employee files open on SharePoint. Masters hold leave types and holidays. Activity opens in a window.
Screenshot: one of each page.

## Hold For Your Screenshots

No further test data will be added until these shots are back. After a hard refresh, start at test 1.
