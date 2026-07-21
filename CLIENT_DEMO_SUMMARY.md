# Sharnam Portal — Client demo summary

**Live:** https://sharnam-portal.onrender.com  
**Demo password:** `Demo@1234`  
**Logins:** `office@` · `site@` · `vendor@` · `client@` · `admin@` · `employee@sharnam.demo`

---

## What you are seeing

A **PMC project workspace** for Sharnam (शरणम्): select a project in the top bar, then work in modules (drawings, documents, communications, DPR/WPR, cost, safety, RFIs, directory). Five designed UI styles (1–5) are live on the same product — pick one at `/options` or with the UI buttons in the nav.

| UI | Name | Feel |
|----|------|------|
| 1 | Site Amber | Warm soft (default brand) |
| 2 | Graphite Procore | Dense, sharp field tool |
| 3 | Forest Field | Green, roomy site desk |
| 4 | Blueprint Desk | Technical cyan |
| 5 | Night Shift | Dark + orange |

No stock-photo packs — chrome and layout only.

---

## How work is organised

1. **Top nav — Project first**  
   Dropdown selects the active project. Overview / Comms / DPR-WPR follow that selection. Right **Actions** panel jumps to upload drawing, checklist assign, docs, COP, safety, directory.

2. **CRM — Projects + client card**  
   Create or convert a lead into a project and fill **client information**: organisation, contact, email, phone, address, GST, design consultant, main contractor, location. Edit later from CRM → Projects → Edit client card.

3. **HRM — Directory pool**  
   Company employees and vendor companies live here. Assign them **into a project directory**. Inside the project, **Directory** shows the live roster (people + vendors) used for communications matrix and meetings.

4. **Documents (OneDrive contract)**  
   Browse project folders like a drive (Drawings, DPR, WPR, QAP, Communication-Matrix, Safety, Cost-Bills…). **Opening a folder syncs that path** (mock today). Uploads go into the current folder. Real Microsoft Graph uses the same browse + sync-on-open contract (see `CLIENT_MICROSOFT_REQUEST.md`).

5. **Communications (from your matrix template)**  
   Flow: **Matrix → Agenda → MoM → Follow-up**. Matrix is organised by org roles (Client / PMC / Consultant / Contractor). Agenda before MoM; actions carry into follow-up meetings.

6. **DPR / WPR / QAP (from your Excel packs)**  
   Templates inform registers and weekly packs:
   - **DPR** — daily progress, manpower/equipment, hindrance, concern, photos  
   - **WPR** — drawing registers, milestones, cashflow, NCR, safety, HIRA, etc.  
   - **QAP** — weekly QC activity matrix (Contractor / PMC / Client)  
   UI screens map to these packs; full sheet-for-sheet parity continues as we wire exports.

7. **Cost / COP**  
   Vendor bill entries and certify flow on Cost → COP / Bills.

8. **RFIs**  
   Create with optional **checklist attach**; detail links back to the catalog.

---

## Portals

| Portal | Typical use |
|--------|-------------|
| Office | CRM, HRM, full project tools, approvals |
| Site | Daily log, checklists, safety, drawings, DPR |
| Vendor | Assigned packages, bills, RFIs, docs |
| Client | Visibility on progress, meetings, documents |

---

## Templates absorbed (repo `templates/`)

| File | Role in system |
|------|----------------|
| Communication Matrix (TECHNICAL / COMMERCIAL) | Comms matrix + directory orgs |
| DPR — Arvind / Sharnam PMC | Daily progress + hindrance registers |
| WPR File (multi-sheet) | Weekly pack / drawing & quality registers |
| Quality Assurance Plan Week 50 | Weekly QAP checker matrix |

---

## What connects later (not blocking demo)

- Microsoft OneDrive / Graph for real file storage (UI already browses + sync-on-open)  
- Outbound email / Teams via Graph  
- Excel import/export for DPR/WPR/QAP sheet layouts  

---

## Suggested walkthrough (10 minutes)

1. Open `/options` → choose UI **1** or **2** → Office login.  
2. Top bar: pick a project → Overview.  
3. CRM: show client card fields on a project.  
4. HRM: assign an employee + vendor → open project **Directory**.  
5. Documents: open `Documents/DPR` (watch sync) → upload optional.  
6. Comms: Matrix → generate Agenda → MoM → Follow-up.  
7. Cost → COP / Bills; RFIs → attach checklist.  
8. Flip UI 1–5 without leaving the product.
