# Procore parity — research & setups

Sharnam adapts Procore tool shapes to PMC India workflows (GFC, Final Index, measurement sheet). Real Microsoft Graph stays deferred until client Azure creds arrive (`CLIENT_MICROSOFT_REQUEST.md`).

## Exact setups we mirror

| Procore concept | Sharnam equivalent | Setup notes |
|-----------------|-------------------|-------------|
| Project | `Project` + members/vendors | CRM convert or create |
| Drawings | GFC register + revisions R0–R5 | Publish unlocks QA; PDF/DWG to SharePoint |
| Drawing upload modal | Metadata + file + publish + **Drawing Check overlay** | PDF markup; DWG download-only |
| Specs / Documents | DMS mock OneDrive | Folder tree per project |
| Checklists | Final Index (SiteExecution) + **Drawing Check gate** | Dual-fill Yes/No/N.A.; branded HTML export |
| Inspections | QualityInspection templates | Separate from Final Index |
| Observations / Incidents | Safety records | Types + assignee |
| RFIs | RFIs & Concerns | Ball-in-court; client can raise |
| Daily Log | Employee Day Log | Per calendar day |
| Photos | Project photos | Linkable later to RFI/checklist |
| Meetings | Meetings + MoM items | Schedule + carry-over |
| Coordination | Design coordination issues | Elevate → RFI later |
| Submittals | Submittal register | Status / ball-in-court |
| Budget / Financials | Cost: Budget, Monitoring, MB, BBS, Cashflow | From `SPDC_Budget_Arvind 49.xls` + Cashflow Dashboard |
| **Global masters** | `/master` → Global masters tab | Checklist templates, custom sheet registers reusable across projects |
| Directory | Project directory + vendors | Assign employees |
| Permissions | Role matrix in `@sharnam/shared` | Portal-based login |
| Email distribution | Project email settings + outbox | Mock until SMTP/Graph |

## Upload modal standard (all file tools)

Fields common to Procore-style uploads:

- File (required)
- Number / code (drawing no, RFI no auto)
- Title / description
- Discipline or category
- Revision (drawings)
- Location (optional)
- Private / published (drawings: publish toggle)
- Attachments after create (photos)

## Integration order (recommended)

1. Drawings + gate  
2. Checklists / QI + audit CSV  
3. RFIs + day log  
4. Meetings / matrix  
5. Cost measurement + cashflow  
6. DMS Graph swap  
7. Real email  

## Gaps vs full Procore (document, don’t fake)

- Punch lists / BIM / bidding / payroll: out of scope unless requested  
- OCR drawing compare: deferred  
- Multi-company enterprise ACL: start with project membership  

## Daily sheet pack (per project)

Every project loads the same SPDC Excel formats. Site teams **add lines daily**; DPR Maker auto-fills from those registers.

| Layer | Master workbook | Portal | Daily update | Feeds DPR |
|-------|-----------------|--------|--------------|-----------|
| Cost | `SPDC_Budget_Arvind 49.xls` | Cost → Monitoring / MB / BBS | Achieved qty, MB measurements | Quantity progress |
| Quality | QAP Week 50 · Cube register · Quality Dashboard | Quality / QAP / Cube | QI fills, NCR, cube casts | Quality block |
| Safety | Safety Dashboard · HIRA | Safety | Toolbox, observations, NCR | HSE block |
| Progress | Planned Vs. Actual Dashboard | Progress → Planned | Weekly actual qty, hindrance | Qty hints + delays |
| Reports | `SPDC_DPR_*_DASHBOARD.xlsx` | DPR Maker | Publish for the day | SharePoint 07.02 |

**Provision:** Creating a project auto-loads the pack. Project home → **Load SPDC sheets** (`POST /api/projects/:id/provision-sheets`) is idempotent and skips layers that already have rows. Site employees can load sheets.

**Add lines:** Cost BOQ/MB/BBS, QAP, Cube, Quality site observation/instruction, Safety records, Progress activity, hindrance, milestones, risk, legal.

**Daily loop:** Update Cost achieved/MB → Quality QI/NCR/cube → Safety toolbox/obs → Progress weekly actual / hindrance → DPR Maker (qty today suggested from weekly actual ÷ 6).

## When user sends system-design prompt

Capture: entities, events, retention, offline site, SSO. Update this file; keep project isolation + drawing gate unchanged unless explicitly redesigned.
