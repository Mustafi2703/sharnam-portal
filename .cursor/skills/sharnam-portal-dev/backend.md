# Backend developer — Sharnam portal

## Stack

Express (`apps/api`) · Prisma SQLite (Postgres later) · JWT auth · multer uploads · mock OneDrive

## Integrity rules

- **Always** `where: { projectId }` (or join through assignment/drawing that owns `projectId`).
- Membership: non-admin/office users only see projects they belong to (`projectsRouter.get("/")` pattern).
- Unique constraints: `Drawing(projectId, drawingNumber)`, `ChecklistAssignment(projectId, templateId)`, etc.
- Soft failures over silent cross-project updates.

## Idempotency patterns

| Action | Pattern |
|--------|---------|
| Assign checklist | `upsert` on `projectId_templateId` |
| Publish drawing | Idempotent `update` + revision `published` flags |
| Submit checklist | New submission row OK; reject if no drawing/revision; client retries create new audit entry with new id |
| Create meeting / RFI number | Allocate sequential or cuid; never reuse numbers across projects |
| BOQ import | New `BoqImportBatch` per upload; do not merge silently |

Use request keys (`Idempotency-Key` header) only when the user asks for payment-grade retries; until then, upserts + unique indexes are enough.

## Checklist / drawing linkage

On submit require:

- `drawingId` in project + `isPublished`
- `revisionId` belonging to that drawing
- Persist `revisionNumber`, `submittedById`, timestamps for CSV audit

## Upload / files

- Store under mock OneDrive path; record `fileUrl`, `fileName`, `uploadedById`, `createdAt`
- Never allow `client` role on drawing upload routes
- **Drawings:** accept PDF, PNG/JPEG, **DWG** — stored under `04_DESIGN…/Drawings/{discipline}/` in SharePoint mock path; DWG is download-only (no iframe preview)
- **BBS shape diagrams:** per-row upload to `07.06…/bbs/<package>/shapes/`

## Cost / cashflow

- Measurement rows from Monitoring sheet: skip parent narrative rows without UOM/rate
- Cashflow periods are project-scoped; totals computed in summary endpoint
- **MB columns** from `SPDC_Budget_Arvind 49.xls`: srNo, description, nos1, nos2, L×W×H, qty, unit, raBill, remark
- **BBS columns**: barMark, location, shape diagram, dia, nosPerMember, nosOfMember, nos, shapeLen A–E, cutting L, total L, weightKg — parser in `costSheetParser.ts`

## Checklist branded export

- `GET /api/checklist/submissions/:id/branded.html` — Sharnam-branded HTML attachment (Print → PDF)
- Shared builder: `services/brandedChecklistHtml.ts` — no popup blockers on client

## Checklist before merge

- [ ] Routes use `requireAuth` / `requireRoles`
- [ ] Writes scoped to `projectId`
- [ ] Unique / upsert prevents duplicates
- [ ] Audit event for create/publish/submit
- [ ] `npm run build -w @sharnam/api` passes
