# Sharnam Portal — Master UAT (all modules, all logins)

Run on **production (portal.spdc.in)**, project **Voltamp** only. Tick **Pass / Fail**, note the record number used and the login you were using.

**Detailed scripts referenced below:** `docs/CRM_HRMS_UAT.md` (C1–C11, H1–H17) · `docs/UAT_DRAWINGS.md` (A–K).

> **Email is held during UAT** (`PORTAL_MAIL_LIVE` is not `true`). Nothing reaches inboxes — every "emailed" step is checked in **Project → Email** (the outbox log) instead.

---

## 0. Before you start — test logins

Create these from CRM / HRMS (or reuse existing ones). Use a separate browser profile (or private window) per login.

| # | Login | Created from | Signs in at | Expected landing |
|---|-------|--------------|-------------|------------------|
| L1 | Admin (SPDC) | existing | `/login/office` | Office dashboard, all projects, Access & Audit menus |
| L2 | Office / PMC engineer (SPDC) | HRMS → Users | `/login/office` | Office dashboard, only assigned projects |
| L3 | HR Head | HRMS → Users | `/login/hr` | HRMS home (journey steps) — no project modules |
| L4 | Site engineer (SPDC) | HRMS → Users (site) | `/login/site` | Field desk / attendance, assigned project tools |
| L5 | Client representative | CRM → Clients → Activate portal | `/login/client` | Client desk — only projects the client company is on |
| L6 | Vendor / contractor | CRM → Vendors → Activate portal | `/login/vendor` | Vendor desk — only assigned projects |
| L7 | Consultant | CRM → Consultants → Activate portal | `/login/stakeholder` | Stakeholder desk — project switcher, only assigned projects |

## 1. Login, access & logging (every login)

| # | Step (repeat for L1–L7) | Expected | Pass/Fail |
|---|------|----------|-----------|
| 1.1 | Sign in at the login page in the table | Lands on the expected desk; name + role shown top-right. | |
| 1.2 | Wrong password once | Red message "invalid…" — no green text, no crash. | |
| 1.3 | Close the browser completely, reopen the portal | Signed out (session ends with the browser). | |
| 1.4 | L5 / L6 / L7: open a project the company is **not** on (paste its URL) | Access denied / redirected — no data shown. | |
| 1.5 | L5 client: open Drawings, RFIs, Reports | View-only; can raise a *concern* only; no upload / delete / import buttons. | |
| 1.6 | L6 vendor: open RFIs and checklist fill log | Sees only requests assigned to their company; can fill assigned checklists. | |
| 1.7 | L2 / L4 (non-office): Drawings registers | Download Excel / PDF visible; **no Import** buttons. | |
| 1.8 | L1: **Audit** (`/audit`) after doing a few steps below | Each create / update / delete / import is listed with user + time. | |
| 1.9 | L3: **HRMS → Activity** | HR actions (candidate added, letter generated, user created) and any screen errors are listed. | |
| 1.10 | Any login: click any **Save / Upload / Generate** button | Button shows a spinner and locks until done; long SharePoint writes show "Writing to SharePoint…" at the bottom; errors appear **red**, warnings amber, success green. | |

## 2. CRM (L1 / L2) — full script: `CRM_HRMS_UAT.md` C1–C11

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 2.1 | Add a client company with 2 representatives | Both reps listed; duplicate emails across client/vendor/consultant are blocked with a clear message. | |
| 2.2 | **Activate portal** on the client card, then on the 2nd rep | Both get logins (L5). | |
| 2.3 | Link the same client to **two projects** (project setup) | Both reps see **both** projects in their desk. | |
| 2.4 | Assign the client to a **third** project | Both reps see all three without re-activating. | |
| 2.5 | Repeat 2.1–2.4 for a vendor/contractor and a consultant (with consultant type) | Same behaviour; roles vendor / consultant. | |
| 2.6 | Project card | Section reads **"SPDC Team"**; saving adds SPDC staff to the project. | |
| 2.7 | Communication matrix — edit, export Excel + PDF | Sharnam-branded, logos, To/CC correct. | |
| 2.8 | Proposal → generate | Branded proposal with Vadodara office address. | |
| 2.9 | Bid package → vendors upload BOQ → comparative (R2) | R2 statement generated once ≥ 2 vendors uploaded. | |

