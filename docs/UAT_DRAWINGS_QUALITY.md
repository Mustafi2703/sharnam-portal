# UAT run sheet — Drawings and Quality (production)

Run on **https://portal.spdc.in**, project **Voltamp** (SHAR/SNT/26-27). Work top to bottom: later steps use data from earlier ones. Each row says what to do, what must happen, and the screenshot to keep (📸). Mark ✅ / ❌ and note the ❌ ones for fixing.

This replaces `UAT_QUALITY.md` for this round.

## Logins

| Code | Login | Role on the project |
|---|---|---|
| **A** | nirav@spdc.in | Admin (SPDC office) |
| **S** | baibhabmustafi@gmail.com | Site engineer (SPDC) |
| **C** | hello@twinoxis.com | Client — view, sign, respond |
| **D** | admin@twinoxis.com | Design consultant — responds to RFIs / coordination |
| **V** | hello@qryxtech.com | Contractor — fills checklists, answers NCRs |

Emails are held (portal mail is not live). Notifications appear in the portal; only allow-listed test mailboxes receive mail.

## Client files used

From `module_prompts/Sharnam_modules_docs 2/` and `module_prompts/`:
`DRAWING REGISTER - 01.xlsx` · `Approval & GFC Drawing Log.xlsx` · `SPDC_RFI_Form_and_Register.xlsx` · `A_10_101_R0_ GROUND FLOOR PLAN` (PDF of it) · `Quality Assurance Plan Week 50.xlsx` · `Quality Dashboard.xlsx` · `NCR 01 .xlsx` · a cube register `.xlsx`.

---

## 0. Before you start (A)

| # | Step | Expected | 📸 |
|---|---|---|---|
| 0.1 | Project home → check client, consultant, contractor, PMC and **start date** are filled | Header shows **Week N** (Week 1 = week holding the start date). If no start date: a **Set Week 1** prompt | 00-project-week |
| 0.2 | Live project setup → directory has A, S, C, D, V on the team | All five listed with the right party | 00-team |
| 0.3 | Communication matrix → **Open portal for everyone** | Each matrix person can open the project | 00-matrix |
| 0.4 | Open any tool → top right **Open in SharePoint** (A/S only) | New tab opens that tool's ISO folder under `Sharnam Portal/<project>/…` | 00-open-sp |

---

## Part 1 — Drawings

### D1. Drawing settings (A)

| # | Step | Expected | 📸 |
|---|---|---|---|
| D1.1 | Drawings → **Drawing settings** | Four sections: Pick-lists · Load workbooks · People · Generate the sheets | D1-settings |
| D1.2 | Pick-lists: add an option to *Discipline*, reorder one, **Save pick-lists** | Card shows **customised**; option appears in the master register drop-down | D1-picklists |
| D1.3 | Load **DRAWING REGISTER - 01.xlsx** | Message: N register lines loaded; pick-lists set from the Input sheet | D1-register-load |
| D1.4 | Load **Approval & GFC Drawing Log.xlsx** | Message: N drawings and R0–Rn dates loaded | D1-gfc-load |
| D1.5 | Load **SPDC_RFI_Form_and_Register.xlsx** | Message: RFIs created / updated / responses | D1-rfi-load |

### D2. Approval & GFC log (A / S)

| # | Step | Expected | 📸 |
|---|---|---|---|
| D2.1 | Open **Approval & GFC log** | Rows from D1.4; drawings without files show *Awaiting drawing file* | D2-log |
| D2.2 | **Upload drawing** on one row → Drawing Check checklist opens first → fill every line → then pick the PDF (and DWG) | Revision saved with date; row shows the file; checklist logged | D2-upload |
| D2.3 | **Upload revision** on the same drawing (R1) | R1 date filled; current revision = R1 | D2-rev |
| D2.4 | Delete a test row from the GFC log | Same drawing disappears from the **Master register** too | D2-delete-sync |
| D2.5 | Sheets / pack menu → download GFC log Excel and PDF | Sharnam logo top-left, navy headers, wrapped readable text, grid lines | D2-xlsx |

### D3. Master register and dashboard (A)

| # | Step | Expected | 📸 |
|---|---|---|---|
| D3.1 | **Master register** → set planned date and criticality on 3 lines | Saves; delay days compute; page scrolls normally (no locked inner box) | D3-master |
| D3.2 | Sheets / pack menu opens as a popover above the rows (no overlap) → **Download the whole pack (ZIP)** | ZIP has register, GFC log, dashboard, RFI register — all branded | D3-pack |
| D3.3 | **Dashboard** → week picker: ‹ › arrows, *This week*, labels "Week N" | Charts change with the week; "All dates" shows everything | D3-dashboard |
| D3.4 | Dashboard Excel / PDF | Figures match the screen; Sharnam branding | D3-dash-export |

