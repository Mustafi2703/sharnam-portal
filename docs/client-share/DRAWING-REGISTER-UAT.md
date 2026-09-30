# Drawings module UAT — full simulation

**Portal:** https://portal.spdc.in  
**Do not use** Voltamp or any live project you must keep.  
**Password for every test login:** `Demo@1234`  
**Mail:** project email can be on so the outbox records To and Cc. Portal mail stays off. Nothing is sent to real inboxes. The queued subject and body are the format we will send later.

Screenshot folder: `Sharnam Drawings UAT`. Browser about 1440×900.

## Files on the laptop

| File | Use |
|------|-----|
| `module_prompts/Sharnam_modules_docs 2/DRAWING REGISTER - 01.xlsx` | Master register + dashboard |
| `module_prompts/Sharnam_modules_docs 2/Approval  &  GFC Drawing Log.xlsx` | GFC dates, or type 5–6 rows by hand |
| `module_prompts/Sharnam_modules_docs 2/A_10_101_R0_ GROUND FLOOR PLAN.dwg` | Revision R0 |
| `module_prompts/Sharnam_modules_docs 2/A_10_101_R1_ GROUND FLOOR PLAN.dwg` | Revision R1 |
| One-page PDFs you export (Print → Save as PDF), named like the drawing number | Markup check on at least two sheets |

Drawing used for checklist, coordination, markup, and the converted RFI: **A_10_101 · GROUND FLOOR PLAN · Architecture**.

## Test logins

Create these in **Access → Users** before the run. Add each person to the UAT project. Put the same email on the communication matrix (Technical), under the org shown, so Design coordination can assign them.

| Who | Email | Portal | Role on the matrix |
|-----|--------|--------|--------------------|
| Office (runner) | `nirav@spdc.in` | Office | SPDC / PMC |
| Architect | `uat.architect@spdc.test` | Vendor | Consultant |
| Contractor | `uat.contractor@spdc.test` | Vendor | Vendor / contractor |
| SPDC engineer | `uat.engineer@spdc.test` | Office | SPDC / PMC |

Also add one **RFI** row on the communication matrix: from `office` to `vendor`, channel RFI. Without that row, the vendor login cannot reply.

---

## 0 · Project card

| # | Step | Pass |
|---|------|:----:|
| 0.1 | Office login. Create project **SPDC-UAT-DWG**. Client, location, and status filled on the card. | ☐ |
| 0.2 | Add the four people above to the project team. | ☐ |
| 0.3 | Communication matrix: architect, contractor, and engineer, each with the email in the table. Upload is optional if you type the rows. | ☐ |
| 0.4 | Project → **Email**. Email enabled. Confirm the banner that live send is off. | ☐ |

---

## 1 · GFC — five or six rows, two real drawings, PDFs for markup

| # | Step | Pass |
|---|------|:----:|
| 1.1 | Drawings → **Approval & GFC**. Import the GFC workbook **or** add **5 or 6** rows. One row must be `A_10_101`. | ☐ |
| 1.2 | **Upload revision** on `A_10_101`. Confirm screen shows number, title, type, revision **R0**. | ☐ |
| 1.3 | **Confirm and open checklist**. Fill every line. **Save draft** once — it appears on **Checklist fill log** as Draft. | ☐ |
| 1.4 | Complete the checklist. Upload the stakeholder signature. Submit. | ☐ |
| 1.5 | Back on the upload popup, attach `A_10_101_R0_ GROUND FLOOR PLAN.dwg`. Save. Row shows DWG. **Open DWG** opens SharePoint, not a download. | ☐ |
| 1.6 | **Upload revision** again → **R1** → checklist if this revision still needs it → attach the R1 DWG. Log shows R0 and R1. | ☐ |
| 1.7 | On **two other rows**, upload a one-page PDF (Print → Save as PDF). **Open PDF** opens in the portal viewer. | ☐ |
| 1.8 | Checklist fill log: submitted row for `A_10_101`. **Checklist PDF** and **Checklist Excel** both download. PDF lists the lines, the answers, and the signature. | ☐ |

---

## 2 · Master register and dashboard

| # | Step | Pass |
|---|------|:----:|
| 2.1 | **Master register**. Revision date on `A_10_101` matches the GFC upload. | ☐ |
| 2.2 | PMC sets **Planned (PMC)** on that row. **Critical** = Yes. Delay days update. | ☐ |
| 2.3 | **Register dashboard**. Charts: location, total drawings (pie), critical, submission delay, submitted by org, drawing type, submitted percentage. | ☐ |
| 2.4 | Pick this week, then a from/to date. Counts change with the dates. | ☐ |
| 2.5 | **Sync now** on the dashboard or GFC page. Same rewrite runs by itself at 7:00 pm IST. | ☐ |