## 3. HRMS (L3) — full script: `CRM_HRMS_UAT.md` H1–H17

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 3.1 | HRMS home | Numbered journey Requisition → Candidates → Offer → Onboarding → Employee → Letters & exit with live counts; "Needs your attention"; every word Title Case; no emoji. | |
| 3.2 | Requisition → candidate → interview scorecard → compare → offer (CTC + Annexure I) | Each step saves; numbered step tabs; labelled fields. | |
| 3.3 | Onboarding → convert to employee | Employee appears in HRMS → Users with emp code. | |
| 3.4 | **Letters** — generate one of each stage (Offer, Appointment, NDA; Confirmation, Promotion, Warning; Asset, Exit, Relieving, Experience, NDA post) | Preview shows names/variables; generated .docx has every field filled; "✓ Filed" marker; SharePoint link (or amber "not ready yet"). | |
| 3.5 | **Attendance & calendar → Team calendar** | Every staff member × day: P / L / L? / ½ / H / WO / A with monthly totals; click a name → their month with leave + holidays. | |
| 3.6 | Leave: apply (L4), approve (L3) | Shows as approved leave on both calendars. | |
| 3.7 | Vouchers, payroll month, payslip PDF | Branded payslip. | |
| 3.8 | Danger zones (Recruitment / Leave / Users) | Collapsed at page bottom; confirm dialog before delete. | |

## 4. Drawings (L1 / L2) — full script: `UAT_DRAWINGS.md` A–K, plus:

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 4.1 | Upload GFC → Drawing Check Master: answer lines, sign **Inspector, PMC, Client** | Each box has its **own name**; ticking "Client not available — PMC signs on behalf" relabels the client box. | |
| 4.2 | Download the Drawing Check **Excel** and **PDF** | Excel looks like the PDF: "Drawing Check Checklist", only status cells coloured, 4 signatures in their own boxes, legend. Client box says "signed by PMC on behalf" when used. | |
| 4.3 | Upload revision → receive & issue signatures: **Draw / upload** for Client, PMC, Site engineer | Saves without needing Photos; "PMC on behalf of client" recorded. | |
| 4.4 | Drawings → **Export ▾ Register** (module Excel) | Sheets: Master Drawing Register (21 cols), Approval & GFC Log, Design Coordination; logo letterhead; delays red, early green, critical amber. | |

## 5. Quality (L1 / L2 / L6)

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 5.1 | Quality dashboard | Excel / PDF export buttons in the top row. Export Excel → sheets CAR Register, Cube Test, QAP Detail, SOR Log, Checklist Fills (client column layouts), branded. | |
| 5.2 | QAP — download Excel | Branded, current week. | |
| 5.3 | **Quality inspection request** (Quality → request QI fill) to a vendor (L6) | Right panel shows only Quality actions (New quality inspection request, Inspection register, Quality checklist master) — **no** Ask PMC RFI / drawing links. | |
| 5.4 | L6 fills the activity checklist (Yes / No / N.A. mix, one remark) | Saved; appears on checklist fill log. | |
| 5.5 | Download that fill's **Excel** | SPDC/QA/F-02 Activity Inspection Checklist: particulars in the right boxes (Quantity in "Quantity / Unit"), lines grouped **A–F**, Status green / red / amber only, summary counts (N.A. counted as NA), signatures; no colour bleeding into other cells. | |
| 5.6 | **Inspection register → Quality IR**: raise an IR with every field (incl. Spec clause, Method stmt, Previous IR, Inspection required on date/time) | Saved; number shown. | |
| 5.7 | Download IR **Excel** + **PDF** | SPDC/QA/F-01 Request for Inspection: every field in its box (Package/WO, Discipline, Quantity, Stage, ITP, Control point, Drawing, Spec clause, Method stmt, Previous IR, Required on date + time); logo clear of the company name. | |
| 5.8 | SharePoint `08.02 …/Inspection_Requests/Open` | The IR Excel + print copy are filed **there** — not in 03.06 RFI folders. | |
| 5.9 | Close the IR | Moves to `Inspection_Requests/Closed`. | |
| 5.10 | NCR / CAR — raise, export Excel + PDF | Branded NCR form; appears on CAR Register export. | |
| 5.11 | Cube test entry → export | Cube Test sheet shows 7 / 28-day strengths and result. | |

