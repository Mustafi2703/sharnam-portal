# Drawings module — button-by-button (mark changes)

Project path: `/projects/:id/hub/drawings` → open any card below.  
Reply with `[OK]` / `[FIX: …]` / `[CHANGE: …]` on each row.

---

## How the module fits the job

```
Master register line (optional)
        ↓
Drawing Check (signed checklist) → unlockToken (one-time)
        ↓
Upload PDF/DWG as R0 (or new revision) → files land in 04.02
        ↓
Publish / Sync registers (GFC log, master, dashboard) → 04.02
        ↓
Design coordination issues / markups → 04.04 (+ Drawing_Checklists)
        ↓
Escalate to RFI or raise Ask (PMC RFI) → 03.06
```

Client: **view** drawings + raise concerns/RFIs — **cannot** upload GFC.  
Site / office / employee: upload after Drawing Check.  
Consultant (as employee on matrix): answer RFIs, markups, coordination — not GFC upload as vendor-only path.

---

## Hub cards (each button)

### 1. Approval & GFC log
**URL:** `…/drawings`  
**What it is:** Main drawing desk — list of drawings / revisions, upload, view, publish.

| Action on this page | What it does today |
|---|---|
| Add / register line | Creates a drawing number + title on the project (no file yet; **no** Drawing Check required) |
| Upload (new drawing) | **Forces Drawing Check first** → then PDF/DWG → creates R0 and files under `04.02/…/{drawingNo}/R0` |
| Upload revision | Same gate for a **new** rev number; replacing/updating the **same** rev does **not** re-run Drawing Check |
| View PDF / DWG | Opens the filed revision |
| Publish / Sync to SharePoint | Pushes register exports (GFC log, master, dashboard copies) to `04.02` |
| Export Excel / PDF / pack | GFC log workbook/PDF; optional drawing pack ZIP |
| Import GFC Excel | Office/admin — bulk from Approval & GFC workbook |

**Mark:** `[ ]`

---

### 2. Dashboard
**URL:** `…/drawings/register`  
**What it is:** DRAWING REGISTER charts — by location, critical, delay, organisation; week filter; branded PDF.

| Action | What it does |
|---|---|
| Filters / week | Chart views from master register data |
| Export PDF / Excel | Dashboard PDF + master workbook downloads |
| Edit (if allowed) | Same underlying register as Master |

**Mark:** `[ ]`

---

### 3. Master register
**URL:** `…/drawings/register/master`  
**What it is:** Full register table — planned submission dates, criticality, delays, package, consultant, etc. Updated when GFCs are uploaded.

| Action | What it does |
|---|---|
| Add / edit lines | Planned vs actual dates, critical flag, remarks |
| Import Excel | Office loads DRAWING REGISTER workbook |
| Export Excel / PDF | Master register branded exports → also synced under `04.02` |

**Mark:** `[ ]`

---

### 4. Drawing settings *(admin / office only)*
**URL:** `…/drawings/settings`  
**What it is:** Pick-lists (disciplines, packages, types…) and workbook load/save for register + GFC + RFI-related lists; Sync to SharePoint.

**Mark:** `[ ]`

---

### 5. Design coordination
**URL:** `…/drawings/coordination`  
**What it is:** Clash / design issue register (not a full RFI yet).

| Action | What it does |
|---|---|
| Create issue | Assign to matrix person → email |
| Follow-up | Up to **5** follow-ups (6th refused) |
| Escalate to RFI | Creates `SPDC-RFI-###`, links drawing, assignee from matrix |
| Attachments / markups | Files + markup PDF under `04.04` / Markups |
| Export Excel / PDF | Design coordination register |
| Import | Office can load coordination workbook |

**Mark:** `[ ]`

---

### 6. Drawing files
**URL:** `…/drawings/library`  
**What it is:** DMS browser **scoped to design/drawing ISO folders** (not the whole project DMS). Browse/upload/preview PDF/DWG in `04.02` tree.

**Mark:** `[ ]`

---

### 7. Checklist manager *(admin / office / employee)*
**URL:** `…/drawings/checklist-master`  
**What it is:** **Drawing Check Master** templates only (not Quality/Safety). Edit lines, require-photo flags, etc. Upload flow uses this template for the pre-upload gate.

**Mark:** `[ ]`

---

### 8. Checklist fill log
**URL:** `…/drawings/checklist-logs`  
**What it is:** All Drawing Check fills (drafts + submitted). Office can review; branded Excel/PDF download. Fills file to **`04.04/Drawing_Checklists`**.

**Mark:** `[ ]`

---

### 9. RFI register
**URL:** `…/rfis?view=register`  
**What it is:** Correspondence RFIs (drawing-linked). List Open / Answered / Closed; export SPDC RFI register workbook. Files under **`03.06`**.

**Mark:** `[ ]`

---

### 10. Ask (PMC RFI)
**URL:** `…/rfis?kind=RequestForInformation&compose=1`  
**What it is:** Compose a new PMC RFI — subject, question, assignee from matrix, optional drawing link, markup. Site/office/vendor/client (client = concern path as configured).

**Mark:** `[ ]`

---

## Hidden / related screens (not separate hub cards)

| Screen | When you see it | What it does |
|---|---|---|
| Drawing Check overlay / `…/drawings/precheck` | Before every **new** GFC upload or **new** revision | Answer all lines + signature → one-time `unlockToken` |
| Upload revision (legacy URL) | `…/drawings/upload-revision` | Redirects into GFC log with `?upload=rev` |
| Markup panel | On RFI or coordination | Stamp comments on drawing PDF → Markups folder |
| Module files `…/drawings/files` | Files panel | Portal + SharePoint files for drawings module |

**Mark:** `[ ]`

---

## Who can do what (Drawings)

| Role | See hub | Upload GFC | Settings | Coordination | Drawing Check | Raise RFI |
|---|---|---|---|---|---|---|
| Office / admin | Yes | Yes | Yes | Yes | Yes | Yes |
| Site | Yes | Yes | No | Yes | Yes | Yes |
| Employee | Yes | Yes | No | Yes | Yes | Yes |
| Client | Yes | **No** | No | No | No | Concerns / limited |
| Vendor | Often **no** workspace card | API may allow; UI hub weak | No | No | Yes (API) | Yes if they open RFIs |
| Consultant (employee) | Yes | No (typical) | No | Yes / markups | If employee | Answer RFIs |

**Mark:** `[ ]` (especially vendor vs consultant)

---

## SharePoint map (drawings-related)

| Content | Folder |
|---|---|
| PDF / DWG per drawing/rev | `04.02_Drawings_and_Specifications/…` |
| GFC / master / dashboard exports | `04.02_…` |
| Design coordination docs + register | `04.04_Clash_Detection_Design_Coordination` |
| Drawing Check fills | `04.04_…/Drawing_Checklists` |
| Markups | `…/Markups` under 04.02 / 04.04 / 03.06 as context |
| RFI forms / register | `03.06_Correspondence_Control` |

**Mark:** `[ ]`

---

## Typical test walk (15 min)

1. Office: Master register — add 1 line.  
2. Site: Approval & GFC log → Upload → complete Drawing Check → upload PDF R0.  
3. Dashboard / Master — see the line; export PDF once.  
4. Design coordination — raise issue → 1 follow-up → escalate RFI.  
5. Checklist fill log — see Drawing Check fill; confirm SharePoint under 04.04.  
6. Client login — can open drawing, **cannot** upload.  

**Mark overall Drawings module:** `[ ]`
