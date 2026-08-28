# Sharnam portal — User Acceptance Test script

Everything below is meant to be run by you (or one of your team leads) end-to-end.
Follow the sections in order — each one flushes real data into the system so the
next section has something to work with. Every step lists the exact click path,
the visible outcome you should see, and the underlying API call the system fires so
you can confirm from the network tab or the audit log if you want.

Estimated time: **~35 minutes** for a full pass.
Roles required: **1× admin/office login**, **1× site_employee login** (for RA visibility check).

> Any step that lists a “sample file” path is already in the repo and works out of
> the box. If you want richer data ping me — I can seed a week of DPRs, WPRs and
> a few sample RA bills so the graphs look real from the get-go.

---

## 0. Pre-flight (2 min)

1. Log in as **admin** and confirm you see the Cost, Progress, Finance, CRM and HRMS
   modules on the top nav.
2. Open **Health**: hit `GET /api/health` in a new tab. You should see `dbOk: true`,
   `mockOneDrive: true` (or `graphConfigured: true` if you already wired the Azure creds),
   and the current commit hash. **If dbOk is false, stop and ping me — nothing else will save.**
3. Run `npx prisma migrate deploy` (or `npm run db:push` in staging) so the three new
   models are in the database:
   - `RaBillRevision` (RA-bill Submitted → Corrected → Certified log)
   - `HrmsDocument` (Appointment / Relieving / Exit / Asset Return letters)
   - `Lead` extra columns (Sr No, Latest Status, District, Segment, etc.)

---

## 1. CRM — bulk-load your leads sheet (5 min)

Goal: prove that the July 2026 workbook flows into the system, statuses stick,
and the pipeline board reflects the market status without any manual re-typing.

1. Go to **`/crm`** → **Leads board** tab.
2. Click **Upload** in the toolbar. Pick
   `module_prompts/Sharnam_modules_docs 2/Data - July 2026.xlsx` from your machine.
3. Wait ~5 seconds. The toast should read `Imported: 530 created, 0 updated, 0 skipped.`
4. Scroll: you should now see 530 cards spread across the pipeline stages. On each
   card you get the **Latest Status** (On Hold / Pre-Construction / Under Construction / …)
   and the sub-status chip. District + state show under the title.
5. Click **Upload** again with the same file → you should see `0 created, 530 updated`.
   This proves the importer is idempotent (safe to re-upload weekly).
6. Change any card's Latest Status from the API:
   `PATCH /api/crm/leads/<id>` body `{ "latestStatus": "Dropped" }` → the card
   moves in the top-of-page status bar immediately on refresh.

**Column contract** (already agreed — this is what the importer reads):

| Sheet header            | System column      | Notes                                   |
| ----------------------- | ------------------ | --------------------------------------- |
| Sr No                   | `srNo`             | Used to identify a row on re-upload     |
| Project Name            | `title`            | Required                                |
| Latest Status           | `latestStatus`     | Free text — shown as top chip           |
| Latest Sub Status       | `latestSubStatus`  | Free text — shown as second chip        |
| Latest Status Update    | `latestStatusUpdate` | DD/MM/YYYY or ISO                     |
| Landmark                | `landmark`         |                                         |
| District                | `district`         |                                         |
| State                   | `state`            |                                         |
| Pin Code                | `pinCode`          |                                         |
| Segment                 | `segment`          |                                         |
| Sub-Segment             | `subSegment`       |                                         |
| Sector                  | `sector`           |                                         |
| Project Type            | `projectType`      | New / Expansion                         |
| Description             | `description`      | Free text — full paragraph accepted     |

Extra columns in the workbook are ignored. Re-uploading merges on `(srNo, sourceSheet)`.

---

## 2. RA-bill discipline — Submitted → Corrected → Certified (10 min)

Goal: prove the three-click flow you asked for. Each click uploads a **new**
workbook (no overwrite), the log records who uploaded what and when, and PMC
can open every version directly on SharePoint.

