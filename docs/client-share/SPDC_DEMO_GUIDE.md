# Sharnam Portal — SPDC UAT Demo Guide

**Project:** SPDC-UAT-LIVE · Dormitory & External Works  
**Password (demo users):** `Demo@1234`  
**Prepared for:** Client walkthrough & training (non-technical)

---

## 1. What this portal does (one slide)

The portal replaces scattered Excel folders with **one project workspace** where site, office, finance, and contractors each see only what they need — drawings, daily progress, weekly reports, cost sheets, RA bills, meetings, and quality/safety forms — with **SharePoint filing** and **email notifications** built in.

---

## 2. Demo logins

| Role | Email | Use in demo |
|------|-------|-------------|
| SPDC Office | `operations@spdc.in` or `office@sharnam.demo` | Full control — cost, finance, comms, close NCR |
| Site engineer | `site@sharnam.demo` | DPR, safety NCR, site checklists |
| Contractor | `nkinfra@sharnam.demo` | RA bill submission, bid BOQs, NCR/CAR response |
| Structural consultant | `struct@sharnam.demo` | Stakeholder desk — RFI, coordination (`/login/stakeholder`) |
| MEP consultant | `mep@sharnam.demo` | Stakeholder desk |
| PMC partner | `pmc@sharnam.demo` | Stakeholder desk |
| Project consultant | `ak@consultant.demo` | Stakeholder desk |
| Client viewer | `client@sharnam.demo` | Read-only dashboards |

---

## 3. Module walkthrough (45–60 min)

### A. Cost & cashflow (10 min)
1. Open **Cost** → click **Load SPDC template** (loads Budget, Monitoring, MB, BBS, cement/steel rates, cashflow dashboard).
2. **Cashflow** tab → switch **Chart / Forecast / Tracking**.
3. **Rates** tab → show **Cement** lines (UltraTech purchases from workbook).
4. Click **Reconcile PvA + COP** after finance demo.
5. **BBS** tab → import Excel only; shapes live in **BBS master** and per bar-mark row (no bulk shape box).

### B. Finance — RA & COP (8 min)
1. **Finance → RA Bill Tracker** — three slots: Submission / Corrected / Certified.
2. Login as **nkinfra@** → upload **Submission** on RA-06.
3. As office → upload **Certified** on RA-05 → **Create COP** unlocks only after Certified.

### C. Progress & DPR (8 min)
1. **DPR Maker** — daily qty, materials, pie charts.
2. **Progress → Planned vs Actual** — RA-month cashflow snapshot (separate from Cost S-curve).

### D. WPR (5 min)
1. **WPR Maker** — Load → Regenerate → Save → **Publish** (SharePoint link).
2. Download **Client XLSX** and **PPTX** for Arvind-format pack.

### E. Comms (5 min)
1. **Comms → Matrix** (BPCL technical + commercial).
2. **Agenda → MoM → Follow-up** — add action, **Send follow-up** email.

### F. Quality NCR / CAR & Safety NCR (8 min)
1. Open an **Open NCR** from Quality or Safety register.
2. **Save form** → contractor receives email with form link.
3. Contractor fills corrective action → **office receives review email**.
4. Office **Send follow-up** → contractor reminder (Quality CAR/NCR or Safety NCR).
5. **Close** when complete → branded XLSX/HTML to SharePoint.

### G. CRM vendor bids (5 min)
1. **CRM → Vendor bids** (`/crm/vendor-bids`) as contractor login.
2. Show discipline BOQ list, uploaded files, SharePoint links.

### H. HRMS (5 min)
1. **HRMS → Leave** — balances, pending/approved requests.
2. **Documents** — handbook & appointment letter samples.
3. **Holidays** calendar seeded for Gujarat/India.

---

## 4. Data refresh before demo

On the server:

```bash
npm run db:push
npm run db:seed
npx tsx seed/uatLiveProject.ts
npm run hostinger:build
# restart API + web
```

This loads: 7-day DPR, WPR #50, finance RA/COP chain, cost workbooks, HRMS leave/holidays, vendor BOQs.

---

## 5. Training tips for end users

- **One project at a time** — pick SPDC-UAT-LIVE from the project switcher.
- **Registers scroll inside the page** — use Download XLSX for full sheets.
- **Email is queued** — check project notification list or outbox if SMTP is in test mode.
- **PvA vs Cost cashflow** — PvA is progress snapshot; Cost chart is budget S-curve; COP overlays actual ₹.

---

## 6. Support contacts during UAT

- Portal issues: Twinoxis / dev team  
- SPDC operations: `operations@spdc.in`, `nirav@spdc.in`

**Full client presentation (digital transformation, all modules, DMS links, CRM → setup flow):**  
[SPDC_DIGITAL_TRANSFORMATION_PRESENTATION.md](./SPDC_DIGITAL_TRANSFORMATION_PRESENTATION.md)

**Tick-list for every module workflow (NCR, RFI, HRMS, stakeholders, bids):**  
[SPDC_DEMO_WORKFLOW_CHECKLIST.md](./SPDC_DEMO_WORKFLOW_CHECKLIST.md)

---

*Document version: Sep 2026 · aligns with commits through demo prep sprint.*
