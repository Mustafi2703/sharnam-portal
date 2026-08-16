# Module 01 — Drawings

**Test order:** #2  
**Hub:** `/projects/:id/hub/drawings`  
**Source workbook:** `DRAWING REGISTER - 01.xlsx` (seeded on demo project — 41 master lines)

---

## Tool nav tabs (module strip)

Module hub · GFC register · Register dashboard · **Master register** · **Site register** · Design coordination · Drawing files · Checklist manager · Checklist fill log · Request fill · Ask RFI

> **Note:** The old **Client register** tab was removed — its columns (Issued to, Issue date, Copies, Critical) are already on **Master register**. The workbook sheet *Drawing Register - Client* was a subset view only.

---

## Workbook → portal map

| Client Excel sheet | Portal route | Purpose |
|--------------------|--------------|---------|
| Drawing & GFC Drawing Log | `/projects/:id/drawings` | Live upload log, R0–Rn columns, PDF/DWG |
| **Master Drawing Register** | `…/register?sheet=master` | Full DCI register (41 cols incl. issue + critical) |
| **Site Drawing Register** | `…/register?sheet=site` | R0–R6 receive/issue matrix + **signatures** |
| DRAWING REGISTER · Dashboard | `…/register` | Week KPIs + pie charts |
| Drwing check master checklist | `…/drawings/checklist-master` | Pre-upload Drawing Check only |

---

## Page: GFC register

| | |
|--|--|
| **Route** | `/projects/:id/drawings` |
| **Purpose** | Live GFC drawing log — upload PDF/DWG, revisions R0–Rn, publish, revision history, markup, **receive/issue + signatures**. |

### Register columns (R0–Rn)
| Rule | Notes |
|------|-------|
| Column = revision **number** | R2 data always appears under **R2**, not by upload order |
| Dynamic columns | Table adds R6, R7… when project has higher revisions |
| Planned / actual dates | `P:…` / `A:…` in cell; tooltip shows revision label |
| **Total** | Count of unique revision numbers (R0, R1, R2…) |
| **Current rev** | Drawing `currentRev` — shown in Browse + upload log **CURRENT** badge |
| **Browse · Latest** | Opens published/current revision (not a stale draft row) |

### Upload log (expand **Log** on any row)
| Block | What office sees |
|-------|------------------|
| Files | PDF/DWG filenames, markup count, View button |
| **Site register — receive & issue** | Received date, copies, issued to contractor/client, **contractor + client signature thumbnails**, remarks |
| Actions | Update files · Replace PDF · PDF markup · Replace DWG |

Office UAT: upload a revision with signature pads filled → expand log → confirm thumbnails appear without opening Site register.

### Form: Add register line (no file)
| Field | Notes |
|-------|-------|
| drawingNumber, title, discipline, buildingArea, tlNo | `POST .../register-line` |

### Form: Upload new drawing (modal)
| Field | Notes |
|-------|-------|
| drawingNumber, title, discipline, buildingArea, tlNo | |
| revisionNumber, plannedDate, actualDate | |
| publish | checkbox — sets current published revision |
| pdf, dwg | Separate slots — at least one required per revision |
| markup pages | Optional multi-page PDF markup; stored per page with full history |
| unlockToken | after drawing check |
| **Site register block** | received date, copies, issued to contractor/client, **signature pads** (PNG → SharePoint `…/Signatures/contractor|client`) |

**API:** `POST /api/drawings/project/:id` (multipart: `pdf`, `dwg`, `contractorSignature`, `clientSignature`)

### Form: Upload / update revision (modal)
| Field | Notes |
|-------|-------|
| revisionNumber, revisionLabel, plannedDate, actualDate, publish | |
| pdf, dwg | Both allowed on same revision |
| **Same rev number again** | Updates **same row** (no duplicate R2 rows) — checklist not required for update |
| **New rev number** | Requires Drawing Check unlock token |
| **Site register block** | Same receive/issue + signature fields — visible on log after save |
| Replace PDF / DWG on log row | `PATCH /api/drawings/revision/:id/file` with `fileRole=pdf|dwg` + issue fields |
| Markup pages | `POST /api/drawings/revision/:id/markup-pages` — full per-page history |

### Upload modal (accordion log)
| Action | Modal mode | Checklist required? |
|--------|------------|---------------------|
| **+ Next revision** | New revision | Yes |
| **Update files** | Same revision — PDF + DWG + dates + signatures | No |
| **Replace PDF** | PDF only (+ optional markup + signatures) | No |
| **Replace DWG** | DWG only (+ optional signatures) | No |
| **PDF markup** | Full-screen markup editor | No |
| **Upload GFC** (top bar) | New drawing row | Yes |

| Step | Expected |
|------|----------|
| Upload R2 with PDF + contractor signature | R2 column shows date; log shows signature thumbnail |
| Replace PDF on R2 | Same R2 row updated; signature block unchanged unless re-captured |
| Office expands **Log** | Receive/issue dates + both signatures visible |
| Site register tab | Same data in R2 column matrix |
| Master register | Matching drawing number updates rev, dates, copies, issue date |
| Export GFC CSV | R0–Rn columns match register; Total = unique rev count |

