# MODULE — Quality (QI · QAP · NCR · Inspection)

**Prompt:** `module_prompts/Quality.md`  
**SRS:** [CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md) §4.4 · §3B

---

## 1. Purpose

Quality inspections, QAP, NCR/cube registers, checklist master (Excel), and **Request for Inspection**.

---

## 2. Tools

| Tool | Status | Notes |
|------|--------|-------|
| QI dashboard | Built | Procore-style inspections + **Quality Dashboard workbook tabs** |
| Checklist master | Built | Create; **upload Excel**; choose template; **global master at `/master/checklists`** |
| Branded fill export | Built | Checklist log → Download branded HTML (Print → PDF) |
| QAP | Built | Upload / update Week-50 plan |
| Site checklists | Built | Assign / fill (Final Index family) |
| Cube register | Built | Cast / test results |
| NCR / observations | Built | Quality NCRs |
| **Request for Inspection** | Built (label) | Kind `QualityInspection` |

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

### Inspection item

| Field | Notes |
|-------|-------|
| prompt | From template |
| result | Pass / Fail / NA / … |
| notes | |
| photos | Where required (e.g. 3 for site items) |

---

## 4. QAP activity

| Field | Type | Notes |
|-------|------|-------|
| week / period | | From Week-50 sheet |
| activity | text | |
| contractor / pmc / client | status or % | Matrix columns |
| updatedAt | | Always editable |

---

## 5. Cube test

| Field | Type | Notes |
|-------|------|-------|
| castDate / testDate | date | |
| grade / location / sampleId | text | |
| result / strength | number/text | |
| status | | |

---

## 6. Quality NCR

| Field | Type | Notes |
|-------|------|-------|
| number | auto | |
| description | text | |
| againstInstruction | text | |
| severity / status | enum | |
| linkedInspectionId | link | optional |
| closedAt | | |

---

## 7. Checklist master (Quality family)

| Field | Notes |
|-------|-------|
| family | QualityInspection / SiteExecution |
| name | |
| items from Excel upload | Header → rows |
| choose template for fill / inspection request | |

Drawing checklist master lives under **Drawings**, not here.

---

## 8. Request for Inspection (Quality)

| Field | Notes |
|-------|--------|
| rfiKind | `QualityInspection` |
| UI label | **Request for Inspection** |
| linkedAssignmentId / checklist | Fill target |
| notify | Matrix / vendor |

---

## 9. Quality Dashboard workbook (sheet tabs)

Seeded from client **`Quality Dashboard.xlsx`**, **`NCR 01.xlsx`**, and **`SPDC CUBE REGISTER`**. UI route: `/projects/:id/quality/inspections` with `?sheet=` query.

| Tab | Sheet source | Purpose |
|-----|--------------|---------|
| Dashboard | Dashboard | KPI tiles — open QI, QAP open/done, concreting week |
| **SOR Log** | SOR Log | Site Observation / Site Instruction / NCR totals — open, closed, closure rate |
| Checklist summary | Sheet1 + Sheet2 | Catalog + filled counts by discipline |
| CAR / NCR register | CAR register · NCR 01 | Raise NCR/CAR — feeds DPR quality block |
| Cube Test | Cube Test · SPDC Cube Register | Cast / test results |
| QAP Detail | QAP Detail | Week-50 activity matrix (contractor / PMC / client) |
| QI & checklist fills | — | Active inspection assignments |

**SOR Log → DPR:** observation totals and closure rates surface in the DPR Quality section when reports are generated.

---

## 10. Sheet sources

- `Quality Assurance Plan Week 50.xlsx`  
- `NCR 01.xlsx`  
- `SPDC CUBE REGISTER`  
- Final Index catalog  

---

## 11. Roles

| Role | Can |
|------|-----|
| Office / Site | Create templates, QI, NCR, QAP update |
| Client | Create checklist where enabled; view |
| Contractor | Fill assigned forms |

---

## 12. Review checklist

- [ ] Confirm photo count rules per checklist type  
- [ ] Confirm drawing gate for QI create  
- [ ] Confirm QAP update ownership  
