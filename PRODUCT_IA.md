# Sharnam Portal — Product IA (locked)

**UI direction:** [Graphite Procore / Navy Desk](https://sharnam-portal.onrender.com/ui/2) only (`ui-2`).  
**Shape:** Procore-style project workspace — top **modules**, left **tools**.

## Office Master (after login)

Office / admin sees Master + can open any project and **enable/disable modules** per project. CRM + HRM feed project directory.

| Office tool | Purpose |
|-------------|---------|
| Master | Project create, packages (Civil / PEB / …), PMC roster, module toggles |
| CRM | Leads → projects + client card |
| HRM | Employee + vendor pool → assign into project Directory |
| Audit / Roles | Who did what; role matrix |

## Project modules → tools

| Module | Tools (from Excel + prompts) | Source sheets |
|--------|------------------------------|---------------|
| **Home** | Overview, Directory, Vendors, Documents (DMS) | Project master |
| **Drawings** | GFC register, Drawing checklist master, Coordination, Submittals, RFI (drawing checklist fill) | Approval & GFC Drawing Log, Drawing check master |
| **Quality** | QAP, Inspections, Cube register, Site checklists, NCR / observations, RFI (QI fill) | QAP Week 50, Cube Register, NCR, Final Index |
| **Safety** | Safety dashboard, NCR, Site instructions, RFI + checklist attach | Safety NCR, Safety Dashboard |
| **Progress** | Overview dashboard, Milestones, Planned vs Actual, Monthly progress, Hindrance, Risk | Progress Overview, Milestone, Planned Vs Actual, Monthly Progress, Hindrance |
| **Field** | Day log, Photos, Field RFIs | DPR day sheets |
| **Comms** | Matrix, Meetings / Agenda / MoM / Follow-up, PMC RFI, Email | Communication matrix videos |
| **Cost** | Budget WBS, Monitoring (GFC qty), Measurement books (MB), BBS, Cashflow, Rate diff, COP/Bills, BOQ | Cashflow Dashboard, SPDC Budget (MB + BBS), Payment Summary |
| **Reports** | DPR pack, WPR pack, printable dashboards | DPR Arvind pack, WPR registers |

## Gates & integrity

1. Project-scoped queries only  
2. Drawing publish gate before checklist / QI submit  
3. Upload via modal + revision log  
4. Client: view / raise concerns only  

## Microsoft 365

See [CLIENT_MICROSOFT_REQUEST.md](CLIENT_MICROSOFT_REQUEST.md) and [docs/M365_SETUP.md](docs/M365_SETUP.md).

## Deploy

See [DEPLOY_RENDER.md](DEPLOY_RENDER.md). Live: https://sharnam-portal.onrender.com  
Demo password: `Demo@1234`
