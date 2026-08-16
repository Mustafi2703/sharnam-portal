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
| **Purpose** | Live GFC drawing log — upload PDF/DWG, revisions R0–R5, publish, revision history, markup on same revision. |

### Form: Add register line (no file)
| Field | Notes |
|-------|-------|
| drawingNumber, title, discipline, buildingArea, tlNo | `POST .../register-line` |

### Form: Upload new drawing (modal)
| Field | Notes |
|-------|-------|
| drawingNumber, title, discipline, buildingArea, tlNo | |
| revisionNumber, plannedDate, actualDate | |
| publish | checkbox |
| pdf, dwg | Separate slots — at least one required per revision |
| markup pages | Optional multi-page PDF markup; stored per page with full history |
| unlockToken | after drawing check |

**API:** `POST /api/drawings/project/:id` (multipart: `pdf`, `dwg`)

### Form: Upload revision (modal)
| Field | Notes |
|-------|-------|
| revisionNumber, revisionLabel, plannedDate, actualDate, publish | |
| pdf, dwg | Both allowed on same revision |
| Replace same revision | `PATCH /api/drawings/revision/:id/file` with `fileRole=pdf|dwg` |
| Markup pages | `POST /api/drawings/revision/:id/markup-pages` — full per-page history |

**SharePoint layout (ISO 04.02):**  
`04_DESIGN…/04.02_Drawings_and_Specifications/{Discipline}/{DrawingNo}/{Rev}/PDF|DWG|Markup/page-NN/`  
Each markup save gets a timestamped file — history is never overwritten in SharePoint.

### Modals
| Modal | Trigger | Purpose |
|-------|---------|---------|
| DrawingCheckModal | Before first upload | Unlock upload after checklist |
| UploadModal | Upload GFC / revision | Separate PDF + DWG pickers on same form |
| PdfMarkup / ImageMarkup | Markup on revision | Saves all marked pages; history per page |
| DrawingFileViewer | Preview | Tabs: Original PDF · Markup pages (history) · DWG download |

### Key actions
Export GFC CSV · Sync logs → SharePoint · Publish revision · Discipline filter

### Changes during testing
| Date | Raised by | Change requested | Decision | Status |
|------|-----------|------------------|----------|--------|
| | | | | Open |

### Client sign-off
- [ ] Page approved for UAT

---

## Page: Master drawing register

| | |
|--|--|
| **Route** | `/projects/:id/drawings/register?sheet=\|master\|client` |
| **Purpose** | DCI master register workbook views (dashboard, master lines, client view). |

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

See [03-quality](./03-quality.md) checklist pattern; family = `DrawingCheck`.  
RFI kinds: `DrawingChecklist`, `RequestForInformation`.
