# MODULE — Quality (QI · QAP · NCR · Inspection)

**Prompt:** `module_prompts/Quality.md`  
**SRS:** [CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md) §4.4 · §3B

---

## 1. Purpose

Quality inspections, QAP Week 50 register, NCR/CAR, SPDC cube crushing register, checklist master (Excel), and **Request for Inspection**.

---

## 2. Tools

| Tool | Status | Notes |
|------|--------|-------|
| QI dashboard | Built | Procore-style inspections + **Quality Dashboard workbook tabs** |
| Checklist master | Built | Create; **upload Excel**; choose template; **global master at `/master/checklists`** |
| Branded fill export | Built | Checklist log → Download branded HTML (Print → PDF) |
| **QAP (Week 50)** | Built | **`/qap`** — full Excel layout, ~295 rows, daily check columns, auto sync from seed |
| Site checklists | Built | Assign / fill (Final Index family) |
| **Cube register** | Built | SPDC grouped specimens — inline edit, test agency, DPR stats |
| NCR / CAR | Built | NCR 01 form window, Excel export, status emails |
| SOR Log | Built | Site observation + instruction → DPR date-wise |
| **Request for Inspection** | Built (label) | Kind `QualityInspection` — **Drawings Ask (PMC RFI) moved to Drawings module** |

---

## 3. Quality Inspection fields

| Field | Type | Required | Notes / review |
|-------|------|----------|----------------|
| title | text | Y | |
| inspectionType | text | N | Default Quality |
| status | enum | Y | Draft → Ready → In Progress → Closed |
| location | text | N | |
| linkedDrawingId | link | N | Gate may require published drawing |
| checklistTemplateId | link | N | |
| trade | text | N | |
| createdBy | user | Y | |
| items[] | | | prompt, result, notes, photos |

---

## 4. QAP activity (Week 50 sheet)

| Field | Type | Notes |
|-------|------|-------|
| weekLabel | text | Canonical `Week 50` (aliases `W50` filtered) |
| srNo / section | text | Activity group (Site Survey, Reinforcement, …) |
| description | text | Line item / material check |
| frequency | text | From Excel col D |
| codeOfConformance | text | Col E |
| testAgency | text | Col F — also feeds DPR “Testing agency” line |
| contractorPerformer / contractorChecker | text | Col G–H |
| pmcRole / clientRole | text | Col I–J |
| records / remarks | text | Col K–L |
| dailyChecks | JSON | Cols M–S (7 day checkboxes) |
| status | Open / Done | Inline edit on `/qap` |

**Seed / sync:** `POST /api/checklist/project/:id/qap/sync-template` loads `Quality Assurance Plan Week 50.xlsx` from `SHARNAM_EXCEL_ROOT`. Auto-runs on `/qap` when register is partial or legacy.

---

## 5. Cube test (SPDC CUBE REGISTER)

| Field | Type | Notes |
|-------|------|-------|
| srNo | text | Footing / pour group |
| castDate | date | Group cast date |
| description / grade | text | Footing label, M:25 etc. |
| testAgency | text | NABL / site lab — **DPR quality block** |
| cubeWeight | number | Per specimen (kg) |
| testDate7 / testDate28 | date | Group testing schedule |
| load7 / load28 | number | kN per specimen row |
| strength7 / strength28 | number | MPa — **7D and 28D rows are separate specimens** (not duplicate errors) |
| avgStrength / result | number / PASS\|FAIL | Group summary |
| source | text | `SPDC CUBE REGISTER (1).xlsx` or `portal` |

**Seed / sync:** `POST /api/checklist/project/:id/cubes/sync-template` (~429 specimens / 73 groups). UI: inline edit all columns; KPI summary (pass/fail/pending/agencies).

---

## 6. Quality NCR / CAR

| Field | Type | Notes |
|-------|------|-------|
| number | auto | NCR-* / CAR-* |
| description | text | |
| formDataJson | JSON | SPDC NCR 01 form — required before close |
| status | Open / Closed | Close via form window + email notify |

---

## 7. Quality Dashboard workbook (sheet tabs)

UI route: `/projects/:id/inspections` with `?sheet=` query. **QAP** is a dedicated page at **`/qap`**.

| Tab | Sheet source | Purpose |
|-----|--------------|---------|
| Dashboard | Dashboard | KPI tiles — open QI, QAP open/done, concreting week |
| **SOR Log** | SOR Log | Live totals from site obs/instruction + NCR/CAR |
| Site observation / instruction | — | Inline + modal; feeds SOR + DPR |
| Checklist summary | Sheet1 + Sheet2 | Catalog + filled counts by discipline |
| CAR / NCR register | CAR register · NCR 01 | Form window, Excel export |
| Cube Test | SPDC Cube Register | Full register — scrollable grid |
| QI & checklist fills | — | Active inspection assignments |

**DPR wiring:** SOR lines, NCR/CAR today, cube sets, 7/28-day results, test agency, QI/Safety checklist counts → `buildDprAutoFill` (`dprIntegrations.ts`).

---

## 8. Sheet sources (seed/data)

| File | Portal use |
|------|------------|
| `Quality Assurance Plan Week 50.xlsx` | QAP sync-template (~295 rows) |
| `SPDC CUBE REGISTER (1).xlsx` | Cube sync-template |
| `Quality Dashboard.xlsx` | Dashboard KPIs, CAR summary (not full QAP) |
| `NCR 01 .xlsx` | NCR/CAR register seed |

Requires `SHARNAM_EXCEL_ROOT=./seed/data` on server. After schema change: `npx prisma db push`.

---

## 9. Roles

| Role | Can |
|------|-----|
| Office / Site | Create templates, QI, NCR, QAP/cube edit, sync templates |
| Client | View; raise concerns where enabled |
| Contractor | Fill assigned forms |

---

## 10. Review checklist

- [ ] Confirm photo count rules per checklist type  
- [ ] Confirm drawing gate for QI create  
- [ ] QAP Week 50 shows ~295 lines with frequency + daily checks on demo  
- [ ] Cube register shows grouped 7D/28D rows + test agency logged  
- [ ] DPR Maker quality block populates on report day with cube cast/test dates  
