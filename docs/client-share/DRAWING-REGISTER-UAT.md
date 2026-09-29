# Drawing register UAT — upload, charts, edit / delete

Use a clean Arvind (or pilot) project. Do **not** wipe CRM / HRMS / other live projects.

## A. Master register + dashboard (`DRAWING REGISTER - 01.xlsx`)

1. Open **Drawings → Register dashboard**.
2. Click **Upload Excel** and pick `DRAWING REGISTER - 01.xlsx` (Master Drawing Register sheet).
3. Confirm toast shows imported line count; KPI cards update.
4. Confirm **all charts** appear: discipline, drawing type, critical, package, building, consultant, building × discipline, delay responsibility.
5. Open **Master register** tab — rows match upload.
6. **Edit** one row → change title / planned date → **Save changes** → row updates.
7. **Delete** one test row (optionally with linked GFC) → row gone; dashboard counts drop.
8. **Add** one manual line via the form → appears in table + charts.
9. **Excel (01)** + **Dashboard PDF** download; open files and check pivots / KPIs.
10. **Publish → SharePoint** → wait for success; check project drawings folder for:
    - `DRAWING-REGISTER-01.xlsx`
    - `DRAWING-REGISTER-Dashboard.pdf`

## B. Approval & GFC log (`Approval & GFC Drawing Log.xlsx`)

1. Open **Approval & GFC log**.
2. **Export & sync → Upload GFC Excel** with the Approval & GFC workbook.
3. Confirm discipline / building / R0–Rn date columns populate.
4. **Edit** planned date on a revision cell (if present).
5. **Delete** one drawing row from the row actions.
6. **Download GFC Excel** and spot-check columns vs workbook.
7. **Publish registers → SharePoint** → confirm `Approval-GFC-Drawing-Log.xlsx`.

## C. Drawing check master (`Drwing check master checklist.xlt.xls`)

1. **Drawings → Checklist manager**.
2. **Reload from drawing check master XLS** (or create/edit a checklist + add a line).
3. Raise **RFI → Request checklist fill** (DrawingChecklist) OR run **Drawing Check** pre-upload gate before a GFC upload.
4. Confirm fill unlocks GFC upload.

## Pass criteria

- Upload works for master register and GFC log without Hostinger panel.
- Charts show all pivot families once data exists.
- Edit + delete work on master lines and GFC rows.
- SharePoint files are proper Excel/PDF (not only CSV).
- No impact on CRM / HRMS / Voltamp data.
