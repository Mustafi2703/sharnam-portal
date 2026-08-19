# Module 01 — Drawings

**Test order:** #2  
**Hub:** `/projects/:id/hub/drawings`  
**Source workbook:** `DRAWING REGISTER - 01.xlsx` (seeded on demo project — 41 master lines)

---

## Tool nav tabs (module strip)

Module hub · **GFC register** (upload) · Register dashboard · **Master register** (DCI schedule) · Design coordination · Drawing files · Checklist manager · Checklist fill log · Request fill · Ask RFI

> **Removed (Aug 2026):** **Site register** tab — not required by client. Legacy `?sheet=site` URLs redirect to Master register. GFC upload log still shows optional receive/issue + signatures per revision.

> **Separation:** **Master register** = DCI schedule (package, building, dates, issued-to, critical). **GFC register** = PDF/DWG upload, revisions, site signatures. Do not add master lines on the GFC page.

---

## Workbook → portal map

| Client Excel sheet | Portal route | Purpose |
|--------------------|--------------|---------|
| Drawing & GFC Drawing Log | `/projects/:id/drawings` | Live upload log, R0–Rn columns, PDF/DWG |
| **Master Drawing Register** | `…/register?sheet=master` | Full DCI register (41 cols incl. issue + critical) |
| ~~Site Drawing Register~~ | *(removed)* | Receive/issue now on GFC upload log only |
| DRAWING REGISTER · Dashboard | `…/register` | Week KPIs + pie charts |
| Drwing check master checklist | `…/drawings/checklist-master` | Pre-upload Drawing Check only |

---

## Page: GFC register

| | |
|--|--|
| **Route** | `/projects/:id/drawings` |
| **Purpose** | **GFC file log only** — upload PDF/DWG, revisions R0–Rn, publish. Optional receive/issue with **client + PMC + site engineer** signatures picked from **Photo storage**. No PDF markup on upload (markup is in Design coordination). |

### Signatures on upload (optional)
| Role | Source |
|------|--------|
| Client | Pick from Photos module or name field |
| PMC | Pick from Photos module or name field |
| Site engineer | Pick from Photos module or name field |

### Branded Drawing Check export
| Action | Route |
|--------|-------|
| Branded HTML (print PDF) | Checklist fill log → **Branded PDF** |
| Branded Excel table | Checklist fill log → **Branded Excel** (`GET …/submissions/:id/branded.xlsx`) |

### Register columns (R0–Rn)
| Rule | Notes |
|------|-------|
| Column = revision **number** | R2 data always appears under **R2**, not by upload order |
| Dynamic columns | Table adds R6, R7… when project has higher revisions |
| Planned / actual dates | `P:…` / `A:…` in cell; tooltip shows revision label |
| **Total** | Count of unique revision numbers (R0, R1, R2…) |
| **Current rev** | Drawing `currentRev` — shown in Browse + upload log **CURRENT** badge |
| **Browse · Latest** | Opens published/current revision (not a stale draft row) |

### Upload log (expand **Log** on any row)
| Block | What office sees |
|-------|------------------|
| Files | PDF/DWG filenames, markup count, View button |
| **Site register — receive & issue** | Received date, copies, issued to contractor/client, **contractor + client signature thumbnails**, remarks |
| Actions | Update files · Replace PDF · PDF markup · Replace DWG |

Office UAT: upload a revision with signature pads filled → expand log → confirm thumbnails appear without opening Site register.

### Form: Add register line (no file)
| Field | Notes |
|-------|-------|
| — | **Removed from GFC page.** Add DCI rows on **Master register** only. |

### Form: Upload new drawing (modal)
| Field | Notes |
|-------|-------|
| drawingNumber, title, discipline, buildingArea, tlNo | |
| revisionNumber, plannedDate, actualDate | |
| publish | checkbox — sets current published revision |
| pdf, dwg | Separate slots — at least one required per revision |
| markup pages | Optional multi-page PDF markup; stored per page with full history |
| unlockToken | after drawing check |
| **Site register block** | **Optional** — received date, copies, issued to contractor/client, signature pads (PNG → SharePoint). Fill when physical receive/issue happens; not required to upload PDF/DWG. **Pending client UAT decision** on mandatory fields. |

**API:** `POST /api/drawings/project/:id` (multipart: `pdf`, `dwg`, `contractorSignature`, `clientSignature`)

### Form: Upload / update revision (modal)
| Field | Notes |
|-------|-------|
| revisionNumber, revisionLabel, plannedDate, actualDate, publish | |
| pdf, dwg | Both allowed on same revision |
| **Same rev number again** | Updates **same row** (no duplicate R2 rows) — checklist not required for update |
| **New rev number** | Requires Drawing Check unlock token |
| **Site register block** | Same optional receive/issue + signature fields — visible on log after save |
| Replace PDF / DWG on log row | `PATCH /api/drawings/revision/:id/file` with `fileRole=pdf|dwg` + issue fields |
| Markup pages | `POST /api/drawings/revision/:id/markup-pages` — full per-page history |

