# 05 — LLD: Site Audit & Master KPI / KRA

**Version:** 0.1 · 2026-08-03  
**Status:** Source Excel packs in `docs/` · **Design** (not wired to code)  
**Sources:**
- [`SITE_AUDIT_Pack.xlsx`](../SITE_AUDIT_Pack.xlsx) — sheets: DASHBOARD, PLAN, DC_INTERVIEW, SITE_WALK, FOLDER_SAMPLE, FINDINGS  
- [`MASTER_KPI_DASHBOARD.xlsx`](../MASTER_KPI_DASHBOARD.xlsx) — KPI dashboard, ISO folder map, area rollup, subject data, trends, role KRA

---

## 1. Purpose

Provide ISO-aligned **project assurance**:
- Run structured **site audits** (plan → interview → walk → folder sample → findings)
- Roll up **127 subjects / 10 ISO areas** into a live KPI dashboard with RAG
- Feed **role KRA scorecards** used in HRMS appraisals

---

## 2. Site Audit module

### 2.1 Tools (1:1 with pack sheets)

| Tool | Sheet | Purpose |
|------|-------|---------|
| Audit Dashboard | DASHBOARD | Counts, open/closed findings, RAG summary |
| Audit Plan | PLAN | Scope, areas, schedule, auditors |
| DC Interview | DC_INTERVIEW | Document controller interview checklist |
| Site Walk | SITE_WALK | Walkthrough checklist items |
| Folder Sample | FOLDER_SAMPLE | Sample controlled folders / evidence |
| Findings | FINDINGS | Nonconformities / observations / CAPA |

### 2.2 Entities

#### SiteAudit

| Field | Type | Notes |
|-------|------|-------|
| id | cuid | |
| projectId | cuid | Required |
| title | string | |
| plannedDate | date | |
| status | enum | Planned / InProgress / ReportDraft / Closed |
| leadAuditorId | userId | |
| teamUserIdsJson | string | |
| scopeNotes | text | |

#### SiteAuditChecklistItem

| Field | Type | Notes |
|-------|------|-------|
| auditId | | |
| section | enum | DcInterview / SiteWalk / FolderSample |
| itemNo | int | |
| prompt | text | |
| response | enum? | Yes / No / NA / Partial |
| evidenceUrl | string? | |
| notes | text? | |

#### SiteAuditFinding

| Field | Type | Notes |
|-------|------|-------|
| auditId | | |
| findingNo | string | |
| severity | enum | Critical / Major / Minor / Observation |
| isoArea | string | e.g. 08_QUALITY_HSE… |
| subjectCode | string? | Link to KPI subject |
| description | text | |
| evidenceUrlsJson | string | |
| rootCause | text? | |
| correctiveAction | text? | |
| ownerUserId | userId? | |
| dueDate | date? | |
| status | enum | Open / InProgress / Closed / Overdue |
| closedAt | datetime? | |

### 2.3 APIs

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/site-audits?projectId=` | List / create |
| GET/PATCH | `/api/site-audits/:id` | Header |
| GET/PUT | `/api/site-audits/:id/items` | Checklist bulk |
| GET/POST | `/api/site-audits/:id/findings` | Findings |
| PATCH | `/api/site-audits/findings/:id` | CAPA update |
| GET | `/api/site-audits/:id/dashboard` | Aggregates |

### 2.4 UI

Office / Site (auditor roles): `/projects/:id/hub/audit` or Master → Site Audit.  
Client: read-only findings summary if enabled.

---

## 3. Master KPI / KRA module

### 3.1 ISO structure (from pack)

| Layer | Count (pack) | Example |
|-------|--------------|---------|
| ISO areas | 10 | 01_CONTEXT_AND_GOVERNANCE … 10_PERFORMANCE_… |
| Folders | ~100 | 01.01_Project_Charter_and_Context |
| Subjects | ~127 | Project Directory and Contact Matrix |

Custodian: HO / SITE / BOTH (from folder map).

### 3.2 Entities

#### KpiIsoArea

| Field | Type |
|-------|------|
| code, name, isoReference, sortOrder |

#### KpiFolder

| Field | Type |
|-------|------|
| areaCode, folderCode, name, isoClause, custodian |

#### KpiSubject

| Field | Type | Notes |
|-------|------|-------|
| projectId | | Per-project instance |
| folderCode | | |
| name | | |
| custodian | HO/SITE/BOTH | |
| recordsCount, openCount, closedCount, overdueCount | int | Maintained by refresh job |
| oldestOpenDays | int | |
| kraScore | float | |
| rag | enum | Red / Amber / Green |
| lastRefreshedAt | datetime | |

#### KpiTrendPoint

| Field | Type |
|-------|------|
| projectId, subjectId?, capturedOn, openCount, closedCount, overdueCount |

#### RoleKraTemplate / RoleKraItem

From sheet `06_ROLE_KRA` (Project Manager, Document Controller, …):

| Field | Type |
|-------|------|
| roleKey, kraNo, description, consequence, evidenceHint |
| kpiLines: code, targetText |

Project/HR links templates into **EmployeeKraCycle** (HRMS LLD).

### 3.3 Refresh logic

```
For each subject workbook / portal register mapping:
  compute records, open, closed, overdue, % closed, oldest open, KRA score, RAG
Write KpiSubject + optional TrendPoint
Roll up to ISO area dashboard
```

**v1:** manual “Refresh KPI” + seed from Excel import.  
**v2:** map subjects to live portal modules (RFIs, NCRs, drawings overdue, audit findings).

### 3.4 Document control health indicators

| Indicator | Target (from pack) |
|-----------|-------------------|
| Subjects with overdue | 0 |
| Total overdue items | 0 |
| Oldest open (days) | ≤ 14 |
| Overall closure rate | ≥ 90% |

### 3.5 APIs

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/kpi/projects/:projectId/import-pack` | Seed areas/folders/subjects from Excel |
| POST | `/api/kpi/projects/:projectId/refresh` | Recompute |
| GET | `/api/kpi/projects/:projectId/dashboard` | 00_KPI_DASHBOARD equivalent |
| GET | `/api/kpi/projects/:projectId/areas` | Rollup |
| GET | `/api/kpi/projects/:projectId/subjects` | Filterable list |
| GET | `/api/kpi/role-templates` | KRA templates |
| GET/POST | `/api/kpi/projects/:projectId/trends` | |

### 3.6 UI

- Project: **KPI Dashboard** tool (Reports or Assurance hub)  
- Master: import pack / templates  
- HRMS: pull role template into appraisal cycle  

---

## 4. Linkage matrix

| Audit / KPI | Links to |
|-------------|----------|
| Finding.subjectCode | KpiSubject |
| Finding CAPA overdue | Subject overdue counts |
| Role KRA evidence | Subject RAG, audit closure, report on-time |
| Document Controller KRA | Folder sample + register health |

---

## 5. Permissions

| Action | Roles |
|--------|-------|
| Run audit / edit findings | Office, designated Site auditors |
| Close finding | Owner + Office |
| Import KPI pack / refresh | Office / Admin |
| View dashboard | Office, Site; Client if enabled |
| Score employee KRA | HR + Reviewer |

---

## 6. Audit events

`site_audit.create`, `site_audit.findings.update`, `kpi.import`, `kpi.refresh`, `kpi.rag.change`

Next: [06-LLD-Sheet-Maker.md](./06-LLD-Sheet-Maker.md).
