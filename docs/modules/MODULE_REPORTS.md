# MODULE — Reports (DPR · WPR)

**Prompts:** `module_prompts/dpr_generation.md`, `module_prompts/WPR_generation.md`  
**SRS:** [CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md) §4.11

---

## 1. Purpose

Generate Daily / Weekly packs from **live registers** (not a separate data silo). Match client Excel layouts; show PDFs on client civil side.

---

## 2. Tools

| Tool | Status | Notes |
|------|--------|-------|
| Generate DPR | Built | Date picker → HTML/JSON pack |
| Generate WPR | Built | Week-ending → HTML/PDF |
| Pack viewer | Partial | In-app PDF/HTML view for Client |

---

## 3. DPR sections (from DPR-Sharnam PMC template)

| # | Section | Source modules |
|---|---------|----------------|
| 1 | Summary | Project, client, consultant, PMC |
| 2 | Manpower, Equipments, Materials | Field day log |
| 3 | Concern Register | Concerns / RFIs (building, impact, responsibility, day status) |
| 4 | Hindrance Register | Progress hindrance |
| 5 | Daily Progress Dashboard | Progress + day log |
| 6 | Site Photographs | Field photos |
| 7 | Checklist fills by type | See mapping below |

### DPR generate fields

| Field | Notes |
|-------|-------|
| projectId | |
| reportDate | Selected day |
| generatedBy / at | |
| packUrl | HTML/JSON/PDF artifact |

---

## 4. WPR contents (assembled)

| Block | Source |
|-------|--------|
| Drawing / GFC snapshot + DrawingCheck fills | Drawings |
| Milestones & Planned vs Actual | Progress |
| Cashflow / budget status | Cost |
| Quality NCR + cube + QI fills + QAP | Quality |
| Safety NCR + Safety fills | Safety |
| Hindrance & risk | Progress |
| SiteExecution → weekly KPIs | Checklists / Field |

### WPR generate fields

| Field | Notes |
|-------|-------|
| projectId | |
| weekEndingDate | |
| generatedBy / at | |
| packUrl | |

---

## 5. Checklist type → report section

| Fill type | DPR / WPR section |
|-----------|-------------------|
| `SiteExecution` | Site execution / daily site checklist |
| `DrawingCheck` | Drawing / GFC checklist |
| `QualityInspection` | Quality (+ NCR / cube / QAP on WPR) |
| `Safety` | Safety |

---

## 6. Roles

| Role | Can |
|------|-----|
| Site | Fill day log / checklists that feed packs |
| Office | Generate DPR/WPR |
| Client | View published packs / PDFs |

---

## 7. Rules

1. Packs pull live data at generate time.  
2. Seed keeps sheet-backed registers maintainable.  
3. Client civil must see generated report PDFs.

---

## 8. Review checklist

- [ ] Confirm DPR section order vs latest client Excel  
- [ ] Confirm WPR week definition (Mon–Sun vs custom)  
- [ ] Confirm auto-publish to Client vs manual share  
