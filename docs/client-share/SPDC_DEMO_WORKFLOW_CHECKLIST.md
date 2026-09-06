# SPDC UAT — Full Demo Workflow Checklist

**Project:** SPDC-UAT-LIVE  
**Password (all demo logins):** `Demo@1234`  
**Use with:** [SPDC_DEMO_GUIDE.md](./SPDC_DEMO_GUIDE.md) · [SPDC_DIGITAL_TRANSFORMATION_PRESENTATION.md](./SPDC_DIGITAL_TRANSFORMATION_PRESENTATION.md)

Run on server before demo:

```bash
git pull origin main
npm run db:push && npm run db:seed
npx tsx seed/uatLiveProject.ts
npm run hostinger:build
# restart API + web
```

---

## 1. Demo logins (who plays which role)

| Role | Email | Portal URL | Demo use |
|------|-------|------------|----------|
| **SPDC Office** | `operations@spdc.in` or `office@sharnam.demo` | `/login/office` | Full walkthrough, close NCR, publish WPR |
| **Site engineer** | `site@sharnam.demo` | `/login/site` | DPR, safety NCR, checklists |
| **Contractor (Bhavna)** | `vendor@sharnam.demo` | `/login/vendor` | BOQ uploads, RFI/NCR responses |
| **Contractor (Nikhra)** | `nkinra@sharnam.demo` | `/login/vendor` | Second bidder · comparative demo |
| **Client** | `client@sharnam.demo` | `/login/client` | Read-only progress & reports |
| **Structural consultant** | `struct@sharnam.demo` | `/login/stakeholder` | RFI response, design coordination |
| **MEP consultant** | `mep@sharnam.demo` | `/login/stakeholder` | Coordination issues, meetings |
| **PMC partner** | `pmc@sharnam.demo` | `/login/stakeholder` | Stakeholder desk, MoM |
| **Project consultant** | `ak@consultant.demo` | `/login/stakeholder` | Third-party reviewer |

---

## 2. Setup journey (show once at start)

| Step | Where | Action | Expected result |
|------|-------|--------|-----------------|
| 1 | **CRM → Leads** | Show converted lead | Delivery project exists |
| 2 | **Master → Projects → Setup** | Assign people + pick **contractor from global directory** | Directory populated |
| 3 | **CRM → Directory → Stakeholders** | Show consultant types (Structural, MEP, …) | `Create portal login` → `/login/stakeholder` |
| 4 | **Project → Documents (DMS)** | Open ISO folder tree | SharePoint-linked folders |
| 5 | **Quality → Quality files** (or any module **files** tool) | Portal records + SharePoint browse | RFIs/NCR open in portal; PDFs open in SharePoint |
| 6 | **CRM → Vendor bids** | Show R2 BOQ slots | One XLSX per vendor × discipline in SharePoint 05.05 |
| 7 | **CRM → Comparative bids** | Open SPDC-DEMO-01 package | Master comparative in 05.06 · L1/L2 totals |

---

## 3. Module workflows — tick each during demo

### A. Documents (DMS)

| # | Step | Who | Files / output |
|---|------|-----|----------------|
| A1 | Browse ISO folders | Office | PDF preview in-app |
| A2 | Open SharePoint link ↗ | Office | Same file in SharePoint |
| A3 | Upload test PDF to HSE folder | Site/Office | Appears in DMS list |

### B. Drawings

| # | Step | Who | Output |
|---|------|-----|--------|
| B1 | Drawing register → published GFC | Office | Revision R3/R4 visible |
| B2 | Design coordination issue | Office | Markup + assignee email |
| B3 | Send follow-up (1/5) | Office | Email to assignee |
| B4 | Open **RFI-UAT-2026-142** | Office | Download XLSX + HTML/PDF |

### C. Quality — NCR / CAR

| # | Step | Who | Email / DMS |
|---|------|-----|-------------|
| C1 | Open **NCR-Q-UAT-018** form | Office | — |
| C2 | **Save form** | Office | Contractor (`nkinfra@`) gets email + form link |
| C3 | Login as **nkinfra@** → open form → fill corrective action → Save | Contractor | Office gets review email |
| C4 | **Send follow-up** | Office | Contractor reminder |
| C5 | Repeat for **CAR-UAT-007** | Office | Same flow |
| C6 | **Close** when done | Office | XLSX/HTML → DMS quality folder |

### D. Safety NCR

| # | Step | Who | Output |
|---|------|-----|--------|
| D1 | Open **SNCR-UAT-003** | Site/Office | Form with contractor NK Infra |
| D2 | Save + follow-up | Office | Same email pattern as quality |
| D3 | Close | Office | Export to DMS |

### E. Cost & Finance

| # | Step | Who | Output |
|---|------|-----|--------|
| E1 | Cost → Load SPDC template | Office | BOQ, MB, BBS, cashflow |
| E2 | Cashflow Chart / Forecast / Tracking | Office | Three tabs scroll correctly |
| E3 | BBS → per-mark shapes (no bulk upload) | Office | BBS master + row shapes |
| E4 | Finance → RA-05 **Certified** | Office | COP unlocks |
| E5 | **nkinfra@** → RA-06 **Submission** upload | Contractor | Stage workbook in DMS |
| E6 | Create COP | Office | Viatrix workbook → DMS |

### F. Progress & DPR

| # | Step | Who | Output |
|---|------|-----|--------|
| F1 | Progress → Overview / Planned vs Actual | Office | Filter pills + sync from Cost; no dev verify panel |
| F2 | Planned vs Actual → manpower / cashflow / activity tabs | Office | Same Excel pack columns |
| F3 | DPR Maker → pick date + discipline | Site | Full page scroll — manpower table flows into Equipment (no white gap) |
| F4 | Save draft → Publish | Site | XLSX + SharePoint |
| F5 | Download PDF (HTML print) | Site | Branded PDF pack |

