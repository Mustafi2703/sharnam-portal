# Sharnam Portal — Client demo summary

**Live:** https://sharnam-portal.onrender.com  
**UI (locked):** Graphite Procore — same look as former `/ui/2`  
**Demo password:** `Demo@1234`  
**Logins:** `office@` · `site@` · `vendor@` · `client@` · `admin@` · `employee@sharnam.demo`

---

## What you are seeing

A **PMC project workspace** for Sharnam (शरणम्): select a project in the top bar, then work in **modules → tools** (Procore shape). Product IA: [PRODUCT_IA.md](PRODUCT_IA.md).

| Module | Tools |
|--------|--------|
| Home | Overview, Directory, Vendors, DMS |
| Drawings | GFC, DMS, Coordination, Submittals, checklist-fill RFI |
| Quality | Inspections, Site checklists, Checklist master / QAP |
| Safety | Safety register + RFI |
| Progress | Milestones, Planned vs Actual, Hindrance, Risk |
| Field | Day log, Photos, Field RFIs |
| Comms | Matrix · Meetings · MoM, PMC RFI, Email |
| Cost | Measurement, MB, BBS, Cashflow, Budget, COP/Bills |
| Reports | DPR / WPR HTML packs (Print → PDF) |

Office **Master** can toggle which modules appear per project.

---

## How work is organised

1. **Top nav — Project first** — dropdown selects active project.  
2. **CRM** — leads → project + client card.  
3. **HRM** — employees/vendors → project Directory.  
4. **Documents** — mock OneDrive folders; real Graph later ([docs/M365_SETUP.md](docs/M365_SETUP.md)).  
5. **Comms** — Matrix → Agenda → MoM → Follow-up.  
6. **DPR / WPR** — generated from live day log, drawings, RFIs, safety, progress, cashflow.  
7. **Cost** — monitoring (GFC qty), MB/BBS packages from Budget workbook, cashflow, COP.

---

## Templates absorbed

GFC Drawing Log · Cashflow Dashboard · SPDC Budget (MB + BBS) · DPR Arvind pack · Hindrance · Milestone · Progress Overview · QAP · Cube · Safety NCR · Drawing check master · Final Index · Payment Summary.

---

## Suggested walkthrough (10 minutes)

1. Login `office@sharnam.demo` / `Demo@1234`.  
2. Master → pick project → toggle modules.  
3. Open project → Drawings (GFC) → Progress (hindrance/milestones) → Cost (MB / cashflow) → Reports (download DPR/WPR).  
4. Site login: Field day log → feeds DPR.