### D4. Design coordination with markup (S raises, D responds)

| # | Step | Expected | 📸 |
|---|---|---|---|
| D4.1 | **Design coordination** → raise an issue: discipline, priority, assign D, **link the drawing from D2.2** | Issue listed; assignee notified in portal | D4-raise |
| D4.2 | Select the issue → *Drawing markup* panel → **Open drawing in SharePoint** | Drawing PDF opens in SharePoint viewer | D4-sp-viewer |
| D4.3 | **Mark up drawing** → draw a **Cloud**, an **Arrow**, a **Box** and **Text**; type notes; move to page 2 and back | Page-1 markup is still there after coming back | D4-editor |
| D4.4 | **Save markup to SharePoint** | "Markup saved … filed to SharePoint"; new row in markup history and in DMS attachments | D4-saved |
| D4.5 | Open the saved markup (SharePoint ↗) | Cover page (project, drawing, revision, issue, by, date, notes) + marked pages | D4-markup-pdf |
| D4.6 | **Follow up** once, then **Escalate to RFI** | Follow-up count 1; RFI created and linked ("View linked RFI →") | D4-escalate |
| D4.7 | Register Excel / PDF download | Branded, issue rows present | D4-export |

### D5. RFIs (S raises, D answers)

| # | Step | Expected | 📸 |
|---|---|---|---|
| D5.1 | **Ask (PMC RFI)** → subject, question, linked drawing, assign D, due date → raise | Appears in **RFI register** with next RFI number | D5-raise |
| D5.2 | Open the RFI → *Drawing markup* → mark up and save (as in D4.3–D4.4) | Markup listed on the RFI; file in SharePoint `03.06 … /Markups/<drawing no>` | D5-markup |
| D5.3 | Log in as **D** → open the RFI → respond (official response) and add own markup | Response and D's markup listed under D's name | D5-response |
| D5.4 | **A** closes the RFI | Status Closed; progress bar complete | D5-close |
| D5.5 | RFI register Excel | Client RFI register layout, branded; D5 row filled | D5-xlsx |

### D6. Checklists and files (A / V)

| # | Step | Expected | 📸 |
|---|---|---|---|
| D6.1 | **Checklist manager** → Drawing Check Master template opens with all rows | Matches client checklist | D6-master |
| D6.2 | **Checklist fill log** → the fill from D2.2 is listed → branded download | Logo, every row answered | D6-fill-log |
| D6.3 | **Drawing files** → discipline folder → the uploaded PDF/DWG | File present in SharePoint design folder | D6-files |
| D6.4 | Log in as **C** → Drawings | Can view registers and drawings; no upload/delete buttons; no *Open in SharePoint* | D6-client |

---

## Part 2 — Quality

### Q0. Week and empty start (A)

| # | Step | Expected | 📸 |
|---|---|---|---|
| Q0.1 | Quality → **Dashboard** before entering data | All counts 0 — no sample weeks, samples or SOR figures | Q0-empty |
| Q0.2 | Week picker (same control as Drawings/Safety) → this week | Shows "Week N" from the project start | Q0-week |

### Q1. QAP settings (A)

| # | Step | Expected | 📸 |
|---|---|---|---|
| Q1.1 | Quality → **QAP settings** | Library shows **client standard** with activities from QAP Week 50 · Sheet2 | Q1-settings |
| Q1.2 | Add activity "Waterproofing" → 2 checks (description, frequency, code, agency) → **Save library** | Badge **project library**; counts update | Q1-library |
| Q1.3 | **Download library (Excel)** | Branded; Activity / Description / Frequency / Code / Test agency | Q1-library-xlsx |
| Q1.4 | **Load library Excel** with the file from Q1.3 | Same activities and checks loaded | Q1-library-reload |
| Q1.5 | Pick-lists → add "Third-party lab" to *Test agency* → **Save pick-lists** | Card **customised** | Q1-pickers |

### Q2. QAP sheet (A / S)

| # | Step | Expected | 📸 |
|---|---|---|---|
| Q2.1 | **Quality Assurance Plan** → **Upload QAP Excel** (`Quality Assurance Plan Week 50.xlsx`) | Rows load by section | Q2-import |
| Q2.2 | **+ Add from QAP library** → pick *Waterproofing* → tick both checks → set roles from drop-downs → add | Two lines added under the section with frequency/code/agency filled; "Third-party lab" offered | Q2-library-add |
| Q2.3 | Mark a line done for the week (days Yes / remarks Completed) | Done count rises on the Dashboard | Q2-done |
| Q2.4 | Download QAP Excel and PDF for the week | Branded, readable, week in header | Q2-export |

### Q3. Request for Inspection F-01 and checklists (S raises, V fills, A reviews)

