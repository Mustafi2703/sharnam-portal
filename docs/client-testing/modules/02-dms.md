# Module 02 — Documents (DMS)

**Test order:** #3  
**Hub:** `/projects/:id/hub/dms`

---

## Page: Document manager

| | |
|--|--|
| **Route** | `/projects/:id/dms` |
| **Purpose** | ISO Rev 02 folder tree — browse, upload, preview PDFs; SharePoint sync. |
| **Tool nav** | Hub · Document manager |

### Form: Upload file
| Field | API |
|-------|-----|
| file | `POST /api/dms/:projectId/upload` (multipart, folder path) |
| current folder path | from tree selection |

### Modals
| Modal | Purpose |
|-------|---------|
| UploadModal | Pick file + confirm folder |
| DrawingFileViewer | In-app PDF/image preview |

### Key actions
Folder tree expand · Open in SharePoint · Preview · Upload

### Meeting changes (log in session → dev builds → re-test)

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |
| 2 | | | | Open | ☐ |
| 3 | | | | Open | ☐ |


### Client sign-off
- [ ] Page approved for UAT

---

## Note: Drawing files vs DMS

| Area | Route | Root |
|------|-------|------|
| General documents | `/dms` | Project ISO tree |
| Design PDFs/DWG | `/drawings/library` | `04_DESIGN_AND_INFORMATION_MANAGEMENT/...` |

Do not merge in client testing — two deliberate entry points.
