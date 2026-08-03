# Sheet → dashboard map (client templates)

Every shared Excel pack becomes an **in-app dashboard or tool**. Files under `templates/` and project root are reference templates for import / pilot seed.

| # | Shared sheet | Portal module | Portal tool / dashboard |
|---|--------------|---------------|-------------------------|
| 1 | Approval & GFC Drawing Log | Drawings | GFC register |
| 2 | Communication Matrix_BPCL | Comms | Matrix · Meetings · MoM |
| 3 | Quality Assurance Plan Week 50 | Quality | **QAP** (upload / update / view) |
| 4 | NCR 01 | Quality | QI / NCR dashboard |
| 5 | Safety NCR | Safety | Safety dashboard |
| 6 | Progress Overview | Progress | Overview |
| 7 | Planned Vs. Actual Dashboard | Progress | Planned vs Actual |
| 8 | Monthly Progress Dashboard | Progress | Monthly progress |
| 9 | Milestone tracking | Progress | Milestones |
| 10 | Hindrance Register Dashboard | Progress | Hindrance |
| 11 | Cashflow - Dashboard | Cost | Cashflow |
| 12 | Payment Summary (VIATRIX etc.) | **Finance** | Invoice / RA / COP tracking |
| 13 | DPR-Sharnam PMC | Reports | DPR pack |
| 14 | WPR File | Reports | WPR pack |
| 15 | SPDC Cube Register | Quality | Checklist / cube register (QI library) |
| 16 | Final Index | Master / DMS | Document index |
| 17 | **MS Project** file / export | Progress | **S-curve** + **MS Project progress** (client civil) |
| 18 | **Project summary schedule** (client shares) | Progress | Summary schedule tool + PDF viewer |
| 19 | **Procurement plan** | Progress | Procurement plan + PDF viewer |
| 20 | Custom meeting sheet templates | **Sheet Maker** / Comms | Meeting sheet templates |
| 21 | Generated Agenda / MoM / packs | Comms / Reports | Shown on **client civil** side + PDF view |
| 22 | **SITE_AUDIT_Pack.xlsx** | Site Audit | Dashboard · Plan · DC Interview · Site Walk · Folder Sample · Findings |
| 23 | **MASTER_KPI_DASHBOARD.xlsx** | KPI / KRA | ISO rollup · subjects · role KRA · trends |
| 24 | Comparative Statement R2 | CRM | Comparative statement (multi-vendor BOQ) |
| 25 | SPDC PMC Proposal DOCX | CRM | Quotation template |

## Rules

1. Do not leave critical registers as “Excel only” after pilot.  
2. Pilot import uses **one project** only.  
3. Quality / Safety checklist Excel uploads create **selectable** templates in Checklist master.  
4. QAP is a first-class Quality tool and must stay updateable.  
5. Client civil side must see S-curve, summary schedule, MS Project progress, procurement, and generated documents.  
6. PDF uploads must be **viewable** in-app (minimum three civil packs: summary schedule, procurement plan, generated civil/meeting PDF).  
7. Audit pack and KPI pack become portal tools (see `modules/MODULE_AUDIT_KPI.md`).  
8. Comparative / quotation templates feed CRM (see `modules/MODULE_CRM.md`).