| # | Step | Expected | 📸 |
|---|---|---|---|
| Q3.1 | **Request for Inspection (F-01)** → fill activity, location, qty, ITP ref, drawing no., link a checklist, assign V → raise | IR number in the register | Q3-raise |
| Q3.2 | **V** opens it → fills the checklist: every line Yes/No/N/A, **3 photos per item**, site instruction attached, signature | Saved; appears in **Quality fill log** | Q3-fill |
| Q3.3 | Quality fill log → layout fits, no overlapping | Readable rows | Q3-log |
| Q3.4 | **A** approves (or rejects with reason) | Status updates; request closes on approve | Q3-review |
| Q3.5 | Branded PDF / Excel of the fill | Header, answers, photos | Q3-export |
| Q3.6 | Repeat Q3.2–Q3.5 in **Site execution fill log** (F-02) | Same behaviour | Q3-site |

### Q4. Site observation / instruction (S raises, A closes)

| # | Step | Expected | 📸 |
|---|---|---|---|
| Q4.1 | **Site observation** → add one with 2 photos | Row + photos | Q4-obs |
| Q4.2 | **Site instruction** → add one | Row | Q4-ins |
| Q4.3 | Download each register → edit one row offline → **Upload to register** | Branded download with pick-lists; upload updates the row | Q4-roundtrip |
| Q4.4 | Close the observation → **SOR Log** | Totals / open / closed / closure % match | Q4-sor |

### Q5. NCR / CAR (A raises, V responds, A closes)

| # | Step | Expected | 📸 |
|---|---|---|---|
| Q5.1 | **Raise NCR / CAR — SPDC NCR 01** → fill form, assign V | NCR number assigned; in **CAR / NCR register** and **NCR / CAR fill log** | Q5-raise |
| Q5.2 | **V** fills corrective action | Saved draft → submitted | Q5-response |
| Q5.3 | **A** closes it with verification | Status Closed; SOR Log NCR row updates | Q5-close |
| Q5.4 | NCR Excel, PDF, HTML | NCR 01 layout; sign-off block with names, positions, dates and directory signature images | Q5-signoff |
| Q5.5 | CAR / NCR register → download (NCR REGISTER sheet) → edit → **Upload NCR 01 .xlsx** | Register updates from the upload | Q5-register |

### Q6. Cube register (S enters, A reviews)

Formulas: test date = cast + 7 / + 28 days; strength = load (kN) ÷ 22.5; average of 3; 7-day pass ≥ 0.67 × grade; 28-day pass if average ≥ grade.

| # | Step | Expected | 📸 |
|---|---|---|---|
| Q6.1 | **Cube Test** → add group: cast date, "Footing F1", **M25** | 7- and 28-day dates fill automatically | Q6-group |
| Q6.2 | 7-day loads **410 / 420 / 405** | 18.22 / 18.67 / 18.00, avg **18.30**, **PASS** | Q6-7day |
| Q6.3 | 28-day loads **640 / 650 / 630** | 28.44 / 28.89 / 28.00, avg **28.44**, **PASS** | Q6-28day |
| Q6.4 | Second group, 28-day **520 / 500 / 510** | avg **22.67**, **FAIL** | Q6-fail |
| Q6.5 | Download Excel / PDF | Header filled, groups complete, branded | Q6-export |

### Q7. Dashboard and weekly pack (A)

| # | Step | Expected | 📸 |
|---|---|---|---|
| Q7.1 | Dashboard → this week | KPIs from Q2–Q6 only: fills, open requests, NCRs, cube samples / passes / fails | Q7-kpi |
| Q7.2 | Previous week ‹ | Counts drop to that week's data | Q7-prev-week |
| Q7.3 | **Quality Dashboard Excel** (client format) | Week label "Week N", live figures, charts present, logo on every sheet | Q7-xlsx |
| Q7.4 | QAP → **Publish quality pack** | Runs in background with progress; finishes without timeout | Q7-publish |
| Q7.5 | **Open in SharePoint** (QAP tool) → `08.01` and `Weekly/<week>` | QAP, cube, dashboard, NCRs saved | Q7-sharepoint |

### Q8. Roles and isolation

| # | Step | Expected | 📸 |
|---|---|---|---|
| Q8.1 | **C** opens Quality | View only; no QAP settings tab; can sign where asked | Q8-client |
| Q8.2 | **V** opens Quality | Can fill checklists and answer NCRs; no settings | Q8-vendor |
| Q8.3 | Paste a record URL from another project | "Not found" — no data shown | Q8-isolation |

---

## Sign-off

| Module | Steps passed | Failed (step numbers) | Tested by | Date |
|---|---|---|---|---|
| Drawings | / 30 | | | |
| Quality | / 39 | | | |

Next round: Safety → Progress → Cost → Finance → DPR → WPR.