### G. WPR

| # | Step | Who | Output |
|---|------|-----|--------|
| G1 | WPR Maker → Load → Regenerate | Office | 24 sections populated |
| G2 | Save → **Publish** | Office | SharePoint URL |
| G3 | Client XLSX + PPTX | Office | Arvind-format pack |

### H. Audit & KPI

| # | Step | Who | Output |
|---|------|-----|--------|
| H1 | Audit dashboard | Office | RAG rollup + findings count |
| H2 | Findings → add NC / observation | Office | CAPA row |
| H3 | KPI dashboard + Subject data | Office | 127-subject health |
| H4 | Download workbook sheet (XLSX) | Office | Branded audit pack |

### I. Comms

| # | Step | Who | Output |
|---|------|-----|--------|
| I1 | Matrix (BPCL import) | Office | Parties listed |
| I2 | Meeting → Agenda items | Office | — |
| I3 | MoM → **Send follow-up** | Office | Email to action owners |
| I4 | Download MoM XLSX | Office | Branded workbook → DMS |

### J. HRMS

| # | Step | Who | Output |
|---|------|-----|--------|
| J1 | Leave balances | Employee/Site | CL/SL/EL shown |
| J2 | Pending + approved requests | Office | Demo requests visible |
| J3 | Holidays calendar | All | India + Gujarat dates |
| J4 | Handbook + appointment letter | Office | HRMS Documents tab |

### K. CRM & Vendor bids

| # | Step | Who | Output |
|---|------|-----|--------|
| K1 | Vendor bids list | **vendor@** (Bhavna) or **nkinra@** (Nikhra) | Pre-seeded BOQs · SharePoint 05.05/{vendor}/{discipline} |
| K2 | View / edit BOQ online | Contractor | Saves sync master to 05.06 |
| K3 | Comparative bid (office) | Office | Two-bidder matrix · SharePoint folder tree · award L1 |

### L. Closure (optional)

| # | Step | Who | Output |
|---|------|-----|--------|
| L1 | Snaglist register | Office | Open/closed rows |
| L2 | Lessons learnt | Office | Handover prep |

### M. Module files (SharePoint + portal)

Each major module has a **{Module} files** tool (same pattern as **Drawings → Drawing files**):

| Module | Tool path | SharePoint ISO root | Portal panel shows |
|--------|-----------|---------------------|-------------------|
| Quality | Quality files | 08 Quality HSE | QI RFIs, NCR/CAR, links to forms |
| Safety | Safety files | 08.07 HSE | Safety RFIs, safety NCR |
| Drawings | Drawing files / library | 04.02 GFC | Drawing RFIs, PDF/DWG preview |
| Progress | Progress files | 07.02 Daily records | Published DPR folders |
| Reports | Reports files | 10.01 MIS | WPR packs |
| Cost / Finance | Cost / Finance files | 09 Commercial | BOQ, RA workbooks |
| Comms | Comms files | 03.08 Meetings | MoM exports |
| Audit & KPI | Audit files | 10.18 Audit programme | Audit workbook exports |
| Inspection | Inspection files | 08.02 Pour cards | IR / activity RFIs |

**Demo tip:** Open **Quality files** → show portal NCR row → **Open** form → **XLSX** download → browse SharePoint subfolder for the same export after close/publish.

---

## 4. Seeded records reference (SPDC-UAT-LIVE)

After `npx tsx seed/uatLiveProject.ts`:

| Area | Seeded items |
|------|----------------|
| **DPR** | 7 days of discipline snapshots |
| **WPR** | Week ending current · report #50 |
| **Finance** | PO → RA-05/06 → COP chain · nkinfra login |
| **Quality** | NCR-Q-UAT-018, CAR-UAT-007 (Open, contractor email set) |
| **Safety** | SNCR-UAT-003 (Open) |
| **RFI** | RFI-UAT-2026-142 (Open) |
| **Stakeholders** | AK Consultant, Struct, MEP, PMC partner on project |
| **HRMS** | Leave types, balances, 3 requests, holidays, handbook |
| **CRM** | R2 bid package + BOQ slots |
| **Comms** | BPCL matrix sample |
| **Cost** | SPDC budget workbook sync |

---

## 5. What should log / notify (verify during demo)

| Event | Email to | Also filed |
|-------|----------|------------|
| NCR/CAR **Save** (Open) | Contractor | — |
| Contractor **action on form** | Office | — |
| NCR/CAR **Follow-up** | Contractor + project list | — |
| NCR/CAR **Close** | Project notify list | XLSX/HTML → DMS |
| Safety NCR **Follow-up** | Contractor | — |
| RFI **Close** | Matrix parties | XLSX form → DMS Closed folder |
| MoM **Send follow-up** | Action owners | — |
| WPR **Publish** | Optional notify | SharePoint reports folder |
| RA **Certified** | — | Workbook in DMS commercial tree |

*If SMTP is in test mode, check project notification queue or outbox in Comms → Email.*

---

## 6. Common demo fixes

| Issue | Fix |
|-------|-----|
| Empty NCR list | Re-run `npx tsx seed/uatLiveProject.ts` |
| Contractor login fails | Confirm `nkinfra@sharnam.demo` / `Demo@1234` |
| No stakeholder desk | Use `/login/stakeholder` with `pmc@` or `struct@` |
| Page won't scroll (DPR/WPR/Progress) | Hard refresh after deploy |
| COP locked | Upload **Certified** on RA-05 first |

---

*Rev Sep 2026 · seed tag `uat-walkthrough-seed`*
