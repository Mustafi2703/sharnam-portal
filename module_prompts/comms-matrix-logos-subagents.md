# Communication matrix — both logos in preview, Excel, and PDF (multi-agent run)

Paste the **Orchestrator** block into the parent agent. It launches the sub-agents below in the order given, reviews their diffs, then deploys. Each sub-agent block is self-contained so it can be pasted on its own.

---

## Orchestrator (parent agent)

You are coordinating a fix on the Sharnam PMC portal (repo `/Users/baibhab/Downloads/sharnam-portal`, live at https://portal.spdc.in). Read `.cursor/skills/sharnam-portal-dev/SKILL.md` first.

**Problem.** In CRM → Project Setup → Communication matrix, the client logo does not show in the matrix **preview**, the **Excel** export, or the **PDF** export. Only the Sharnam logo shows; the client slot falls back to the client name as text (the Voltamp Transformers Limited project shows this today). The on-screen register header *does* show the client logo, because the browser is signed in to SharePoint.

**Required result.** Every communication matrix output (TECHNICAL and COMMERCIAL; preview HTML, Excel, PDF; the SharePoint-filed copies; and the matrix sheets appended to other workbooks) shows:

- the **Sharnam logo at the top left**,
- the **client logo at the top right**,
- the banner text between them (PROJECT, CLIENT, DESIGN CONSULTANT, PROJECT MANAGEMENT CONSULTANTS, SUBJECT, DATE),
- then the slate column header and the section bands exactly as in `module_prompts/Sharnam_modules_docs 2/Communication Matrix_BPCL (2).xlsx`.

Both logos keep their aspect ratio, are the same visual height (about 60–70 px in preview/PDF, filling rows 1–6 in Excel), and are never stretched or cropped. If a project has no client logo, the right slot shows the client name in grey text (current behaviour) — no broken image.

**Root cause (already diagnosed — do not re-investigate from scratch).**

1. `POST /api/projects/:id/client-logo` (`apps/api/src/routes/projects.ts` ~L1440) stores `clientLogoUrl = saved.sharePointUrl || saved.url`. On live this is a SharePoint web URL.
2. `apps/api/src/services/matrixExport.ts` → `imageDataUriFromUrl()` reads a local file only if the URL contains `/uploads/onedrive/`; otherwise it does an anonymous `fetch()` of the SharePoint URL, gets a sign-in HTML page, and returns `""`. So preview, Excel, and PDF all lose the client logo.
3. `apps/api/src/services/clientLogo.ts` → `clientLogoPathForProject()` is the better resolver (local `00_PROJECT_BRANDING/client-logo.*` first, then Graph download), but its Graph fallback uses the old path `${project.code}/00_PROJECT_BRANDING/client-logo.${ext}`. Since commit d4997af the project library lives at `projectLibraryPath(code, "00_PROJECT_BRANDING/…")` (`Sharnam Portal/Sharnam Projects/{sanitized code}/…`), with `legacyProjectLibraryPath` as the fallback for files saved before the move. It also guesses the extension from the URL.
4. Excel currently puts **both** logos top right (Sharnam in column H, client in column I). The preview and PDF already use Sharnam left / client right. Excel must be changed to the same left/right layout.

**Order of work.**

1. Launch **Agent A (logo resolver)** and wait for it. Agents B and C depend on its function.
2. Launch **Agent B (Excel + PDF + preview layout)** after A is merged into the working tree. B owns `matrixExport.ts` alone — do not run two agents on that file at the same time.
3. Launch **Agent C (QA)** after B. If C reports failures, send them back to A or B, then re-run C.
4. Run the **Deploy** step yourself.

**Hard rules for every agent (repeat them in each sub-agent prompt).**

- Do not set or change `PORTAL_MAIL_LIVE`. Do not send email.
- Never delete SharePoint files. Every SharePoint write stays under `Sharnam Portal/` (`assertPortalSafePath`). Do not recreate `Sharnam Portal/{code}/Sharnam Projects/`.
- Do not wipe, reseed, or delete projects, companies, users, or matrix rows. A redeploy runs schema-only (`scripts/hostinger-db-push.mjs`); keep it that way.
- Do not stage these local-only or generated files: `apps/api/src/index.ts`, `apps/api/src/services/checklistPackOnboard.ts`, `apps/web/tsconfig.tsbuildinfo`, `uploads/`, `apps/api/uploads/`, `data/`, `apps/api/data/`, `*.docx`, `docs/uat-evidence/`, `.claude/`, `.cursor/`, compiled `*.js` / `*.d.ts` under `apps/api/src/modules/finance/`. Stage files by explicit path only, never `git add -A` or `git add .`.
- User-entered text (names, emails, company names, addresses) is printed as typed. UI labels follow `formatUiText` title case.
- Match the surrounding code style. No new dependencies unless the agent explains why the existing `exceljs` and `pdfkit` cannot do it.

---

## Agent A — client logo resolver (backend)

Repo: `/Users/baibhab/Downloads/sharnam-portal`. Read `.cursor/skills/sharnam-portal-dev/SKILL.md` and `backend.md` beside it.

**Goal.** One server-side function that returns the client logo bytes for a project reliably, whether `Project.clientLogoUrl` is a local `/uploads/...` URL, a SharePoint web URL, or a `data:` URI.

**Do this.**

1. In `apps/api/src/services/clientLogo.ts`, add and export `clientLogoForProject(projectId): Promise<{ buffer: Buffer; ext: "png" | "jpeg"; file: string } | null>`, built on `clientLogoPathForProject`.
2. Fix the Graph fallback in `clientLogoPathForProject`:
   - try `projectLibraryPath(code, "00_PROJECT_BRANDING/client-logo.png")`, then `.jpg`, then `.jpeg`;
   - then the same three under `legacyProjectLibraryPath(code, …)`;
   - import both helpers from `./graph.js`; keep `assertPortalSafePath` happy;
   - decide the extension from the **downloaded bytes** (PNG starts `89 50 4E 47`, JPEG starts `FF D8 FF`), not from the URL;
   - cache the result locally under `mockOneDrive.projectRoot(code)/00_PROJECT_BRANDING/` exactly as today.
3. Handle `data:image/...` URLs and local `/uploads/onedrive/...` URLs in the same function so callers never need their own resolver.
4. Do not cache a `null` result for the full five minutes when the cause was a Graph error. Cache `null` only when the project really has no `clientLogoUrl`, so a logo uploaded a moment ago shows on the next export.
5. In the upload route (`projects.ts` ~L1440), sniff the uploaded bytes the same way. Save PNG bytes as `client-logo.png` and JPEG bytes as `client-logo.jpg`. Reject other image types (for example WebP or SVG) with a 400 that says "Upload a PNG or JPG logo." Do not change what `clientLogoUrl` stores; the browser header still needs the SharePoint URL.
6. Keep `clientLogoDataUri` and `invalidateClientLogo` working; other exports (`brandedExport.ts`, `wprXlsx.ts`, `wprPptx.ts`, `ncrFormExport.ts`, `brandedChecklistHtml.ts`) use them.

**Check.** `npm run build -w @sharnam/shared && npm run build -w @sharnam/api` passes. Add a small script `scripts/check-client-logo.mts` that logs in on live (`POST https://portal.spdc.in/api/auth/login` with `{ email: "nirav@spdc.in", password: "Demo@1234", portal: "office", allowedRoles: ["admin","office","hr"] }`), lists projects, and prints which ones have `clientLogoUrl`. **Do not commit** it if it contains the password; read the password from `process.env.PORTAL_PASSWORD` instead.

**Report back.** The exact function signature, the order of paths tried, and the files changed. Do not commit or push. The orchestrator commits.

---

## Agent B — matrix layout: preview, Excel, PDF (backend export)

Repo: `/Users/baibhab/Downloads/sharnam-portal`. Read `.cursor/skills/sharnam-portal-dev/SKILL.md`. Agent A has added `clientLogoForProject(projectId)` in `apps/api/src/services/clientLogo.ts`; use it.

**Reference.** `module_prompts/Sharnam_modules_docs 2/Communication Matrix_BPCL (2).xlsx` (sheets TECHNICAL and COMMERCIAL). Banner rows 1–6 at 17.25 pt; header row 7 at 31 pt; section band rows (`A`, `B`, …); columns SR.NO, NAME, DESIGNATION, NAME OF COMPANY, SINGLE POINT OF CONTACT, MOBILE, E-MAIL, GENERAL MAIL COMMUNICATION, OFFICE ADD.

**Do this, all in `apps/api/src/services/matrixExport.ts` (you own this file):**

1. Delete `imageDataUriFromUrl` and `dataUriToTempFile` and use `clientLogoForProject(project.id)` everywhere. `loadMatrixBundle` already selects `project.id`; add `id` to the `MatrixProject` type.
2. **Excel (`paintMatrixSheet`, used by `buildMatrixXlsx` and `appendBrandedMatrixSheets`):**
   - Sharnam logo top **left**, anchored over `A1:B6`.
   - Banner text merged over `C1:H1` … `C6:H6` (PROJECT, CLIENT, DESIGN CONSULTANT, PROJECT MANAGEMENT CONSULTANTS, SUBJECT, DATE), left aligned, bold, same font as today.
   - Client logo top **right**, anchored over `I1:I6`.
   - Size each image from its real pixel size so it fits its box with the aspect ratio kept and is centred. Read the PNG/JPEG width and height from the header bytes; no new dependency. Use `sheet.addImage(id, { tl, ext, editAs: "oneCell" })`.
   - Pass a buffer to `wb.addImage({ buffer, extension })` instead of writing temp files, then remove the temp-file cleanup that is no longer needed.
   - No client logo means the client name in grey in `I1:I6`, centred.
   - Keep print setup: landscape, fit to width, print area covering the table, header rows repeating.
3. **Preview HTML (`buildMatrixHtml`, served at `GET /api/comms/contacts/:projectId/export.html?kind=`):** keep Sharnam left and client right. Use a three-column grid (`auto 1fr auto`) so the banner sits between them and the client logo is never pushed off or squashed. Logo boxes are about 140 × 70 px with `object-fit: contain`. Remove the client-name text on the right (top-right of the current preview shows "Voltamp Transformers Limited" instead of the logo) whenever the logo exists.
4. **PDF (`buildMatrixPdf`):** use the buffer from `clientLogoForProject` directly in `doc.image(buffer, …, { fit: [110, 72], align: "center", valign: "center" })`. Sharnam left, client right, banner between. Repeat the logo row and column header on each new page.
5. Leave matrix rows, section grouping, mail roles, and the date format (`dd-MM-yyyy`, Asia/Kolkata) unchanged.

**Check.**

- `npm run build -w @sharnam/shared && npm run build -w @sharnam/api && npm run build -w @sharnam/web` passes.
- Write `scripts/matrix-logo-smoke.mts` that builds TECHNICAL and COMMERCIAL Excel, HTML, and PDF for one local project with a PNG client logo and one with a JPEG logo, and writes them to `/tmp/matrix-logo-smoke/`. Unzip each xlsx and confirm `xl/media/` holds **two** images and `xl/drawings/drawing1.xml` anchors one in column 0 and one in column 8. Confirm the HTML contains two `<img` tags in the header. Do not commit generated output.

**Report back.** Screenshots or rendered PNGs of the preview and the first PDF page, the drawing anchors from the xlsx, and the files changed. Do not commit or push.

---

## Agent C — QA (local, then live after deploy)

Repo: `/Users/baibhab/Downloads/sharnam-portal`. Read `.cursor/skills/sharnam-portal-dev/qa.md`.

**Before deploy (local build):**

1. Run Agent B's smoke script. For every output (TECHNICAL and COMMERCIAL; HTML, xlsx, PDF), confirm:
   - the Sharnam logo is top left and the client logo is top right;
   - neither logo is stretched; both are roughly the same height;
   - the banner text is not covered by either logo;
   - a project with no logo shows the client name, not a broken image.
2. Regression: build the other exports that share `clientLogo.ts` (WPR xlsx/pptx, NCR form, branded checklist) for one project and confirm the client logo still appears.
3. Run `npm run build` for all workspaces and report any TypeScript errors.

**After deploy (live, read-only plus exports):**

1. Wait until `https://portal.spdc.in/api/health` reports the new commit.
2. Log in as `nirav@spdc.in` / `Demo@1234` (portal `office`, allowedRoles `["admin","office","hr"]`). Find the Voltamp Transformers Limited project id from `GET /api/projects`.
3. Fetch `GET /api/comms/contacts/{id}/export.html?kind=TECHNICAL` and `…?kind=COMMERCIAL`; confirm two `<img` tags with non-empty `data:image/` sources.
4. Fetch `GET /api/comms/contacts/{id}/export.xlsx?kind=TECHNICAL`; unzip and confirm two images under `xl/media/`.
5. Trigger the SharePoint-filed copy exactly as the "Open in SharePoint" button does (the POST in `CommsMatrixPanel.tsx` with `{ kind, file: "pdf" }`). Do this once per kind, not repeatedly. Confirm the response is 2xx.
6. Do **not** edit, add, or delete matrix rows, users, companies, or projects on live. Do not send onboarding mail.

**Report back.** A pass/fail table per output per kind, plus the health commit. Attach rendered images of the preview and PDF header.

---

## Deploy (orchestrator)

1. `git status --short` and review the diff from A and B.
2. Stage only: `apps/api/src/services/clientLogo.ts`, `apps/api/src/services/matrixExport.ts`, `apps/api/src/routes/projects.ts`, and any web file B touched. Stage the smoke scripts only if they contain no password.
3. Commit with a plain-English message, for example "Show the Sharnam and client logos on every communication matrix preview, Excel, and PDF."
4. `git push origin HEAD` to `main` (Hostinger builds on push; schema-only, no seed).
5. Poll `https://portal.spdc.in/api/health` until `commit` matches, then run Agent C's live checks.
6. Report to the user in plain language: what changed, what was checked on live, and anything that still needs a logo re-upload. For example, a project whose logo is WebP needs a PNG or JPG uploaded once.