---

## 3 · Design coordination → five follow-ups → RFI

Do this on **A_10_101** only.

| # | Step | Pass |
|---|------|:----:|
| 3.1 | **Design coordination**. Issue, drawing type Architecture, drawing `A_10_101`, assignee **uat.architect@spdc.test**. Log issue. | ☐ |
| 3.2 | Project → **Email** outbox. One queued message. To = architect. Cc = matrix To and Cc. Status is queued, not sent. | ☐ |
| 3.3 | **Send follow-up** five times. Counter goes 1/5 … 5/5. Each send adds an outbox row to the assignee. | ☐ |
| 3.4 | After 5/5, **Update to Ask PMC RFI**. Number is `SPDC-RFI-###`. Issue status Escalated. | ☐ |
| 3.5 | Drawings → **RFI register**. That number is listed, linked to `A_10_101`, assigned to the architect. | ☐ |

## 4 · Raise an RFI directly, then both portals reply

| # | Step | Pass |
|---|------|:----:|
| 4.1 | Still as office: **Ask PMC RFI**. New RFI (not the converted one). Link a PDF drawing. Assign **uat.contractor@spdc.test**. Submit. It is on the register. | ☐ |
| 4.2 | On that RFI, **New markup**. Pen, line, box, arrow, two colours. Save. **Existing markups** lists the page with date and your name. **Open in SharePoint** opens the page. | ☐ |
| 4.3 | Sign out. **Vendor** login `uat.architect@spdc.test`. Open the **converted** RFI. Reply with a written answer. Save. | ☐ |
| 4.4 | Sign out. **Vendor** login `uat.contractor@spdc.test`. Open the **direct** RFI. Reply. | ☐ |
| 4.5 | Sign out. Office `nirav@spdc.in`. Open both RFIs. Office reply on each. Ball in court moves. Register still shows both. | ☐ |

---

## 5 · SharePoint — right ISO folder

Project library for **SPDC-UAT-DWG**. After publish, GFC upload, checklist submit, markup save, and both RFIs:

### Drawings — `04_DESIGN_AND_INFORMATION_MANAGEMENT/04.02_Drawings_and_Specifications`

| What | Where | Pass |
|------|--------|:----:|
| `DRAWING-REGISTER-01.xlsx` | folder root | ☐ |
| `DRAWING-REGISTER-Dashboard.pdf` | folder root | ☐ |
| `Approval-GFC-Drawing-Log.xlsx` | folder root | ☐ |
| Same three files | `Weekly/<year>-W<week>/` (this week’s pack for WPR and DPR) | ☐ |
| R0 DWG | `…/Architecture/A_10_101/R0/DWG/` | ☐ |
| R1 DWG | `…/Architecture/A_10_101/R1/DWG/` | ☐ |
| Uploaded PDFs | `…/<discipline>/<drawing no>/<rev>/PDF/` | ☐ |
| Markup page | `…/<drawing no>/<rev>/Markup/page-01/` | ☐ |

### RFI register — `03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control`

| What | Where | Pass |
|------|--------|:----:|
| `SPDC_RFI_Form_and_Register.xlsx` (both RFIs) | `_Registers/` and `_Registers/Weekly/<year>-W<week>/` | ☐ |
| Each RFI workbook + HTML (print to PDF) | `Open/` while open; `Closed/` after close | ☐ |

WPR / DPR: take the week folder under **04.02**, not an older week and not a file sitting outside the ISO tree.

---

## 6 · Sign-off

| Area | Pass | Date |
|------|:----:|------|
| Project card, four logins, matrix | ☐ | |
| 5–6 GFC rows, R0/R1 DWG, PDF open | ☐ | |
| Checklist draft + signed submit + branded PDF and Excel | ☐ | |
| Master planned date, criticality, delay, dashboard week/dates | ☐ | |
| Coordination, 5 follow-ups in the outbox, convert to RFI | ☐ | |
| Direct RFI + markup on the PDF | ☐ | |
| Architect, contractor, and office each reply | ☐ | |
| 04.02 registers, weekly pack, DWG/PDF/markup | ☐ | |
| 03.06 RFI register and open RFI files | ☐ | |

**Notes**

_________________________________________________________________

**After UAT:** delete GFC rows and master lines on **SPDC-UAT-DWG** only. Leave every other project as it is.
