# Procore parity — research & setups

Sharnam adapts Procore tool shapes to PMC India workflows (GFC, Final Index, measurement sheet). Real Microsoft Graph stays deferred until client Azure creds arrive (`CLIENT_MICROSOFT_REQUEST.md`).

## Exact setups we mirror

| Procore concept | Sharnam equivalent | Setup notes |
|-----------------|-------------------|-------------|
| Project | `Project` + members/vendors | CRM convert or create |
| Drawings | GFC register + revisions R0–R5 | Publish unlocks QA |
| Drawing upload modal | Metadata + file + publish | All roles except client |
| Specs / Documents | DMS mock OneDrive | Folder tree per project |
| Checklists | Final Index (SiteExecution) | Dual-fill Yes/No/N.A. |
| Inspections | QualityInspection templates | Separate from Final Index |
| Observations / Incidents | Safety records | Types + assignee |
| RFIs | RFIs & Concerns | Ball-in-court; client can raise |
| Daily Log | Employee Day Log | Per calendar day |
| Photos | Project photos | Linkable later to RFI/checklist |
| Meetings | Meetings + MoM items | Schedule + carry-over |
| Coordination | Design coordination issues | Elevate → RFI later |
| Submittals | Submittal register | Status / ball-in-court |
| Budget / Financials | Cost: Budget, Monitoring, Cashflow | From Cashflow Dashboard.xlsx |
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

## When user sends system-design prompt

Capture: entities, events, retention, offline site, SSO. Update this file; keep project isolation + drawing gate unchanged unless explicitly redesigned.
