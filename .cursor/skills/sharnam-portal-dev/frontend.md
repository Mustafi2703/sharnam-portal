# Senior frontend — Sharnam portal

## Mandate

Build Procore-like construction ERP UX with **data integrity visible in the UI** and **idempotent user actions** (disable submit while in-flight, upsert-friendly forms).

## Theme

Apply the **chosen** option from [ui-directions.md](ui-directions.md) via CSS variables in `apps/web/src/index.css`. Logo on light plate unless the selected direction is explicitly dark.

## Upload modal (required)

Any upload (drawing, revision, BOQ, photo, DMS file) opens a **modal**, not only a bare `<input type="file">`:

1. Title + context (project, tool)
2. Dropzone + Browse
3. Metadata fields (drawing no, discipline, revision, publish toggle)
4. Primary CTA (Upload / Upload & publish)
5. Progress / error / success
6. Close resets local file state

Reuse one `UploadModal` pattern across tools.

## Workspace focus

- Selecting a workspace stores key in `localStorage` and **hides unrelated tools** in `ProjectToolsLayout`
- Clear selection shows all tools again
- Selection state must be visually obvious (`selected-ring`)

## Checklist fill (form)

- Separate spacious window/route
- Step 1: select published drawing from list
- Step 2: select revision (latest default)
- Step 3: Yes / No / N.A. form sections
- Block submit until drawing + revision chosen
- Audit sidebar + CSV export (who / when / drawing / rev)
- **Branded download:** `downloadBrandedChecklistPrint(id)` — fetches `/api/checklist/submissions/:id/branded.html`, saves file + opens print tab (not `window.open("")`)

## Drawings viewer

- PDF → iframe; images → inline; **DWG → download CTA** (SharePoint path, no preview)
- Upload modal accepts `.pdf,.png,.jpg,.jpeg,.dwg,.webp`
- Markup overlay (PdfMarkup / ImageMarkup) before upload on register + revision flows

## Cost registers (MB / BBS)

- Horizontal scroll tables (`sheet-register`) — all SPDC budget columns visible
- BBS **Shape of bar** column holds bend diagram upload (not trailing column)

## Integrity UX

- Show gate badge (published drawing count)
- Optimistic UI only when server confirms; on 400 show exact gate message
- Double-click: button `disabled` while request pending
- Lists: roomy spacing + `scroll-panel` for long registers

## Procore interaction cues

- Tool header + left tool nav
- Registers as dense tables with sticky headers
- Row actions: Open / Upload rev / Log
- Email / distribute from tool context when configured

## Checklist before merge

- [ ] Modal for uploads
- [ ] Project id from route; no hard-coded project
- [ ] Loading / empty / error states
- [ ] Keyboard-accessible dialogs
- [ ] `npm run build -w @sharnam/web` passes