### Upload modal (accordion log)
| Action | Modal mode | Checklist required? |
|--------|------------|---------------------|
| **+ Next revision** | New revision | Yes |
| **Update files** | Same revision — PDF + DWG + dates + **optional** signatures | No |
| **Replace PDF** | PDF only (+ optional markup + signatures) | No |
| **Replace DWG** | DWG only (+ optional signatures) | No |
| **PDF markup** | Full-screen markup editor | No |
| **Upload GFC** (top bar) | New drawing row | Yes |

| Step | Expected |
|------|----------|
| Upload R2 with PDF only (skip receive/issue block) | R2 column shows date; Site register rows stay blank for that rev |
| Upload R2 with PDF + contractor signature (optional block) | R2 column shows date; log shows signature thumbnail |
| **Update files** → fill receive/issue only (no new PDF) | Same R2 row; Site register + log updated |
| Replace PDF on R2 | Same R2 row updated; signature block unchanged unless re-captured |
| Office expands **Log** | Receive/issue dates + signatures visible when filled |
| Site register tab | Same data in R2 column matrix when optional block was saved |
| Master register | Matching drawing number updates rev, dates, copies, issue date |
| Export GFC CSV | R0–Rn columns match register; Total = unique rev count |

**SharePoint layout (ISO 04.02):**  
`04_DESIGN…/04.02_Drawings_and_Specifications/{Discipline}/{DrawingNo}/{Rev}/PDF|DWG|Markup/page-NN/Signatures/contractor|client`

### Modals
| Modal | Trigger | Purpose |
|-------|---------|---------|
| DrawingCheckModal | Before **new** revision | Unlock upload after checklist |
| UploadModal | Upload GFC / revision | PDF + DWG + **DrawingIssueFields** (signatures) |
| PdfMarkup / ImageMarkup | Markup on revision | Saves all marked pages; history per page |
| DrawingFileViewer | Preview | Tabs: Original PDF · Markup pages (history) · DWG download |

### Routes: Drawing checklist (Drawings module only)
| Route | Purpose |
|-------|---------|
| `/projects/:id/drawings/checklist-master` | Drawing check templates only |
| `/projects/:id/drawings/checklist-logs` | Drawing fill log only — **no** Site/Quality/Safety tabs |

### Meeting changes (log in session → dev builds → re-test)

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |
| 2 | | | | Open | ☐ |
| 3 | | | | Open | ☐ |


### Client sign-off
- [ ] Page approved for UAT

---

## Page: Master drawing register

| | |
|--|--|
| **Route** | `/projects/:id/drawings/register?sheet=master` |
| **Excel source** | Sheet **Master Drawing Register** in `DRAWING REGISTER - 01.xlsx` |
| **Purpose** | DCI master schedule — all workbook columns. **Separate from GFC upload.** |

### Table filters
| Filter | Options |
|--------|---------|
| Package | All · Package A/B/C/D (+ seeded values) |
| Building | All · Tower 1… (+ seeded values) |
| Discipline | All · Architecture / Structural / MEPF / … |
| Critical | All · Critical only · Non-critical |

### Columns (match client workbook)
Sr # · Project Package · Building · Discipline · Drawing Number · Drawing Title · Drawing Type · Consultant Name · Revision Number · Revision Date · Revision Description · Latest Revision · Planned Submission Date · Actual Submission Date · Submission Delay (Days) · Delay Responsibility · **Issued To** · **Issue Date** · **No. of Copies** · **Critical Drawing** · Remarks · GFC link

**Auto-sync:** GFC upload/update on matching `drawingNumber` updates rev, dates, delay, copies, issue date, and GFC link.

### Form: Add master register line (all DCI fields)
| Field |
|-------|
| srNo, projectPackage, building, discipline, drawingNumber, drawingTitle, drawingType, consultantName |
| revisionNumber, revisionDate, revisionDescription, latestRevision |
| plannedSubmissionDate, actualSubmissionDate, submissionDelayDays, delayResponsibility |
| issuedTo, issueDate, copiesCount, criticalDrawing, remarks |

**API:** `POST /api/drawings/project/:id/register-lines`  
**Link to GFC:** Upload files on GFC register with the **same drawing number** → GFC link column shows Linked.

### Meeting changes (log in session → dev builds → re-test)

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |
| 2 | | | | Open | ☐ |
| 3 | | | | Open | ☐ |

### Client sign-off
- [ ] Page approved for UAT

---

## Page: Site drawing register

| | |
|--|--|
| **Route** | `/projects/:id/drawings/register?sheet=site` |
| **Excel source** | Sheet **Site Drawing Register** in client workbook |
| **Purpose** | Receive & issue matrix — R0–R6 × dates, copies, **receiver signatures** (when filled on GFC upload). |

