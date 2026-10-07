# Sharnam Portal — UAT Guide (Arvind data)

One guide for UAT by **site employees** and **office employees** (plus vendor and client checks).
Every step says what to open, what to do, what you should see (✅) and what to screenshot (📸).

Projects: **SPDC-ARVIND-01** (worker dormitory, Santej — report week 52, 23–29 Jul 2026) and **SPDC-ARVIND-NTX** (NTX building).
Portal: https://portal.spdc.in · Party logins (`.demo`) use `Demo@1234` · SPDC staff use their own password.
Emails stay on hold until sign-off.

When a step fails: note the **step number, login, project and a screenshot**, and send it to the SPDC portal team.

---

## 0. Before you start (admin, once)

1. Admin → **Office admin → UAT data → Load the Arvind data** → wait for **done**. 📸
2. Delete any test projects (CRMT1, CRMT2, UATDRW …) and switch off `.test` logins. 📸
3. **Dashboard** → only the two Arvind projects are listed. 📸

### Logins

| Role in the portal | Use | What this login may do |
|---|---|---|
| **Site employee** (`site_employee`) | e.g. `hitesh.rajput@spdc.in`, `pratik.solanki@spdc.in`, `planning.estimation@spdc.in` | DPR, check-in, checklists / inspections, quality observations, safety log & records, hindrance / risk / milestone registers, S-curve, photos. **Not** cost, finance or COP. |
| **Office employee** (`office`) | `operations@spdc.in` | Everything project-side incl. Cost, Finance (RA bills, COP, payment summary, PR / invoice tracker), imports, publishing. |
| Contractor / vendor | `site@bhavanainfra.demo` (Bhavana Infra) | Raise own RA bills (stage 1), contractor desk, assigned fills, safety records. Sees only its own bills. |
| Client (read-only) | `projects@arvind.demo` | View, sign the weekly report, raise a concern. |
| HR | `anushka.jha@spdc.in` | HRMS (separate HR UAT). |

---

## 1. What is already loaded from the client's sheets

These client files are already in the app for **SPDC-ARVIND-01** (dormitory) and/or **NTX**. For each one, test the three things in the last column:
**Edit** (change a row, add a row, delete the test row), **Upload / import** (where offered, re-import the client file), and **Export** (Sharnam-branded Excel with logo, title band, navy headers and a chart).

| Client file | Where in the app | Rows loaded (dorm / NTX) | Test |
|---|---|---|---|
| SPDC_Budget_Arvind 49 / 52.xls | Cost → Budget WBS, BOQ / Monitoring, MB, BBS, Rate difference | 27 / 27 budget · 432 BOQ · 4,318 MB · 1,805 BBS · 84 rates | Edit a BOQ line; Cost → Download each (Excel) |
| Cashflow - Dashboard.xlsx | Cost → Cashflow | 151 / 144 periods | Add a period (office); Download cashflow (chart) |
| Planned Vs. Actual Dashboard.xlsx / WPR 23–29 July | Progress → Planned vs Actual (activities, manpower, cashflow) | 170 activities · 30 manpower trades | Edit weekly plan; Download PvA Excel (charts) |
| Dash Bord For Budget 52.xlsx | Progress → Milestones (dorm) · project start date | 4 / 10 milestones | Edit a milestone date; Progress module Excel |
| HInderance Register Dashboard.xlsx | Progress → Hindrance register | 19 / 15 | Add + close a hindrance; Progress Excel |
| Risk Register - Dashboard 1.xlsx | Progress → Risk register | 29 / 30 | Add a risk; Progress Excel |
| Legal Approvals - Dashboard.xlsx | Progress → Legal approvals | 11 / 30 | Edit status; Progress Excel |
| Lessons Learnt - Sharnam PMC.xls | Progress → Lessons learnt | 10 / 10 | Add one |
| Monthly Progress Dashboard.xlsx (SOR Log) | Quality statistics baseline (Site Observation / Instruction / NCR) | 3 rows (89 / 89 / 4) | Add a site observation → totals go up by 1 |
| Quality Assurance Plan Week 50.xlsx | Quality → QAP | 578 / 578 | + Add row; Download QAP (drop-downs) |
| SPDC CUBE REGISTER (1).xlsx | Quality → Cube register | 13 / 436 specimens | Add a cube set; Download cube register |
| Quality Dashboard.xlsx | Quality → Dashboard + checklist catalogue | catalogue + fills | Export Quality dashboard (6 charts) |
| NCR 01 .xlsx · Safety NCR.xlsx | Quality → NCR/CAR · Safety → NCR / Unsafe act | 4 NCRs · 152 safety records | Raise one; download the NCR form / Unsafe Act form |
| Safety Dashboard.xlsx · WPR HSE Statistic | Safety → register + **opening balance** (253,648 safe man-hours / 364 days to 22 Jul) | 152 records | Log a day; check cumulative carries on |
| DCI_ARVIND / DRAWING REGISTER - 01.xlsx | Drawings → Master register, GFC log | 55 / 40 drawings | Upload a revision; Download register + GFC log |
| SPDC_RFI_Form_and_Register.xlsx | RFIs → register (form format) | blank form | Raise → respond → close; download RFI register |
| SPDC_Activity_Inspection_Checklist_Format · Request_for_Inspection · Safety_Inspection checklists | Inspections, checklist fills | templates | Fill one with photos → branded Excel / PDF |
| Communication Matrix_BPCL (1).xlsx | Comms → Matrix (contacts) | 24 contacts | Edit a contact; Export Excel |
| PR Tracker-52.xlsx | Finance → PR tracker / Invoice tracker | 15 PR · 52 invoices | Add an invoice (office); Download (charts) |
| Site Materials-52.xls | WPR → Material stock | 3 | Edit a balance |
| Payment Summary - VIATRIX · Viatrix_RA BILL_COP.xlsm | Finance → RA bills, COP, Payment summary | 6 RA bills · 4 COPs | See section 6 |
| Comparative Statement - R2.xlsx | CRM → Comparative (R2) | 16 BOQs | Open, download Excel |
| WPR 23 July to 29 July.xlsx / WPR File.xlsx | WPR → client-format workbook (template) | — | See section 5 |

