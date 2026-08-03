# MODULE — Progress

**Prompt:** `module_prompts/Progress_overview.md`  
**SRS:** [CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md) §4.6 · §3A  
**Hub:** `/projects/:id/hub/progress`

---

## 1. Purpose

Schedule / milestone / planned-vs-actual / hindrance / risk / legal registers.  
Client civil tools (**S-curve**, **Summary schedule**, **MS Project**, **Procurement**) are **Ready** hub cards awaiting sheets.

---

## 2. Tools (sheet → hub card)

| Tool | Hub / route | Status | Source sheet |
|------|-------------|--------|--------------|
| Overview | `/progress` | Built | Progress Overview.xlsx |
| Milestones | `/progress?tab=milestones` | Built | Milestone tracking.xlsx |
| Planned vs Actual | `/progress?tab=planned` | Built | Planned Vs. Actual Dashboard |
| Monthly | `/progress?tab=monthly` | Built | Monthly Progress Dashboard |
| Hindrance | `/progress?tab=hindrance` | Built | Hindrance Register Dashboard |
| Risk | `/progress?tab=risk` | Built | Progress Overview · Risk |
| Legal | `/progress?tab=legal` | Built | Progress Overview · Legal Approval |
| **S-curve** | `/progress?tab=scurve` | **Ready** | MS Project / S-curve pack |
| **Summary schedule** | `/progress?tab=schedule` | **Ready** | Project summary schedule + PDF |
| **MS Project progress** | `/progress?tab=msproject` | **Ready** | MS Project export |
| **Procurement plan** | `/progress?tab=procurement` | **Ready** | Procurement plan + PDF |

Ready tools open a placeholder that matches hub IA — drop the sheet and wire fields without new navigation.

---

## 3–8. Field tables

Milestone, Planned vs Actual, Hindrance, Risk, Legal, Monthly / SOR — see prompt + seeded registers.

### Milestone (baseline)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| code | text | Y | |
| category | text | N | |
| activity | text | Y | |
| plannedStart / plannedEnd | date | N | |
| actualStart / actualEnd | date | N | |
| plannedDays / actualDays / varianceDays | number | N | |
| weightage / pctComplete | number | N | |
| stakeholder / zone | text | N | |
| status | enum | N | |

---

## 9. Client civil Ready tools (fields when sheet lands)

| Tool | Fields / artifacts |
|------|-------------------|
| Summary schedule | fileUrl (PDF), title, uploadedAt |
| MS Project progress | task, % complete, baseline |
| S-curve | period, planned %, actual % |
| Procurement plan | line items or PDF pack |

---

## 10. Checklist → Reports mapping

| Checklist type | Feeds |
|----------------|-------|
| SiteExecution | DPR site section |
| DrawingCheck | DPR/WPR drawing section |
| QualityInspection | DPR/WPR quality |
| Safety | DPR/WPR safety |

---

## 11. Sheet sources

- Progress Overview, Milestone tracking, Planned Vs Actual, Monthly Progress, Hindrance Register  
- **Next:** MS Project, summary schedule PDF, procurement plan  

---

## 12. Review checklist

- [ ] Confirm S-curve period (week/month) when pack arrives  
- [ ] Confirm procurement plan home (Progress vs own)  
- [ ] Confirm Client PDF viewer UX  
