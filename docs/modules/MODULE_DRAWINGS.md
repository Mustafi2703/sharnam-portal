# MODULE — Drawings (GFC · Checklist · RFI · Coordination)

**Prompt:** `module_prompts/Drawings_ChecklistsRFI.md`  
**SRS:** [CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md) §4.3 · §3B  
**Hub:** `/projects/:id/hub/drawings`  
**LLD:** [system-design/04-LLD-Project-Modules.md](../system-design/04-LLD-Project-Modules.md)

---

## 1. Purpose

Drawing register, revision control, pre-upload checklist gate, coordination issues, and **Request for Information** (clarification only).

---

## 2. Tools (sheet → hub card)

| Tool | Hub / route | Status | Behaviour |
|------|-------------|--------|-----------|
| GFC register | `/drawings` | Built | Log + revisions R0–R5; publish |
| Checklist manager | `/checklist-master?family=DrawingCheck` | Built | Drawing Check Master gate |
| Checklist fill log | `/checklist-logs?family=DrawingCheck` | Built | Branded download |
| Documents (DMS) | `/dms` | Partial | Folders under Drawings |
| Coordination | `/coordination` | Built | Design issues → Ask |
| Request checklist fill | `/rfis?kind=DrawingChecklist` | Built | |
| Ask — Request for Information | `/rfis?kind=RequestForInformation` | Built | **not** inspection |

### Awaiting next sheets

| Tool | Status | Notes |
|------|--------|-------|
| Extra discipline drawing logs | Ready | Extend GFC columns / filters from next pack |

---

## 3. GFC / Drawing fields

| Field | Type | Required | Notes / review |
|-------|------|----------|----------------|
| discipline | text | Y | Arch / Struct / … |
| buildingArea | text | N | |
| tlNo | text | N | |
| dwgNo | text | Y | |
| title | text | Y | |
| oneDriveUrl / fileUrl | url | N | Latest published |
| revision | text | Y | R0–R5 |
| revisionDate | date | N | |
| status | enum | Y | Draft / Published / … |
| publishedAt | datetime | N | |

### Revision

| Field | Notes |
|-------|-------|
| revision label | R0…R5 |
| file | Required to publish |
| uploadedBy / at | Audit |
| checklistSubmissionId | Gate evidence |

---

## 4. Drawing Check Master

| Field | Type | Notes |
|-------|------|-------|
| template name / family | DrawingCheck | |
| item prompt | text | From `Drwing check master checklist` |
| response | Yes / No / N.A. | |
| completedBy / at | | Must complete before upload |

**Gate:** Server rejects revision upload if checklist incomplete.

---

## 5. Coordination issue

| Field | Type | Notes |
|-------|------|-------|
| title / description | text | |
| linkedDrawingId | link | |
| status | Open / Escalated / Closed | |
| escalate → RFI | Creates Request for Information | |

---

## 6. Request for Information (Drawings / PMC Ask)

| Field | Type | Notes |
|-------|------|-------|
| number | auto | e.g. RFI-001 |
| subject / question | text | |
| rfiKind | `RequestForInformation` | UI label: Request for Information |
| status | Open / … | |
| ballInCourt | text | |
| assignedTo / dueDate | | |
| linkedDrawingId | optional | |
| distribution | matrix parties | |
| responses | threaded | Matrix parties + office |

**Not used here:** Quality/Safety inspection requests (see Quality / Safety modules).

---

## 7. Sheet sources

- `Approval & GFC Drawing Log`  
- `Drwing check master checklist.xlt.xls`

---

## 8. Rules

1. Latest published revision is working set.  
2. Checklist unlock before upload/publish.  
3. Create/respond → email outbox (+ Graph).  
4. Client: view published; **no** drawing upload.  
5. Submittals excluded.

---

## 9. Review checklist

- [ ] Confirm GFC column set vs client log  
- [ ] Confirm R0–R5 policy  
- [ ] Confirm Information vs Inspection labels in UI  
