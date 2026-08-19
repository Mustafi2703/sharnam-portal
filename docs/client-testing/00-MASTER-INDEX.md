# Master page & route index

All routes under `/projects/:id` use **ProjectToolsLayout** (sticky module tool strip + Actions panel) unless noted.

## Global (no project)

| Route | Page | Module doc |
|-------|------|------------|
| `/dashboard` | Cross-project KPIs | 12-global-office |
| `/master` | Master setup hub | 12-global-office |
| `/master/vendors` | **Company vendor directory** (global) | 00-home-directory-vendors |
| `/master/checklists` | Global checklist templates | 12-global-office |
| `/projects` | Project list + create | 12-global-office |
| `/hrm/*` | HRMS | 12-global-office |
| `/crm/*` | CRM + bids | 12-global-office |
| `/roles` | Access roles | 12-global-office |
| `/audit` | Audit trail | 12-global-office |
| `/attendance` | Site attendance punch | 06-field |
| `/upload-lab` | Photo/PDF sandbox | 06-field |

## Project — home & directory

| Route | Tool tab | Doc section |
|-------|----------|-------------|
| `/projects/:id` | Project home | 00 — Project home |
| `/projects/:id/directory?party=` | Directory · Office/Site/Client/Contractor | 00 — Directory |
| `/projects/:id/vendors` | Vendors | 00 — Project vendors |

## Project — module hubs

| Route | Module |
|-------|--------|
| `/projects/:id/hub/drawings` | Drawings |
| `/projects/:id/hub/dms` | Documents |
| `/projects/:id/hub/quality` | Quality |
| `/projects/:id/hub/safety` | Safety |
| `/projects/:id/hub/progress` | Progress |
| `/projects/:id/hub/field` | Field |
| `/projects/:id/hub/comms` | Comms |
| `/projects/:id/hub/cost` | Cost |
| `/projects/:id/hub/finance` | Finance |
| `/projects/:id/hub/reports` | Reports |
| `/projects/:id/hub/closure` | Closure |

## Project — tools by module

See each `modules/NN-*.md` file for **features per page** and a **Meeting changes** stake under each page (fill during UAT — not dev history).

### Drawings
`drawings` · `drawings/register` · `drawings/register?sheet=master|site` · `drawings/library` · `drawings/coordination` · `drawings/upload-revision` · `drawings/precheck` · `drawings/checklist-master` · `drawings/checklist-logs` · `rfis?kind=DrawingChecklist|RequestForInformation`

Legacy `?sheet=client` redirects to **master** (client columns merged).

### Documents
`dms`

### Quality
`inspections` · `inspections?sheet=sor-log|checklist-summary|car-register|cube-test|qi` · **`qap`** (full QAP sheet — replaces legacy `?sheet=qap-detail`) · `quality/checklist-master` · `quality/checklist-logs` · `rfis?kind=QualityInspection`

> **Not in Quality nav:** Site checklists (Field) · Drawing check (Drawings) · Safety checklists (Safety)

### Safety
`safety?sheet=` · `safety/checklist-master` · `safety/checklist-logs` · `rfis?kind=SafetyChecklist`

### Checklist fill (all modules)
| Family | Master | Logs | Fill URL |
|--------|--------|------|----------|
| DrawingCheck | `drawings/checklist-master` | `drawings/checklist-logs` | `?family=DrawingCheck` |
| QualityInspection | `quality/checklist-master` | `quality/checklist-logs` | `?family=QualityInspection` |
| Safety | `safety/checklist-master` | `safety/checklist-logs` | `?family=Safety` |
| SiteExecution | `checklist-master?family=SiteExecution` | field logs | `?family=SiteExecution` |

### Progress
`progress?tab=overview|milestones|planned|monthly|hindrance|risk|legal` · Ready: `scurve|schedule|msproject|procurement`

**Planned vs Actual** (`?tab=planned`) = weekly qty + weekly manpower + RA-month billing from `Planned Vs. Actual Dashboard.xlsx`. **Not** Cost cashflow.

### Field
`diary` · `photos` · `site-pilot` · `submittals` · `rfis` (field)

### Comms
`comms?tab=` · `email` · `rfis?kind=RequestForInformation`

### Cost / Finance / Reports / Closure
`cost?tab=` · `finance?tab=` · `dpr-maker` · `wpr-maker` · `reports?kind=` · `closure?sheet=`

## Standalone flows (no tool strip layout chrome)

| Route | Purpose |
|-------|---------|
| `/projects/:id/checklist/fill/:assignmentId` | Full-window checklist fill |
| `/projects/:id/drawings/precheck` | Drawing check before upload |
