# Module 03 — Quality

**Test order:** #4  
**Hub:** `/projects/:id/hub/quality`

---

## Tool nav tabs

Dashboard · SOR Log · Checklist summary · CAR/NCR register · Cube Test · QAP Detail · QI & checklist fills · Quality checklist master · QI fill log · Quality Assurance Plan · Site checklists · Request QI fill

---

## Page: Quality inspections (all sheet views)

| | |
|--|--|
| **Route** | `/projects/:id/inspections?sheet=` |
| **Sheets** | `` (dashboard), `sor-log`, `checklist-summary`, `car-register`, `cube-test`, `qap-detail`, `qi` |

### Form: NCR / CAR (car-register sheet)
kind, number, ncrType, description, location, contractor → `POST .../ncr`

### Form: QAP activity (qap-detail)
weekLabel, activity, discipline → `POST .../qap`

### Form: Raise QI (qi sheet)
title, inspectionType, checklistTemplateId, drawingId, assignedToId, dueDate, location → `POST /api/inspections/project/:id`

### Form: Inspection line item
status, remarks, attachments → `PATCH .../items/:id`

### Modals
None on main page (fill opens separate window).

### Meeting changes (log in session → dev builds → re-test)

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |
| 2 | | | | Open | ☐ |
| 3 | | | | Open | ☐ |


### Client sign-off
- [ ] Page approved for UAT

---

## Page: Quality checklist master

| | |
|--|--|
| **Route** | `/projects/:id/quality/checklist-master` |

### Forms
Create template (name, category, checklistType, instructions, requirePhotosMin) · Add line items · Excel import · Assign to project

### Modals
None.

### Meeting changes (log in session → dev builds → re-test)

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |
| 2 | | | | Open | ☐ |
| 3 | | | | Open | ☐ |


---

## Page: QI fill log

| | |
|--|--|
| **Route** | `/projects/:id/quality/checklist-logs` |

Download branded fills — no create forms.

---

## Page: QAP upload

| | |
|--|--|
| **Route** | `/projects/:id/qap` |

Upload QAP file to quality folder in DMS.

---

## Page: Checklist fill (fullscreen)

| | |
|--|--|
| **Route** | `/projects/:id/checklist/fill/:assignmentId` |

Per-item Yes/No/N.A., remarks, photos → submit assignment.

---

## Page: Request QI fill (RFI)

| | |
|--|--|
| **Route** | `/projects/:id/rfis?kind=QualityInspection` |

See [07-comms](./07-comms.md) RFI form.