## 6. Safety (L1 / L2 / L4)

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 6.1 | Safety checklist request → fill | Right panel shows Safety actions only (no drawing links). | |
| 6.2 | Safety IR (inspection register → Safety IR) → Excel / PDF | Safety clearance form fields (high-risk type, risk rating, result S1–S4, conditions). Filed under `08.07 …/Inspection_Requests`. | |
| 6.3 | Safety observation + Safety NCR | Listed on dashboard; Safety NCR export branded. | |
| 6.4 | Safety dashboard → Export Excel | Sheets Safety Register + Safety NCR, branded, status coloured. | |

## 7. RFI routing (L1 / L2 / L6)

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 7.1 | Drawings → **RFI register** | Only drawing information RFIs + drawing checklist fill requests — **no** quality IR / safety requests. | |
| 7.2 | RFI register → **Download SPDC form + register** | `04_RFI_REGISTER` lists only SPDC-RFI numbers (information requests). Dashboard sheet counts match. | |
| 7.3 | Quality → inspection requests list | Only quality requests — **no** drawing RFIs. | |
| 7.4 | Open the "RFIs" link on Project home / Dashboard | Opens the neutral **all-requests desk** (not whichever module you last visited). | |
| 7.5 | Open an e-mail link from the outbox for a drawing RFI while last on Quality | Opens in the Drawings RFI register with **that RFI selected**. | |
| 7.6 | Same for a quality request link while last on Drawings | Opens in Quality with that request selected. | |
| 7.7 | Design coordination → escalate → **View linked RFI** | Opens the register with the escalated RFI selected. | |
| 7.8 | Ask PMC RFI without a proposed solution | Blocked: proposed solution is required (SPDC rule). Checklist attachment is optional. | |
| 7.9 | As admin / office: open a test RFI → **Delete** → confirm | Removed from the log; detail clears. Live `SPDC_RFI_Form_and_Register.xlsx` on SharePoint is rewritten without it within a minute. The RFI's own files in SharePoint stay — delete them by hand. | |
| 7.10 | Quality → Inspection register → select a test request → **Delete** | Removed from the register. Site / client logins do not see Delete. | |
| 7.11 | Every module → **Files** tab, open each folder | Folders load quickly (Quality no longer waits on regenerating the pack). Records show the right Type and open the right register. | |
| 7.12 | Quality → QAP / Cube register download on a project with no rows | Short red notice "No QAP rows yet — nothing to download." The portal keeps working. | |

## 8. Progress (L1 / L2)

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 8.1 | Import / update Milestones, Hindrance, Legal approvals, Planned vs Actual | Rows appear; hindrance shows **Target Resolve Date** (not "Date resolved"). | |
| 8.2 | Progress → Export Excel | Sheets Milestone Tracking, Hindrance Register (17 cols), Legal Approval Tracker (delay counts while awaited), Planned Vs Actual, Manpower, Risk Register; branded; delays red. | |
| 8.3 | Planned vs Actual dashboard Excel + PDF | Branded letterhead + SPDC footer. | |

## 9. Communications (L1 / L2)

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 9.1 | + New meeting → agenda → schedule & invite (pick To / Cc from matrix) | See `UAT_DRAWINGS.md` K1–K10. | |
| 9.2 | MoM upload → follow-up | Follow-up keeps the invited list. | |
| 9.3 | Comms → Export Excel | Meetings + Action items, branded. | |

## 10. Reports, DPR / WPR (L1 / L2)

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 10.1 | DPR maker → download | Opens; values match the day. *(Branding refresh of DPR/WPR templates is the next round.)* | |
| 10.2 | WPR maker → download Excel / PPTX / PDF | Opens; week data present. | |

## 11. Branding check (every Excel / PDF downloaded above)

| # | Check | Pass/Fail |
|---|-------|-----------|
| 11.1 | Sharnam logo present and **not on top of any text** | |
| 11.2 | Company name "Sharnam Project Development Consultants & Co. (SPDC)" and the **Vadodara** office address in the footer | |
| 11.3 | Header rows navy with white text; only status / result / delay cells coloured (green / red / amber) | |
| 11.4 | No emoji anywhere; UI labels Title Case | |

---

**Sign-off** — Tester ____________ Login(s) used ____________ Date ______ Result: ☐ Pass ☐ Pass with notes ☐ Fail
