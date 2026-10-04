# Drawings Module — UAT Script

Run on production on the **Voltamp** project only. Tick each row **Pass / Fail** and note the drawing number used.

> **Email is held during UAT** (`PORTAL_MAIL_LIVE` is not `true`). Nothing is delivered to inboxes. Wherever a step says "emailed", check that the message is listed in the project's email log instead. Mail is switched on only after UAT sign-off and data entry.
Roles needed: **PMC office user** (uploads, edits register), **assignee** (a contact on the project's communication matrix with a real mailbox).

SharePoint folder for this module: `<Project>/04.02 Drawings and Specifications/`.

---

## A. Module layout

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| A1 | Open Project → Drawings hub | Cards: **Approval & GFC log**, **Master register**, **Design coordination**, Drawing files, Checklist manager, Checklist fill log, RFI register, Ask (PMC RFI). No "Register dashboard" or site register card. | |
| A2 | Open Approval & GFC log | Header shows only **Master register →**, **+ Add row**, **Upload GFC**. No "Load UAT GFC workbook", no "Delete all rows". | |
| A3 | Open **Export & sync ▾** | Download GFC Excel, **Download GFC PDF**, Import GFC Excel, Sync to SharePoint. | |

## B. Upload a drawing (checklist → revision → date → file)

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| B1 | Upload GFC → pick discipline | Drawing Check Master checklist opens first. Upload stays locked until the checklist is submitted. | |
| B2 | Save checklist as draft, close | Draft appears in Checklist fill log. Re-opening continues the draft. | |
| B3 | Submit checklist | Upload form unlocks. **Revision** dropdown defaults to R0. **Planned** and **Revision date** are date pickers (revision date = today). | |
| B4 | Attach **PDF only**, upload | Saves. Button shows spinner; bottom bar says "Writing to SharePoint…". | |
| B5 | Upload a second drawing with **DWG only** | Saves. Either file type alone is accepted. | |
| B6 | On an existing drawing click **Upload rev** | Confirm step shows **Revision** dropdown pre-set to the next revision (e.g. R1) with "Suggested: R1", plus Revision date and Planned date (blank). Revision can be changed. | |
| B7 | Confirm → checklist → upload | New revision appears in the R0–R5 date columns on the GFC log. | |

## C. Master register follows GFC

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| C1 | After B4, open Master register | A line exists for the drawing: type GFC, revision R0, revision date = the date entered. | |
| C2 | After B7 | Same line now shows R1 and the new revision date — no duplicate line. | |
| C3 | Set **Critical = Yes** inline | Saves; shows Yes after refresh and in the critical count / filter. | |
| C4 | Set **Planned submission date** to 10 days ago on a line with no actual submission | Delay shows **10 ▲** (still counting). Tomorrow it shows 11. | |
| C5 | Upload a revision for that drawing (B6–B7) | Actual date fills; delay becomes final (actual − planned), ▲ disappears. | |
| C6 | Upload a revision with Planned date left blank | Master register keeps the planned date set in C4 (not overwritten with today). | |

## D. Branded exports + SharePoint

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| D1 | Master register → **Download Excel** | Sharnam logo + title band; Master Drawing Register sheet with all 21 columns; delays red, critical amber; filters on header row. | |
| D2 | Master register → **Download PDF** | A3 landscape, logo, header repeats on each page, delays red (`*` = still counting), critical amber, footer with SPDC address and "Page x of y". No blank pages. | |
| D3 | GFC log → Download GFC Excel / PDF | GFC layout: Discipline, Building/Area, TL No, DWG No, Title, R0–R5 dates, Total. | |
| D4 | Click **Sync to SharePoint**, open 04.02 folder | Live files updated: `Approval-GFC-Drawing-Log.xlsx/.pdf`, `Master-Drawing-Register.pdf`, `DRAWING-REGISTER-01.xlsx`, `Design-Coordination-Register.xlsx/.pdf`; plus `Weekly/<YYYY-Www>/` copies. | |
| D5 | Make any upload/edit, wait ~1 min, refresh SharePoint | Files are rewritten automatically (no manual sync needed). | |

## E. Review the drawing

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| E1 | Open the PDF drawing from the GFC log | PDF previews in the portal (full screen available). | |
| E2 | Open the DWG drawing | "Open DWG in SharePoint" opens the file in the SharePoint viewer. | |

## F. Design coordination → RFI

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| F1 | Log an issue against the drawing, assign a matrix contact | Email to the assignee (matrix To/Cc copied) is in the email log. Issue appears in the register. | |
| F2 | **Reassign to…** another contact | "Assigned to you" email to the new assignee (previous assignee Cc) is in the email log. | |
| F3 | **Send follow-up** ×2 | Each follow-up is in the email log; counter shows 2/5. | |
| F4 | **Escalate to RFI** at 2/5 | Confirms "Only 2 of 5 follow-ups…". On OK: RFI number shown, issue status **Escalated**, RFI on the RFI register. | |
| F5 | Try escalating the same issue again | Blocked: "Already escalated to an RFI". | |
| F6 | New issue → 5 follow-ups | Follow-up button disables at 5/5; Escalate to RFI still available. | |
| F7 | **Register Excel / Register PDF** on Design coordination | Branded register with status colours (Escalated red, Closed green) and linked RFI number. | |

## G. RFI form + register

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| G1 | Open the RFI from F4 | SPDC RFI form view. Download Excel / HTML works. | |
| G2 | Check the email log | RFI email with a link to open/fill it in the portal is listed (delivered once mail goes live). | |
| G3 | SharePoint `03.06 …/_Registers/` | `SPDC_RFI_Form_and_Register.xlsx` includes the new RFI; the RFI's own form is filed. | |

## H. Office import / export (every register)

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| H1 | Master register → **Download Excel**, change a planned date and a Critical value in Excel, **Import Excel** | Same number of lines (no duplicates); the edited planned date and criticality show in the portal. | |
| H2 | GFC log → **Download GFC Excel** → **Import GFC Excel** (same file) | "Imported N drawings, 0 new revision dates" — no duplicate drawings. | |
| H3 | Design coordination → **Register Excel**, edit a description, **Import Excel** | "0 new, N updated. No emails were sent." Escalated issues keep status and follow-up count. | |
| H4 | Import a DC register row with a new issue title | Created as a new Open issue; no email is sent for imported rows. | |
| H5 | Log in as a non-office user (SPDC engineer, site, consultant) | No Import buttons on any register; Download Excel / PDF still available. | |

## I. Ask PMC (RFI) page

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| I1 | Drawings → **Ask PMC RFI** tab | Only the module tab strip on top. No "← Back to RFI register" link and no extra pills (Ask / Drawing checklist fill / All drawing RFIs). | |
| I2 | Look at the form | "Drawing Check checklist to attach **(optional)**". "Contractor proposed solution **\***" is required, with a note that an RFI without it is returned unanswered. | |
| I3 | Fill Subject + Question, leave proposed solution empty, click **Open RFI** | Browser blocks submit and points to the proposed-solution field. | |
| I4 | Add a proposed solution, link a drawing, **no checklist**, submit | RFI created (SPDC-RFI-00x). Message confirms it was written to SharePoint. | |
| I5 | Force an error (e.g. disconnect network) and submit | Message shows in **red**, not green. | |

## J. Right-hand action panel (every project module)

| # | Module page | Click | Expected | Pass/Fail |
|---|-------------|-------|----------|-----------|
| J1 | Approval & GFC log | **Upload drawing (GFC)** | Drawing Check Master checklist opens; page shows "Waiting for Drawing Check Master". | |
| J2 | Approval & GFC log | **Master register** / **Ask PMC RFI** | Opens Master register / the Ask PMC form. | |
| J3 | RFI register / Ask PMC | **Ask PMC RFI**, **Request checklist fill**, **RFI register** | Each opens that exact screen. Related links: Approval & GFC log, Master register, Design coordination. | |
| J4 | Design coordination | **Ask PMC RFI** / **RFI register** | Opens the Ask form / register (no button pretends to escalate). | |
| J5 | Comms | **New meeting (agenda)** | Agenda tab opens with the New meeting wizard. | |
| J6 | Comms | **Communication matrix** / **Minutes of meeting** | Opens the Matrix tab / MoM tab. | |
| J7 | Any page with "How this works" | — | No "Demo flow" badge. | |

## K. Meetings — agenda first, then schedule (Procore style)

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| K1 | Comms → Agenda → **+ New meeting** | Step 1 "Agenda": title + numbered agenda rows (add, reorder ↑↓, remove). Esc closes. | |
| K2 | Click **Next** with no agenda lines | Amber message: add at least one agenda item or use the standard agenda. | |
| K3 | **Use standard site agenda** → Next | Step 2 "Schedule & invite": date & time, duration, location, Teams option. | |
| K4 | Look at the people list | Everyone with an email on the Technical + Commercial matrix, grouped Client / PMC / Consultant / Contractor. A person on both matrices appears once. | |
| K5 | Tick a whole section, then a single person; switch one person between **To** and **Cc**; search by company | Counter shows "N selected · x To · y Cc"; search filters the list. | |
| K6 | Add an extra email in "Other emails" | Included as To. An invalid email blocks scheduling with a message. | |
| K7 | **Schedule & send invite** | Meeting appears with **Invited (N)** chips (To / Cc). Message says the invite is logged and will go out once mail is switched on. | |
| K8 | Email log | One invite: To = the To people, Cc = the Cc people — **only** those picked, not the whole matrix. Subject has the project code once. | |
| K9 | **Re-send agenda** | "Agenda re-sent to the invited attendees." Same recipients in the email log; agenda lines not duplicated. | |
| K10 | Start MoM → Create follow-up | Follow-up meeting keeps the same invited list; its email goes to the same people. | |

---

**Sign-off:** Tester ____________  Date ________  Result: ☐ Pass ☐ Pass with notes ☐ Fail
