# Phase 2 — Project modules UAT & data-entry plan

**Follows:** Phase 1 (CRM, HRMS, Custom Sheets) — see [PHASE1-CRM-HRMS-TEST-REPORT.md](./PHASE1-CRM-HRMS-TEST-REPORT.md)  
**Portal:** https://portal.spdc.in  
**Target:** Two projects exercised end-to-end with real-shaped demo data, multi-role logins, uploads, and cross-module integrity.

---

## 1. Objectives

1. Enter **consistent demo data** in every project module for **Project A** and **Project B** (different client, vendor set, discipline mix).
2. Prove **data integrity** — same IDs, dates, and counts appear in registers, dashboards, WPR/DPR, and exports.
3. Prove **role boundaries** — office, site, client, vendor, stakeholder each see/do only what is allowed.
4. Prove **upload paths** — drawings, DMS, checklist photos, voucher-style attachments, SharePoint sync where enabled.
5. Produce a **module test report** SPDC can share with the client (WhatsApp summary + checklist).

---

## 2. Test projects (define before Day 1)

| | Project A | Project B |
|---|-----------|-----------|
| **Code** | e.g. `SPDC-DEMO-A` | e.g. `SPDC-DEMO-B` |
| **Client** | From CRM (activated portal) | Second CRM client |
| **Site team** | 2× site logins assigned | 2× different site users |
| **Vendors** | 2 contractors + 1 consultant | 1 contractor + 2 consultants |
| **Modules enabled** | Full stack | Full stack (or subset if agreed) |

**Data rule:** Every register row must trace to a **named person**, **date**, and **document number** recorded on the master trace sheet (Excel or portal audit).

---

## 3. Roles & login matrix (every week)

| Role | Login | Project A | Project B | Must not |
|------|-------|-----------|-----------|----------|
| Office | office@… | Full | Full | — |
| HR | hr@… | HRMS only + read projects if assigned | Same | Edit BOQ rates |
| Site PM | site@… | Field, quality, safety, DPR | Same | CRM, HRMS admin |
| Client | client portal | Read + sign where prompted | Second client account | Upload drawings, edit cost |
| Vendor | vendor@… | BOQ fill, checklist fill, NCR reply | Same vendor or different | Master registers |
| Stakeholder | struct@… / mep@… | RFI respond, coordination | Optional | HRMS |

**Multi-login tests (parallel):** Office raises RFI while vendor fills checklist; site closes safety observation while client views read-only; two site users punch attendance same day.

---

## 4. Data-entry design (what to load per module)

Use client workbooks under `module_prompts/` and SPDC Excel registers as **source shape** (not necessarily bulk import unless script exists).

### 4.1 Master & directory (both projects)

- Project create, module toggles, directory members by party type  
- Link CRM client + vendors from global directory  
- Communication matrix minimum 8 rows + one export  

### 4.2 Drawings

- 5–10 GFC rows (discipline mix), 2 revisions on one drawing  
- Drawing checklist master assignment + 1 fill log entry  
- **RFI information log only here:** 2× Ask (PMC RFI), 1× drawing checklist fill request  
- Register dashboard + download SPDC RFI register XLSX  

### 4.3 DMS

- Upload at least 1 PDF per ISO folder type used on the project  
- Preview in browser; note SharePoint path if synced  

### 4.4 Quality

- SOR log entries, 1 QI request, 1 NCR/CAR thread with vendor response  
- Cube test row, QAP row update  
- **Quality inspection log only** — no drawing “Ask RFI” in this list  

### 4.5 Safety

- 2 observations, 1 SNCR, safety checklist fill  
- **Safety log separate** from quality and from drawing RFIs  

### 4.6 Inspection module (if enabled)

- 1× Quality IR, 1× Safety IR, 1× activity checklist — **separate register** from drawings  

### 4.7 Field

- Daily diary + photos, link to grid/location  
- Attendance punch (site users) — cross-check HRMS calendar  

### 4.8 Progress

- Milestone baseline + one actual update  
- Planned vs actual dashboard sanity check  

### 4.9 Cost & finance

- BOQ upload (no rates) → vendor rate upload → comparative statement if 2+ vendors  
- One RA/COP chain row (as per demo scope)  

### 4.10 Comms & reports

- MoM + action follow-up  
- DPR (site) → WPR regenerate → branded export sample  
- Client read-only pack  

### 4.11 Closure

- Snag item + lesson learnt + export to DMS  

---

## 5. Integrity checks (after data entry)

| Check | How |
|-------|-----|
| Counts match | RFI register total = raised items; NCR open = dashboard |
| Dates consistent | DPR date ≤ WPR week; inspection date ≤ RFI close |
| Role isolation | Client CSV export has no internal cost columns |
| File survives refresh | Download .docx / xlsx / pdf again after 24h |
| Audit trail | Upload, punch, publish, close each has audit row |
| Cross-project | User on A cannot see B without membership |

---

## 6. Suggested calendar (10 working days)

| Day | Focus | Projects |
|-----|--------|----------|
| 1 | Setup A & B, directory, matrix | A + B |
| 2 | Drawings + DMS + drawing RFIs | A |
| 3 | Drawings + DMS | B |
| 4 | Quality + inspection IR logs | A |
| 5 | Safety + field diary | A |
| 6 | Quality + safety | B |
| 7 | Progress + cost BOQ + vendor rates | A |
| 8 | Cost/finance + comms | B |
| 9 | Reports WPR/DPR + multi-login scenarios | A + B |
| 10 | Integrity sheet + closure + sign-off meeting | A + B |

Adjust pace with SPDC availability; can run A and B in parallel with two office testers.

---

## 7. Deliverables

1. **Filled checklists** — extend [03-Module-Test-Plan.md](./03-Module-Test-Plan.md) rows for both projects  
2. **Trace spreadsheet** — module, record ID, entered by, date, pass/fail  
3. **Bug log** — screenshot, role, project, steps  
4. **WhatsApp weekly summary** — done / next / blockers (template in Phase 1 report)  
5. **Phase 2 sign-off** — when all critical paths Pass on both projects  

---

## 8. WhatsApp kickoff message (Phase 2)

```
Sharnam Portal — Phase 2 kickoff | <date>

Phase 1 (CRM, HRMS, Custom Sheets) — ready for your walkthrough & sign-off.

Phase 2 plan:
• 2 projects — full module data entry + uploads
• Office, site, client, vendor logins tested in parallel
• Data checks: registers, dashboards, exports must match
• Drawing RFI info only in Drawings; Quality & Safety separate logs

We need from SPDC:
1) Two project names/codes for test
2) Phase 1 sign-off contact
3) Sample files for BOQ / drawings for upload week

First session: project setup + directory + comms matrix (Day 1).
```

---

## 9. Dev / deploy during Phase 2

- Fix bugs on `main` with small commits; redeploy Hostinger after each batch  
- No bulk schema changes without migration note to client  
- Letter / RFI UX improvements already on main — include in release notes when deployed  

---

## 10. References

- Module page index: `docs/client-testing/00-MASTER-INDEX.md`  
- Per-module stakes: `docs/client-testing/modules/*.md`  
- Phase 1 report: [PHASE1-CRM-HRMS-TEST-REPORT.md](./PHASE1-CRM-HRMS-TEST-REPORT.md)
