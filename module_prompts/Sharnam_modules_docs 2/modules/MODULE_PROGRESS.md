# MODULE — Progress

**Prompt:** `module_prompts/Progress_overview.md`  
**SRS:** [CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md) §4.6 · §3A

---

## 1. Purpose

Schedule / milestone / planned-vs-actual / hindrance / risk / legal progress registers, plus client civil views (S-curve, summary schedule, MS Project progress, procurement).

---

## 2. Tools

| Tool | Status | Notes |
|------|--------|-------|
| Overview | Partial | KPI charts |
| Milestones | Built | Full register |
| Planned vs Actual / S-curve | Partial | Excel/manual; MS Project later |
| Summary schedule | Design | Client file + PDF |
| MS Project progress | Design | Import / sync |
| Procurement plan | Design | Client-visible + PDF |
| Monthly | Built | SOR-style |
| Hindrance | Built | |
| Risk | Built | |
| Legal | Built | Legal Approval Tracker |
| Manpower / activity lines | Built | With PvA |

---

## 3. Milestone fields

| Field | Type | Required | Notes / review |
|-------|------|----------|----------------|
| code | text | Y | |
| category | text | N | |
| activity | text | Y | |
| plannedStart / plannedEnd | date | N | |
| actualStart / actualEnd | date | N | |
| plannedDuration / actualDuration | number | N | |
| variance | number | N | computed |
| weight / percentComplete | number | N | |
| stakeholder | text | N | |
| zone | text | N | |
| status | enum | N | |

---

## 4. Planned vs Actual

| Sub-register | Fields (baseline) |
|--------------|-------------------|
| Cashflow P/A | period, planned, actual |
| Manpower | period, planned, actual, trade |
| Activity qty | activity, planned qty, actual qty, unit |

S-curve: from MS Project % / baseline or Excel until Graph sync.

---

## 5. Hindrance

| Field | Type | Notes |
|-------|------|-------|
| description | text | |
| location | text | |
| activity | text | |
| category / type | text | |
| startDate / endDate | date | |
| days | number | |
| status | enum | |
| impact notes | text | |

---

## 6. Risk

| Field | Type | Notes |
|-------|------|-------|
| title / description | text | |
| probability | number/enum | |
| consequence | number/enum | |
| score | computed | P × C |
| costImpact | money/text | |
| owner | user | |
| mitigation | text | |
| status | enum | |

---

## 7. Legal approval

| Field | Type | Notes |
|-------|------|-------|
| approvalItem | text | |
| authority | text | |
| submittedOn / approvedOn | date | |
| status | enum | |
| remarks | text | |

---

## 8. Monthly / SOR

| Field | Notes |
|-------|-------|
| period | month |
| open / closed counts | |
| closure rate | computed |

---

## 9. Client civil extras (fields)

| Tool | Fields / artifacts |
|------|-------------------|
| Summary schedule | fileUrl (PDF), title, uploadedAt |
| MS Project progress | task, % complete, baseline |
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

---

## 12. Review checklist

- [ ] Confirm S-curve period (week/month)  
- [ ] Confirm procurement plan home (Progress vs own)  
- [ ] Confirm Client PDF viewer UX  
