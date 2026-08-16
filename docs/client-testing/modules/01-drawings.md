# Module 01 — Drawings

**Test order:** #2  
**Hub:** `/projects/:id/hub/drawings`

---

## Tool nav tabs (module strip)

Module hub · GFC register · Register dashboard · Master register · Client register · Drawing files · Checklist manager · Checklist fill log · Request fill · Ask RFI · Design coordination

---

## Page: GFC register

| | |
|--|--|
| **Route** | `/projects/:id/drawings` |
| **Purpose** | Live GFC drawing log — upload PDF/DWG, revisions R0–Rn, publish, revision history, markup on same revision. |

### Register columns (R0–Rn)
| Rule | Notes |
|------|-------|
| Column = revision **number** | R2 data always appears under **R2**, not by upload order |
| Dynamic columns | Table adds R6, R7… when project has higher revisions |
| Planned / actual dates | `P:…` / `A:…` in cell; tooltip shows revision label |
| **Total** | Count of unique revision numbers (R0, R1, R2…) |
| **Current rev** | Drawing `currentRev` — shown in Browse + upload log **CURRENT** badge |
| **Browse · Latest** | Opens published/current revision (not a stale draft row) |

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
| **Site register block** | received date, copies, issued to contractor/client, **signature pads** (PNG → SharePoint `…/Signatures/`) |

**API:** `POST /api/drawings/project/:id` (multipart: `pdf`, `dwg`)

### Form: Upload revision (modal)
| Field | Notes |
|-------|-------|
| revisionNumber, revisionLabel, plannedDate, actualDate, publish | |
| pdf, dwg | Both allowed on same revision |
| **Same rev number again** | Updates **same row** (no duplicate R2 rows) — checklist not required for update |
| **New rev number** | Requires Drawing Check unlock token |
| **Site register block** | Same receive/issue + signature fields as new drawing upload |
| Replace PDF / DWG on log row | `PATCH /api/drawings/revision/:id/file` with `fileRole=pdf|dwg` |
| Markup pages | `POST /api/drawings/revision/:id/markup-pages` — full per-page history |

### Upload modal (accordion log)
| Action | Modal mode | Checklist required? |
|--------|------------|---------------------|
| **+ Next revision** | New revision | Yes |
| **Update files** | Same revision — PDF + DWG + dates | No |
| **Replace PDF** | PDF only (+ optional markup) | No |
| **Replace DWG** | DWG only | No |
| **PDF markup** | Full-screen markup editor | No |
| **Upload GFC** (top bar) | New drawing row | Yes |

Modal opens from the expanded log row; saving refreshes R0–Rn columns and **CURRENT** badge.
| Step | Expected |
|------|----------|
| Upload R2 with PDF | R2 column shows date; log shows R2 **CURRENT** if published |
| Replace PDF on R2 | Same R2 row updated; no second R2 line |
| Add PDF markup (multi-page) | Markup count badge; viewer shows page history |
| Replace DWG on R2 | PDF + markup unchanged |
| Re-upload R2 via modal with new PDF | Same row updated; `currentRev` stays R2 |
| Upload R3 | New row; R3 column fills; **CURRENT** moves to R3 when published |
| Export GFC CSV | R0–Rn columns match register; Total = unique rev count |

**SharePoint layout (ISO 04.02):**  
`04_DESIGN…/04.02_Drawings_and_Specifications/{Discipline}/{DrawingNo}/{Rev}/PDF|DWG|Markup/page-NN/`  
Each markup save gets a timestamped file — history is never overwritten in SharePoint.

### Modals
| Modal | Trigger | Purpose |
|-------|---------|---------|
| DrawingCheckModal | Before **new** revision | Unlock upload after checklist |
| UploadModal | Upload GFC / revision | Separate PDF + DWG pickers on same form |
| PdfMarkup / ImageMarkup | Markup on revision | Saves all marked pages; history per page |
| DrawingFileViewer | Preview | Tabs: Original PDF · Markup pages (history) · DWG download |

### Key actions (upload log per drawing)
| Action | Purpose |
|--------|---------|
| **Replace PDF** | New PDF file on same revision row |
| **PDF markup** | Annotate pages — append-only history |
| **Replace DWG** | New DWG on same row |
| **+ Next revision** | Drawing check → next rev (R0→R1→… no cap at R5) |
| **Publish** | Mark drawing live for checklists |
| Export GFC CSV · Sync logs → SharePoint · Discipline filter |

### Routes: Drawing checklist (Drawings module only)
| Route | Purpose |
|-------|---------|
| `/projects/:id/drawings/checklist-master` | Drawing check templates only (no Quality/Safety tabs) |
| `/projects/:id/drawings/checklist-logs` | Drawing fill log only |