1. Open any project → **Finance → RA Bill Tracker**.
2. Add a new RA bill (`RA-01`) against any PO. You can leave the amounts empty.
3. In the new **Stage uploads · SharePoint** column, click **+ Submitted**.
   Pick any workbook (e.g. a contractor's Excel for RA-01). The button briefly
   shows "…" then the row moves to `Submitted` status and a **Latest (Submitted R1)**
   link appears — that opens the exact file on SharePoint / mock OneDrive.
4. Click **+ Corrected** and pick a different file. Status flips to `Under Review`
   and a **Corrected R1** link is added. Click **Log** to expand the panel; you
   should see two rows: the Corrected and the Submitted, with your name + IST
   timestamp on each.
5. Click **+ Certified** with the final signed workbook. Status becomes `Certified`
   (green badge) and a **Certified R1** link is added. Payment Summary + COP tab
   already read this bill so the certified amount flows to name-wise cash tracking
   without any manual copy.
6. Repeat **+ Corrected** — this is allowed after certification (real world does it);
   revision number goes to R2, R3, … so nothing is lost.
7. Log out and log back in as a **site_employee** who is on this project. You
   should be able to see the RA bill and click through to the SharePoint links,
   but the **+ Submitted / + Corrected / + Certified** buttons should be
   disabled (view-only). Confirming: `403` on `POST /api/finance/ra/:id/stage`
   from that user.

**Nothing is form-filled here.** Every file lands as-is under
`09_COMMERCIAL_AND_CHANGE/09.01_Interim_Bill_Verification_Certification` and
the SharePoint link opens the file in the browser Excel viewer — contractors
keep their own format, the system just keeps the trail.

---

## 3. COP — Excel + PDF with Sharnam logo (5 min)

1. Same Finance tool → **COP** tab.
2. Fill the COP form, link it to `RA-01` from step 2, click **Add COP**.
3. In the register table, click **Download Viatrix COP (.xlsx)** on that row.
   The workbook opens in Excel with the Sharnam logo on the header (already
   in `brandedExport.ts`) and matches the client Viatrix format sheet layout.
4. Click **Save to DMS** — the same workbook lands under 09.01 Interim on
   SharePoint. The link on the row is now green.
5. In Excel, use **File → Print → Save as PDF** (or **Save As → PDF**) to get
   the PDF companion. Both files share the same reference number.

---

## 4. HRMS letters — Appointment / Relieving / Exit / Asset (7 min)

Goal: end-to-end proof that the four letter kinds you listed generate with the
Sharnam logo, produce a soft editable copy + a printable letter, and store the
signed copy back.

1. Log in as **admin**, go to **`/hrm/documents`** (the new **Letters** tab in
   the HRMS rail).
2. Kind = **Appointment letter**. Fill:
   - Employee: `Nirav Doe`
   - Designation: `Planning Engineer`
   - Function: `Planning & Controls`
   - Effective / joining date: `01/09/2026`
   - Fixed CTC: `9,00,000`
   - Base location: `SPDC Corporate Office, Vadodara`
3. Click **Generate & file**. Toast: `Appointment · SPDC/HR/OL/26-27/XXXX generated…`.
4. The row appears in the register with two links:
   - **Letter (HTML → PDF)** — opens the branded letter in a new tab.
     In Chrome, `Ctrl/Cmd + P` → **Save as PDF** gives you the PDF copy.
   - **Editable annexure (.xlsx)** — the soft-copy Annexure with all the fields
     the letter used, editable and re-savable.
5. Repeat for **Relieving letter** (fill last working day) and **Exit letter**
   (paste a reason). Confirm each carries the logo.
6. **Asset submission letter**: fill Assets = `Laptop, mobile, SIM`, Serials =
   `SPDC-LT-042, SPDC-SIM-018`. Generate. The letter is a signed acknowledgement.
7. Click **+ Signed copy** on any row, upload a PDF/image of the countersigned
   letter. Status becomes `Signed` and the file appears as **Signed copy** link.
8. Real letterhead swap-in: drop `Appointment.html` (with `{{placeholder}}`
   tokens — see `apps/api/formats/hrms/README.md`) into `apps/api/formats/hrms/`.
   Click **Regenerate** on the same row → the letter now uses your format.
   No code deploy needed.

---

## 5. Cross-module linkage smoke test (3 min)

1. On the RA bill from step 2, verify `attachmentUrl` now points to the latest
   uploaded file (SharePoint URL if configured, else `/uploads/onedrive/…`).
2. Open **Finance → Payment Summary → Download .xlsx**. The certified amount
   from step 2.5 shows up in the vendor / name-wise cash tracking sheet.
3. Open **Cost → Cashflow** for the same project. The CoP amount from step 3
   flows into the actual cashflow month (via `syncCopToCashflow`).

---

## 6. Data-leakage smoke test (3 min)

1. Log in as a **site_employee** who is member of Project A but not Project B.
2. Try `GET /api/finance/<Project B id>/ra`, `GET /api/cost/<Project B id>/monitoring`,
   `GET /api/progress/<Project B id>/summary` from the browser dev tools.
   All three should return `404 Not found` (never `403` — that would leak
   whether the project exists).
3. Try `POST /api/finance/ra/<id from Project B>/stage` — same 404.

---

## What to file back to me if something breaks

For any step that misbehaves please paste:

- The exact URL of the page (so I know which module).
- Screenshot of the browser + the failing toast.
- Response body of the network call (open dev-tools → Network → click the
  red request → Response tab).
- Timestamp in IST so I can pull the audit trail.

I'll turn every reported item into a fix within the same day.

---

## Sample data seed (optional)

If you want the portal to look pre-populated for a workshop:

- Leads: use the `Data - July 2026.xlsx` from `module_prompts/`.
- RA bills + CoPs: import `SPDC_Payment_Summary` workbook via
  `POST /api/finance/:projectId/payment-summary/import` — that seeds a week of
  bills with statuses already set.
- DPRs / WPRs: I can run `scripts/seed-week-of-dprs.mts` (already in the repo)
  and drop a fresh set for the demo project. Say the word and I'll wire the
  command into the seed script.
