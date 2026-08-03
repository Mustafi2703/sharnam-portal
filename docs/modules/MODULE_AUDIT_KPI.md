# MODULE — Site Audit & Master KPI / KRA (fields)

**Status:** Ready for packs — UI aligned to hub card pattern when enabled  
**SRS:** [CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md) §4.15  
**LLD:** [system-design/05-LLD-Audit-KPI.md](../system-design/05-LLD-Audit-KPI.md)  
**Sources:** `docs/SITE_AUDIT_Pack.xlsx`, `docs/MASTER_KPI_DASHBOARD.xlsx`  
**Prompt:** `module_prompts/audit_kpi.md`

When packs go live, expose **one hub card per sheet** (Dashboard, Plan, DC Interview, Site Walk, Folder Sample, Findings, KPI subjects) — same pattern as Progress / Cost.

---

## A. Site Audit

### A1. Tools (from pack sheets → future hub cards)

| Tool | Sheet | Status | Purpose |
|------|-------|--------|---------|
| Dashboard | DASHBOARD | Ready | Open/closed findings, RAG |
| Plan | PLAN | Ready | Scope, schedule, auditors |
| DC Interview | DC_INTERVIEW | Ready | Document controller interview |
| Site Walk | SITE_WALK | Ready | Walkthrough checklist |
| Folder Sample | FOLDER_SAMPLE | Ready | Controlled folder sampling |
| Findings | FINDINGS | Ready | NC / observation + CAPA |

### A2. Site audit header

| Field | Type | Required | Notes / review |
|-------|------|----------|----------------|
| projectId | link | Y | |
| title | text | Y | |
| plannedDate | date | Y | |
| status | enum | Y | Planned / InProgress / ReportDraft / Closed |
| leadAuditor | user | Y | |
| team | users[] | N | |
| scopeNotes | long text | N | |

### A3. Checklist item (interview / walk / folder)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| section | enum | Y | DcInterview / SiteWalk / FolderSample |
| itemNo | number | Y | |
| prompt | text | Y | From pack / template |
| response | enum | N | Yes / No / NA / Partial |
| evidenceUrl | file | N | |
| notes | text | N | |

### A4. Finding

| Field | Type | Required | Notes / review |
|-------|------|----------|----------------|
| findingNo | text | Y | Auto |
| severity | enum | Y | Critical / Major / Minor / Observation |
| isoArea | text | N | Link to KPI ISO area |
| subjectCode | text | N | Link to KPI subject |
| description | long text | Y | |
| evidence | files | N | |
| rootCause | text | N | |
| correctiveAction | text | N | |
| owner | user | N | |
| dueDate | date | N | |
| status | enum | Y | Open / InProgress / Closed / Overdue |
| closedAt | datetime | N | |

---

## B. Master KPI / KRA

### B1. Structure (from pack)

| Layer | Approx count | Example |
|-------|--------------|---------|
| ISO areas | 10 | 01_CONTEXT_AND_GOVERNANCE … |
| Folders | ~100 | 01.01_Project_Charter_and_Context |
| Subjects | ~127 | Project Directory and Contact Matrix |

Custodian: **HO / SITE / BOTH**.

### B2. Subject (per project)

| Field | Type | Notes / review |
|-------|------|----------------|
| projectId | link | |
| isoArea / folderCode | text | From pack |
| name | text | Subject title |
| custodian | enum | HO / SITE / BOTH |
| recordsCount | number | |
| openCount / closedCount / overdueCount | number | |
| oldestOpenDays | number | |
| % closed | number | computed |
| kraScore | number | |
| rag | enum | Red / Amber / Green |
| lastRefreshedAt | datetime | |

### B3. Document control health (dashboard targets)

| Indicator | Target (pack) |
|-----------|---------------|
| Subjects with overdue | 0 |
| Total overdue items | 0 |
| Oldest open (days) | ≤ 14 |
| Overall closure rate | ≥ 90% |

### B4. Role KRA template (from `06_ROLE_KRA`)

| Field | Type | Notes |
|-------|------|-------|
| roleKey | text | e.g. Project Manager, Document Controller |
| kraNo | text | KRA1… |
| description | text | What good looks like |
| consequence | text | If not achieved |
| evidenceHint | text | Where measured |
| kpiCode / target | text | Scorecard lines |

Used by HRMS Employee KRA cycles.

### B5. Actions

| Action | Who |
|--------|-----|
| Import pack / seed areas-folders-subjects | Office / Admin |
| Refresh KPI | Office |
| View dashboard | Office, Site; Client if enabled |
| Run audit / edit findings | Office + designated auditors |
| Close finding | Owner + Office |

---

## C. Review checklist

- [ ] Confirm which of 127 subjects map to live portal registers in v1 vs placeholder  
- [ ] Confirm Client visibility of audit findings / KPI  
- [ ] Confirm auditor roles  
- [ ] Confirm RAG thresholds  
