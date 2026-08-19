# How to maintain client testing docs

Use this guide whenever the portal changes or you run a client UAT session.

## Doc map (what goes where)

| File / folder | Audience | Update when… |
|---------------|----------|--------------|
| **`modules/NN-*.md`** | Dev + internal UAT | A route, form, or feature on a page changes |
| **`_PAGE-TEMPLATE.md`** | Copy-paste for new pages | Never — template only |
| **`_MEETING-STAKE.md`** | Copy-paste meeting table | Never — snippet only |
| **`01-MEETING-CHANGE-LOG.md`** | Dev backlog after meetings | After each client session (optional rollup) |
| **`00-MASTER-INDEX.md`** | Route lookup | New tool tab or route added |
| **`../client-share/12-Live-Client-UAT-Workbook.md`** | **Client Google Doc** | Client-facing steps + sign-off; mirror major module changes |
| **`README.md`** | Onboarding | Test order or folder structure changes |

### What **not** to put in module pages

- Dev commit history, “we fixed X on date Y”, or agent notes  
- **Instead:** use **Meeting changes** tables (blank until the session) or `01-MEETING-CHANGE-LOG.md`

### What **to** put in module pages

- Route, purpose, roles  
- **Features** table (what the user sees today)  
- Forms / modals / API hints for testers  
- Blank **Meeting changes** + **Client sign-off** under each page

---

## After a code change (dev checklist)

1. **Find the module doc** — `docs/client-testing/modules/NN-*.md` (see [00-MASTER-INDEX.md](./00-MASTER-INDEX.md)).
2. **Update only the affected page section** — features, forms, routes. Do not rewrite the whole file.
3. **Update master index** if a new route or tool tab was added (`apps/web/src/workspaces.ts` → `MODULE_TOOLS`).
4. **Checklist families** — if checklists moved, update separation notes in **01-drawings**, **03-quality**, **04-safety** (never merge Drawing / QI / Safety masters).
5. **Client workbook** — if the client will test it in the next session, add one row under Section 5 or 6 in `12-Live-Client-UAT-Workbook.md`.
6. **Do not** pre-fill Meeting changes tables with dev work — leave them empty for the client session.

---

## During a client meeting

1. Open **`12-Live-Client-UAT-Workbook.md`** in Google Docs (or the matching `modules/NN-*.md`).
2. Walk **features** — confirm pass/fail in the workbook checklist columns.
3. Log **new** requests only in **Meeting changes** tables on that page (copy table from `_MEETING-STAKE.md` if missing).
4. End of session: copy stakes to **`01-MEETING-CHANGE-LOG.md`** if you want one dev backlog.

---

## After dev implements meeting items

1. Mark **Dev status** → Done in meeting log / page stake.  
2. Client **Re-test** column → tick when verified.  
3. Update **features** text in the module doc if behaviour changed (not in Meeting changes).  
4. **Client sign-off** checkbox on the page when the client approves.

---

## Checklist families (do not mix in docs or UAT)

| Family | Module | Master route | RFI kind |
|--------|--------|--------------|----------|
| **DrawingCheck** | Drawings | `/drawings/checklist-master` | `DrawingChecklist` |
| **QualityInspection** | Quality | `/quality/checklist-master` | `QualityInspection` |
| **Safety** | Safety | `/safety/checklist-master` | `SafetyChecklist` |
| **SiteExecution** | Field | `/checklist-master?family=SiteExecution` | (field RFIs) |

Quality **QI** (Procore-style inspections) = `/inspections?sheet=qi` — separate from drawing link.

---

## Reference Excel workbooks

Client sheets live in `seed/data/` and `Sharnam_modules_docs/`. After workbook updates:

```bash
npm run db:seed          # or db:seed-quality-safety-demo for demo project only
```

Sync script (if used): `scripts/sync-reference-sheets.mjs`

---

## Quick links

- [README](./README.md) — test order  
- [Master index](./00-MASTER-INDEX.md) — all routes  
- [Live UAT workbook](../client-share/12-Live-Client-UAT-Workbook.md) — client copy  
- [Meeting change log](./01-MEETING-CHANGE-LOG.md) — session rollup  