**SharePoint layout (ISO 04.02):**  
`04_DESIGN…/04.02_Drawings_and_Specifications/{Discipline}/{DrawingNo}/{Rev}/PDF|DWG|Markup/page-NN/Signatures/contractor|client`

### Modals
| Modal | Trigger | Purpose |
|-------|---------|---------|
| DrawingCheckModal | Before **new** revision | Unlock upload after checklist |
| UploadModal | Upload GFC / revision | PDF + DWG + **DrawingIssueFields** (signatures) |
| PdfMarkup / ImageMarkup | Markup on revision | Saves all marked pages; history per page |
| DrawingFileViewer | Preview | Tabs: Original PDF · Markup pages (history) · DWG download |

### Routes: Drawing checklist (Drawings module only)
| Route | Purpose |
|-------|---------|
| `/projects/:id/drawings/checklist-master` | Drawing check templates only |
| `/projects/:id/drawings/checklist-logs` | Drawing fill log only — **no** Site/Quality/Safety tabs |

### Changes during testing
| Date | Raised by | Change requested | Decision | Status |
|------|-----------|------------------|----------|--------|
| 2026-08-17 | Client | Many file changes per revision; fix duplicate R2 rows; R0–Rn columns by rev number | Upsert same rev; dynamic columns; Replace PDF/DWG | Done |
| 2026-08-17 | Client | Master + Site drawing registers; signatures on upload | Master all DCI cols; Site R0–R6 matrix; signature pad on GFC upload | Done |
| 2026-08-17 | Client | Master vs Client register redundant; signatures visible on GFC log | Removed Client tab; signatures on upload log; Master includes client cols | Done |

### Client sign-off
- [ ] Page approved for UAT

---

## Page: Master drawing register

| | |
|--|--|
| **Route** | `/projects/:id/drawings/register?sheet=master` |
| **Excel source** | Sheet **Master Drawing Register** in `DRAWING REGISTER - 01.xlsx` |
| **Purpose** | Single DCI register — supersedes old separate “Client register” view. |

### Columns (match client workbook)
Sr # · Project Package · Building · Discipline · Drawing Number · Drawing Title · Drawing Type · Consultant Name · Revision Number · Revision Date · Revision Description · Latest Revision · Planned Submission Date · Actual Submission Date · Submission Delay (Days) · Delay Responsibility · **Issued To** · **Issue Date** · **No. of Copies** · **Critical Drawing** · Remarks · GFC link

**Auto-sync:** GFC upload/update on matching `drawingNumber` updates rev, dates, delay, copies, issue date, and GFC link.

### Form: Add register line
| Field |
|-------|
| drawingNumber, drawingTitle, discipline, projectPackage, building, drawingType, consultantName, revisionNumber, criticalDrawing, remarks |

**API:** `POST /api/drawings/project/:id/register-lines`

### Client sign-off
- [ ] Page approved for UAT

---

## Page: Site drawing register

| | |
|--|--|
| **Route** | `/projects/:id/drawings/register?sheet=site` |
| **Excel source** | Sheet **Site Drawing Register** in client workbook |
| **Purpose** | Receive & issue matrix — R0–R6 × dates, copies, **receiver signatures**. |

### Matrix rows (per drawing)
Date of receiving · Total copies received · Issued to contractor · Receiver signature (contractor) · Issued to client · Receiver signature (client)

**Source:** GFC upload modal **Site drawing register — receive & issue** (same data as GFC log block).

### Client sign-off
- [ ] Page approved for UAT

---

## Page: Register dashboard

| | |
|--|--|
| **Route** | `/projects/:id/drawings/register` |
| **Purpose** | Week KPIs and charts from dashboard sheet in `DRAWING REGISTER - 01.xlsx`. |

---

## Page: Drawing files (SharePoint)

| | |
|--|--|
| **Route** | `/projects/:id/drawings/library` |
| **Purpose** | Browse design folders in SharePoint (not general DMS). |

### Client sign-off
- [ ] Page approved for UAT

---

## Page: Design coordination

| | |
|--|--|
| **Route** | `/projects/:id/drawings/coordination` |
| **Purpose** | Clash/design issues; link drawing; escalate to Ask RFI. |

### Client sign-off
- [ ] Page approved for UAT

---

## Page: Drawing checklist master / fill log / RFIs

| Route | Notes |
|-------|-------|
| `/projects/:id/drawings/checklist-master` | DrawingCheck only — no Quality/Safety/Site tabs |
| `/projects/:id/drawings/checklist-logs` | Drawing fills only |
| `/projects/:id/rfis?kind=DrawingChecklist` | Request fill |
| `/projects/:id/rfis?kind=RequestForInformation` | Ask RFI |

Quality / Safety checklist masters live under their own modules.

---

## UAT script — signatures (office role)

1. Open **GFC register** → pick drawing **AR-101** → **Log** → note current revision.
2. **Update files** on current rev → fill received date, copies, capture **contractor signature** on pad → Save.
3. Expand **Log** again → confirm **Site register — receive & issue** block shows dates + signature image.
4. Open **Site register** tab → confirm same revision column shows signature thumbnail.
5. Open **Master register** → confirm copies / issue date updated for AR-101.