### Optional receive/issue (pending client UAT)
The GFC upload modal shows **Site drawing register — receive & issue** with an **Optional** badge. Client to confirm during UAT whether any fields (dates, copies, contractor/client signatures) should become mandatory for their projects.

### Matrix rows (per drawing)
Date of receiving · Total copies received · Issued to contractor · Receiver signature (contractor) · Issued to client · Receiver signature (client)

**Source:** GFC upload modal **Site drawing register — receive & issue** (same data as GFC log block).

### Meeting changes (log in session → dev builds → re-test)

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |
| 2 | | | | Open | ☐ |
| 3 | | | | Open | ☐ |

### Client sign-off
- [ ] Page approved for UAT

---

## Page: Register dashboard

| | |
|--|--|
| **Route** | `/projects/:id/drawings/register` |
| **Purpose** | Week KPIs and charts from dashboard sheet in `DRAWING REGISTER - 01.xlsx`. |

### Features
| Feature | Notes |
|---------|-------|
| Week KPI tiles | Total drawings, GFC count, critical, linked to GFC |
| Pie charts | By discipline · drawing type · critical |

### Meeting changes (log in session → dev builds → re-test)

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |
| 2 | | | | Open | ☐ |
| 3 | | | | Open | ☐ |

### Client sign-off
- [ ] Page approved for UAT

---

## Page: Drawing files (SharePoint)

| | |
|--|--|
| **Route** | `/projects/:id/drawings/library` |
| **Purpose** | Browse design folders in SharePoint (not general DMS). |

### Features
| Feature | Notes |
|---------|-------|
| Folder browse | ISO 04.02 design folders in SharePoint |
| Open / download | PDF and DWG from project library |

### Meeting changes (log in session → dev builds → re-test)

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |
| 2 | | | | Open | ☐ |
| 3 | | | | Open | ☐ |

### Client sign-off
- [ ] Page approved for UAT

---

## Page: Design coordination

| | |
|--|--|
| **Route** | `/projects/:id/drawings/coordination` |
| **Purpose** | Clash/design issues; **PDF markup** on linked GFC; **DMS attachments**; assignee **follow-up emails** (max 5, then auto-RFI); manual escalate anytime. |

### Features
| Feature | Notes |
|---------|-------|
| Log issue | Title, discipline, location, assignee name + **email**, linked GFC drawing |
| PDF preview | Inline viewer when drawing has uploaded PDF |
| **Mark up PDF** | Annotation saved on linked revision (not on GFC upload) |
| **Attach DMS file** | Upload to design coordination folder in SharePoint |
| **Send follow-up** | `POST …/coordination/:id/follow-up` — emails assignee; **5th follow-up auto-creates RFI** |
| **Escalate to RFI** | `POST …/coordination/:id/escalate-rfi` — creates RFI server-side |
| Close / Reopen | Status workflow on each issue |
| SharePoint logs | Design-Coordination-Log includes assignee, follow-up count, escalation id |

### Meeting changes (log in session → dev builds → re-test)

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |
| 2 | | | | Open | ☐ |
| 3 | | | | Open | ☐ |

### Client sign-off
- [ ] Page approved for UAT

---

## Page: Drawing checklist master / fill log / RFIs

| Route | Notes |
|-------|-------|
| `/projects/:id/drawings/checklist-master` | DrawingCheck only — no Quality/Safety/Site tabs |
| `/projects/:id/drawings/checklist-logs` | Drawing fills only |
| `/projects/:id/rfis?kind=DrawingChecklist` | Request fill |
| `/projects/:id/rfis?kind=RequestForInformation` | Ask RFI |

Quality / Safety checklist masters live under their own modules.

### Meeting changes (log in session → dev builds → re-test)

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |
| 2 | | | | Open | ☐ |
| 3 | | | | Open | ☐ |

---

## UAT script — signatures (office role)

**Note:** Receive/issue block is **optional** until client confirms. Run both paths below.

### Path A — upload without receive/issue
1. Open **GFC register** → **Upload GFC** or **Update files** with PDF only — leave receive/issue block empty → Save.
2. Confirm upload succeeds and R column shows planned/actual dates.

### Path B — optional receive/issue + signatures
1. Open **GFC register** → pick drawing **AR-101** → **Log** → note current revision.
2. **Update files** on current rev → fill received date, copies, capture **contractor signature** on pad → Save (no new PDF required).
3. Expand **Log** again → confirm **Site register — receive & issue** block shows dates + signature image.
4. Open **Site register** tab → confirm same revision column shows signature thumbnail.
5. Open **Master register** → confirm copies / issue date updated for AR-101 when those fields were filled.

### Client decision (record under **Site register → Meeting changes**)
- [ ] Keep receive/issue **optional** for all projects
- [ ] Make **some fields mandatory** (list): ___________________
- [ ] Defer Site register signatures to a later phase
