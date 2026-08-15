# Drawings · Checklists · RFI · Coordination

## Tools under **Drawings** module

| Tool | Behaviour |
|------|-----------|
| GFC register | Discipline, building/area, TL no, DWG no, title, OneDrive link, R0–R5 dates. Latest revision only for work. **Accept PDF + DWG** (DWG stored in SharePoint; browser download only). |
| Drawing checklist master | Pre-upload checklist (Architectural / Structural… Yes/No/N.A.). Must complete **before** upload/revision overlay. Global: `/master/checklists?family=DrawingCheck`. |
| Checklist fill log | Branded download via `GET /api/checklist/submissions/:id/branded.html` — Print → Save as PDF. |
| Documents (DMS) | Folder tree under Drawings/{discipline}/{revision}. Sync OneDrive path on open. |
| Coordination | Design coordination issues (Procore-like); elevate → RFI. |
| Submittals | _(Excluded for now)_ | — |
| Request checklist fill | RFI kind = DrawingChecklist; notify on create/respond. |
| Ask — **Request for Information** | Clarification / information **only** (not inspection). Kind `RequestForInformation`. |
| Quality / Safety Ask | Use **Request for Inspection** (QI / Safety checklist) — see Quality.md / safety.md |

## Sheet sources

- `Approval  &  GFC Drawing Log (1).xlsx` — GFC columns  
- `Drwing check master checklist.xlt.xls` — review checkpoints  

## Videos

Drawing revisions / GFC, RFI raise, design coordination — see `Project_Sharnam_portal.md` links.
