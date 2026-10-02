# MODULE — Quality (QI · QAP · NCR · Cube · Inspection IR)

**Prompt:** `module_prompts/Quality.md`  
**SRS:** [CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md) §4.4 · §3B

---

## 1. Purpose

Live Quality module for projects: QAP Week 50, SPDC cube crushing register, Quality Dashboard workbook, branded NCR/CAR (NCR 01), Request for Inspection (Quality IR F-01), and QI checklist fills. Weekly SharePoint packs mirror the drawings pattern (live file + `Weekly/{week}` copy).

---

## 2. Tools (live)

| Tool | Route | Notes |
|------|-------|-------|
| Quality dashboard | `/projects/:id/inspections` | KPI tiles from DB + workbook tabs |
| QAP (Week 50) | `/projects/:id/qap` | Full Excel layout; import / sync / publish |
| Cube register | `/inspections?sheet=cube-test` | SPDC cols B–M; import Excel; Phase/agency portal extras |
| NCR / CAR | `/inspections?sheet=` CAR | Branded NCR 01 XLSX + HTML → Drive |
| Inspection register | `/projects/:id/inspection` | Quality IR / Safety IR / Activity / HSE |
| Checklist master | `/quality/checklist-master` | QI family templates |
| QI fill log | `/quality/checklist-logs` | Assignees fill; branded export |
| Request for Inspection | Inspection register · kind `QualityIR` | SPDC/QA/F-01; matrix assignee + checklist |

---

## 3. Client sheet formats (source of truth)

| File | Portal use |
|------|------------|
| `Quality Assurance Plan Week 50.xlsx` | QAP import / sync-template / weekly publish |
| `Quality Dashboard.xlsx` | Dashboard stamp + CAR register from DB NCRs |
| `SPDC CUBE REGISTER (1).xlsx` | Cube import / export (clear demo body on export) |
| `SPDC_Request_for_Inspection_Form.xlsx` | Quality IR raise + branded export |
| `NCR 01 .xlsx` | Branded NCR/CAR export |

Templates live under `seed/data` and `module_prompts/Sharnam_modules_docs 2/`. Server uses `SHARNAM_EXCEL_ROOT`.

---

## 4. Weekly SharePoint pack

`POST /api/checklist/project/:id/qap/publish` → `publishQualityPackToDrive`:

1. QAP Week 50 workbook  
2. SPDC Cube Register  
3. Quality Dashboard (CAR from live NCRs)  
4. Open NCRs as branded NCR 01 files  

Each workbook is written to the ISO quality folder **and** `…/Weekly/{weekStamp}/` (same pattern as drawings). Day-close reconcile also refreshes the pack.

---

## 5. Cube register alignment

- Excel layout: **Sr No → Result in columns B–M** (column A empty in the client file).  
- Import auto-detects SheetJS offset (stripped A) vs ExcelJS (kept A).  
- Export fills the SPDC template, **clears leftover demo rows**, stamps project branding.  
- Portal UI adds **Test agency** and **Phase (7D/28D)** for site use; they are not extra Excel columns.  
- `POST …/cubes/import` replaces rows from an uploaded client workbook and republishes the quality pack.

---

## 6. Quality IR + communication matrix

1. Raise IR on Inspection register (SPDC F-01 fields).  
2. Pick checklist from master + **assignee** from project members **or** TECHNICAL matrix contacts (email → portal user).  
3. API accepts matrix assignees even when they are not yet `ProjectMember`.  
4. Fill-request draft lands on the fill log for that assignee; they complete it in the portal fill window.  
5. Export IR as branded XLSX/HTML.

---

## 7. Clear Quality · Safety (not drawings)

- UI: Projects → **Clear Quality · Safety** (type project code).  
- API: `POST /api/projects/:id/purge-quality-safety`  
- Script: `npx tsx scripts/purge-quality-safety.mts --code "SHAR/SNT/26-27/Voltamp Transformers Ltd."`  

Removes QAP, cubes, NCRs, quality/safety RFIs & checklist fills, safety records. **Keeps** drawings, cost, progress, members, vendors, matrix.

---

## 8. Roles

| Role | Can |
|------|-----|
| Admin / Office | Purge quality/safety, publish packs, load templates |
| Site / Employee | Raise IR, edit QAP/cube, fill assigned checklists |
| Client | View; raise concerns where enabled |
| Matrix / vendor assignee | Fill assigned IR checklist drafts |

---

## 9. Review checklist

- [x] Cube import/export aligned to SPDC CUBE REGISTER  
- [x] Quality Dashboard CAR from DB  
- [x] Weekly quality pack like drawings  
- [x] Branded NCR 01 on publish  
- [x] Quality IR assignees from communication matrix  
- [ ] Voltamp Quality/Safety purged and empty registers ready for live entry  
- [ ] Progress / Safety modules next (Cost / Finance after)  
