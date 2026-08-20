# MODULE — Progress

**Prompt:** `module_prompts/Progress_overview.md`  
**SRS:** [CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md) §4.6 · §3A  
**Hub:** `/projects/:id/hub/progress`

---

## 1. Purpose

Schedule / milestone / planned-vs-actual / hindrance / risk / legal registers plus **S-curve** and **MS Project XML** for DPR/WPR. Extra placeholder tools (summary schedule PDF, procurement pack) were removed.

---

## 2. Tools (sheet → hub card)

| Tool | Hub / route | Status | Source sheet |
|------|-------------|--------|--------------|
| Overview | `/progress` | Built | Progress Overview.xlsx |
| Milestones | `/progress?tab=milestones` | Built | Milestone tracking.xlsx |
| Planned vs Actual | `/progress?tab=planned` | Built | Planned Vs. Actual Dashboard — cashflow · manpower · activity qty sub-tools (`?pva=`) |
| PvsA · Cashflow | `?tab=planned&pva=cashflow` | Built | Sync → Cost cashflow / WPR |
| PvsA · Manpower | `?tab=planned&pva=manpower` | Built | Trade shortage |
| PvsA · Activity qty | `?tab=planned&pva=activity` | Built | Qty register + BOQ monitoring link |
| Monthly | `/progress?tab=monthly` | Built | Monthly Progress Dashboard |
| Hindrance | `/progress?tab=hindrance` | Built | Hindrance Register Dashboard |
| Risk | `/progress?tab=risk` | Built | Risk Register - Dashboard 1.xlsx |
| Legal | `/progress?tab=legal` | Built | Legal Approvals - Dashboard.xlsx |
| **S-curve** | `/progress?tab=scurve` | Built | MS Project XML weekly % |
| **MS Project** | `/progress?tab=msproject` | Built | MS Project XML task register |

Removed: Summary schedule placeholder, Procurement plan placeholder.

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