Blank forms (NCR 01 register, RFI register, Snaglist) had no records in them — create records in the app.

---

## 2. Site employee — daily work (login: site employee)

1. **Check in** at site (selfie, location verified). 📸
2. **DPR Maker** → SPDC-ARVIND-01 → today → discipline **Civil**:
   - Lines are auto-filled: *cum qty upto prev* = yesterday's cumulative (✅ it carries on day to day).
   - Enter **qty today** on 2–3 lines. Set **Start / Finish** (planned dates) on a line — next day they are already filled. 📸
   - Manpower, materials, safety, highlights → **Save** → **Publish**. 📸
   - **Download Excel**: ✅ DASHBOARD shows the project, the 15 BOQ lines (today's work first), and the **S-curve chart** (planned to completion, actual up to today). 📸 the chart.
3. **Safety → Weekly desk**: log today (manpower, toolbox talk, inductions). ✅ week total and *previous week* update. 📸
4. **Quality → Site observation / instruction**: add one with a photo → close it next day. 📸
5. **Safety → record** (toolbox talk / unsafe act) → download the form (✅ your project name, not a sample). 📸
6. **Inspections / checklist fill** with photos and signatures → branded Excel + PDF. 📸
7. **Progress → Hindrance / Risk / Milestones**: add one each. 📸
8. **Progress → S-curve** (planning login): pick **Civil** → **Generate from schedule** or **Upload baseline (Excel / CSV)** with columns *Date · Planned % · Actual %*. ✅ chart and table in %; the next DPR S-curve uses this planned line. 📸

## 3. Office employee — registers, imports, exports (login: operations@spdc.in)

For each module open the register, **edit one row, add one row, delete your test row**, then **download** — every download is Sharnam-branded (logo, title band, navy headers) and has a chart beside or below the table.

1. **Cost**: Budget WBS, BOQ / Monitoring, MB, BBS, Cashflow, Rate difference → Download each. 📸 one Excel with its chart.
2. **Progress**: Planned vs Actual → Download (charts: cashflow, manpower, weekly qty). Progress module Excel (milestones, hindrance, legal, risk charts). 📸
3. **Quality**: QAP download; Cube register; NCR form; **Quality dashboard Excel** (the client's 6 charts). 📸
4. **Safety**: weekly Safety Dashboard Excel; **Opening balance** card (bottom of the weekly desk) — check 22-07-2026 · 253,648 · 364. 📸
5. **Drawings**: Master register + GFC log Excel; upload a revision. 📸
6. **Comms**: communication matrix Export Excel. 📸
7. **Imports**: re-import one client file where an *Upload / Import* button is shown (e.g. Progress → Planned vs Actual, Finance → PR tracker, Cost → BOQ) → ✅ rows refresh, no header row imported as data. 📸

## 4. Long text check (office or site)
Type a long description (300+ characters) in a meeting agenda, NCR description, hindrance and a custom sheet → **Save** → ✅ saved and shown in full. 📸

## 5. Weekly report — WPR (office)

1. **WPR Maker** → SPDC-ARVIND-01 → week ending **29-07-2026** (✅ the week stays 23–29 Jul; it is not moved to a Sunday). Report no. ✅ 52; the next week shows 53 automatically.
2. Sections: Planned vs Actual (✅ *executed till previous week · this week · till date · balance*), Quality (✅ 89 / 89 / 4 plus anything added in the app), Safety (✅ *up to previous week + current week = cumulative*). 📸
3. Download **WPR Excel**, **WPR PPTX** (index pages match, real photos, no staff notes) and **client-format workbook** (✅ the client's own layout with its **8 charts**, this week's figures, project / client lines filled). 📸 each.
4. **Publish** → files go to SharePoint 10 Progress. 📸
5. Next week: DPRs for the following days → open week ending 05-08-2026 → ✅ *till previous week* = last week's *till date*. 📸

## 6. Bills → check → COP → payment summary (three stages, discipline-wise)

| Stage | Who | What happens |
|---|---|---|
| 1. Bill upload | **Vendor** (or office for them) | RA bill raised under a discipline with the bill workbook → filed as **Submitted** |
| 2. Check | **Office** | Upload the **Corrected** workbook — only after Submitted → status **Checked** |
| 3. Certify → COP | **Office** | Upload the **Certified** workbook (only after Corrected) → **Create COP** linked to that bill → status **COP generated** |

1. Vendor `site@bhavanainfra.demo` → project → **Finance → RA Bill Tracker** → **Raise RA bill**: discipline Civil, RA no., amounts, attach the workbook → Submit. ✅ "RA bill submitted". Try without a file → ✅ refused. 📸
2. Vendor sees **only Bhavana's** bills. 📸
3. Office → Finance → **RA Bill Tracker** → the bill → try **Certified** first → ✅ "Upload the Corrected workbook first". Upload **Corrected** → ✅ status Checked. Upload **Certified** with the certified amount (excl. GST) → ✅ Certified; GST, retention and net payable recompute on the certified amount. 📸
4. Office → **COP** tab → try **Create COP** without picking a bill → ✅ blocked. Pick the certified bill in **Certified RA bill** → ✅ the whole form fills: certificate no. (`02/BHAVANA.INFRA/2026-27`), type "Against - RA-…", PO no. & date, budget code, original / amended WO value, amendment no., invoice no. & date, PAN (from the GSTIN), GST no., payable to, amounts. → **Create COP**. ✅ bill status **COP generated**. 📸
   *Before testing, give the vendor a PO (Cost → Purchase orders: PO no., date, budget code, WO value) and a GST no. on the vendor master — that is where these fields come from.*
5. **Download COP** → ✅ Viatrix certificate with Sharnam letterhead, every header field filled, and sections A–H with **Previous bills / This bill / Cumulative** (previous = this contractor's earlier COPs on the PO). Net payable and amount in words match the RA bill. **Print** gives the same on A4. 📸
5a. **COP PDF** → in the COP register click **PDF ↓** on a row → ✅ Sharnam-branded A4 certificate in the client's COP format: discipline chip, particulars (PO, WO value, PAN, GST, invoice), certified-to-date, sections A–H (previous / this bill / cumulative), amount in words, three signature blocks. **All COPs (PDF)** in the register header → ✅ a register page with totals by discipline, then one certificate per page; with a discipline selected (e.g. MEP) only that discipline's COPs. 📸
5b. **RA bill from BOQ (discipline carried through)** → Office → Finance → **RA Bill Tracker** → **From BOQ** → pick **Electric** → ✅ discipline shows **MEP**; items list measured qty − already certified, at BOQ rate; change a "This bill" qty → amount updates. Enter RA no. + contractor → **Raise RA bill** → ✅ bill in **MEP**, status Submitted, BOQ abstract (Excel) filed as the Submission workbook; the vendor sees it in their portal. Open **From BOQ → Electric** again → ✅ those quantities are no longer billable (no double billing). Upload **Corrected**, then **Certified** → **Create COP** → ✅ COP discipline **MEP**, register filter MEP shows it, PDF chip reads MEP, "Previous bills" counts only earlier MEP COPs; Cost → Monitoring → the items' **certified qty** goes up (pro rata if PMC certified less than raised). 📸
6. **Payment summary → Download** → ✅ RA bill sheets + Summary Civil with charts; the new bill is listed. 📸
7. COP **Certified / Paid** → ✅ Cost → Cashflow actuals update. 📸

## 7. Client, consultant, contractor views
1. Client `projects@arvind.demo`: dashboard, drawings, RFIs, raise a concern, **sign the WPR**. Editing anything else → read-only. 📸
2. Consultant `ak@consultant.demo`: respond to an RFI, design coordination. 📸
3. Contractor `site@bhavanainfra.demo`: contractor desk, assigned fill, safety record, RA bill (section 6). 📸

## 8. SharePoint
Open the SPDC SharePoint site → SPDC-ARVIND-01 → ISO folders: 09.01 RA bills (Submission / Corrected / Certified), COPs, 10 Progress (DPR / WPR), 08 Quality, 08 HSE. 📸

---

### Known limits (not failures)
- **Procurement Status** sheet in the client-format WPR keeps the template's package table (no register in the app for it yet).
- **Legal approvals**: *Action taken / Action required / Risk* are stored together in Remarks.
- Before the first DPR, the S-curve's actual line is spread from the project start to the opening quantity (no daily records exist for that period).
- PDF of the WPR is converted on SharePoint (live site only).