### Changes during testing
| Date | Raised by | Change requested | Decision | Status |
|------|-----------|------------------|----------|--------|
| 2026-08-17 | Client | Many file changes per revision; fix duplicate R2 rows; R0–Rn columns by rev number | Upsert same rev; dynamic columns; Replace PDF/DWG | Done |
| 2026-08-17 | Client | Master + Site drawing registers from workbook; signatures on upload | Master sheet all DCI cols; Site R0–R6 matrix; signature pad on GFC upload | Done |

### Client sign-off
- [ ] Page approved for UAT

---

## Page: Master drawing register

| | |
|--|--|
| **Route** | `/projects/:id/drawings/register?sheet=master` |
| **Purpose** | DCI master register — all client columns from `DRAWING REGISTER - 01.xlsx`. |

### Columns (match client workbook)
Sr # · Project Package · Building · Discipline · Drawing Number · Drawing Title · Drawing Type · Consultant Name · Revision Number · Revision Date · Revision Description · Latest Revision · Planned Submission Date · Actual Submission Date · Submission Delay (Days) · Delay Responsibility · Issued To · Issue Date · No. of Copies · Critical Drawing · Remarks

**Auto-sync:** When GFC is uploaded/updated, matching master line updates rev, dates, delay, copies, and GFC link.

---

## Page: Site drawing register

| | |
|--|--|
| **Route** | `/projects/:id/drawings/register?sheet=site` |
| **Purpose** | Site receive & issue matrix — R0–R6 × receive date, copies, issued to contractor/client, **receiver signatures**. |

### Matrix rows (per drawing)
Date of receiving · Total copies received · Issued to contractor · Receiver signature (contractor) · Issued to client · Receiver signature (client)

**Source:** Populated from GFC upload modal **Site drawing register — receive & issue** section (signature pad + dates).

---

## Page: Client drawing register

| | |
|--|--|
| **Route** | `/projects/:id/drawings/register?sheet=client` |
| **Purpose** | Client-facing subset — issued to, issue date, copies, critical flag. |

---

## Page: Register dashboard

| | |
|--|--|
| **Route** | `/projects/:id/drawings/register` |
| **Purpose** | Week KPIs and charts from `DRAWING REGISTER - 01.xlsx`. |

---

## Page: Master drawing register (add line form)

| | |
|--|--|
| **Route** | `/projects/:id/drawings/register?sheet=master` |

### Form: Add register line
| Field |
|-------|
| drawingNumber, drawingTitle, discipline, projectPackage, building, drawingType, consultantName, revisionNumber, criticalDrawing, remarks |

**API:** `POST /api/drawings/project/:id/register-lines`

### Modals
None.

### Changes during testing
| Date | Raised by | Change requested | Decision | Status |
|------|-----------|------------------|----------|--------|
| | | | | Open |

### Client sign-off
- [ ] Page approved for UAT

---

## Page: Drawing files (SharePoint)

| | |
|--|--|
| **Route** | `/projects/:id/drawings/library` |
| **Purpose** | Browse design folders in SharePoint (not general DMS). |

### Modals
UploadModal · DrawingFileViewer

### Changes during testing
| Date | Raised by | Change requested | Decision | Status |
|------|-----------|------------------|----------|--------|
| | | | | Open |

---

## Page: Design coordination

| | |
|--|--|
| **Route** | `/projects/:id/drawings/coordination` |
| **Purpose** | Clash/design issues; link drawing; escalate to Ask RFI. |

### Form: Raise issue
title, discipline, priority, location, assignedToName, dueDate, linkedDrawingId, ballInCourt, description → `POST .../coordination`

### Modals
DrawingFileViewer (linked sheet preview)

### Changes during testing
| Date | Raised by | Change requested | Decision | Status |
|------|-----------|------------------|----------|--------|
| | | | | Open |

---

## Page: Revision upload (standalone)

| | |
|--|--|
| **Route** | `/projects/:id/drawings/upload-revision/:drawingId?` |

Drawing check panel → revision upload form. See GFC modals above.

---

## Page: Drawing pre-check (fullscreen)

| | |
|--|--|
| **Route** | `/projects/:id/drawings/precheck` |

Per checklist item: answer, remarks → `POST .../drawing-precheck`

---

## Page: Drawing checklist master / fill log / RFIs

| Route | Notes |
|-------|-------|
| `/projects/:id/drawings/checklist-master` | DrawingCheck only |
| `/projects/:id/drawings/checklist-logs` | Drawing fills only |
| `/projects/:id/rfis?kind=DrawingChecklist` | Request fill |
| `/projects/:id/rfis?kind=RequestForInformation` | Ask RFI |

Quality / Safety checklist masters live under their own modules — not on Drawing checklist manager.
