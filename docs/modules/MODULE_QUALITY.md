# MODULE — Quality (QI · QAP · NCR · Cube · Inspection)

**Prompt:** `module_prompts/Quality.md`  
**SRS:** [CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md) §4.4 · §3B  
**Hub:** `/projects/:id/hub/quality`

---

## 1. Purpose

Quality inspections, QAP, **NCR / CAR** and **Cube** as separate tools, checklist master (Excel), and **Request for Inspection**.

---

## 2. Tools (sheet → hub card)

| Tool | Hub / route | Status | Source sheet |
|------|-------------|--------|--------------|
| Quality dashboard / QI | `/inspections` | Built | QI process |
| **NCR / CAR** | `/inspections?view=ncr` | Built | `NCR 01.xlsx` |
| **Cube register** | `/inspections?view=cube` | Built | `SPDC CUBE REGISTER` |
| Checklist master | `/checklist-master?family=QualityInspection` | Built | Excel QI templates |
| QI fill log | `/checklist-logs?family=QualityInspection` | Built | Fill audit |
| QAP | `/qap` | Built | `Quality Assurance Plan Week 50.xlsx` |
| Site checklists | `/checklist` | Built | Final Index |
| Request for Inspection | `/rfis?kind=QualityInspection` | Built | Inspection request |

### Awaiting next sheets

| Tool | Status | Notes |
|------|--------|-------|
| Extra QI families / trade packs | Ready | New Excel → Checklist master family; add hub card if first-class |

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
| srNo | text | |
| castDate / testDate | date | |
| description / grade | text | |
| result / strength | number/text | |
| status | | |

---

## 6. Quality NCR

| Field | Type | Notes |
|-------|------|-------|
| number | text | |
| ncrType | text | |
| description | text | |
| location | text | |
| severity / status | enum | |
| plannedClosure / actualClosure | date | |
| linkedInspectionId | link | optional |

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

## 9. Sheet sources

- `Quality Assurance Plan Week 50.xlsx`  
- `NCR 01.xlsx`  
- `SPDC CUBE REGISTER`  
- Final Index catalog  

---

## 10. Roles

| Role | Can |
|------|-----|
| Office / Site | Create templates, QI, NCR, QAP update |
| Client | Create checklist where enabled; view |
| Contractor | Fill assigned forms |

---

## 11. Review checklist

- [ ] Confirm photo count rules per checklist type  
- [ ] Confirm drawing gate for QI create  
- [ ] Confirm QAP update ownership  
- [ ] Confirm any new NCR columns from next sheet drop  
