# SPDC — Front-end demo runbook (step-by-step, every tool with data)

**UAT window:** **8–19 September 2026** — use this runbook for **demo rehearsal** before or during Week 1.  
**Day-by-day UAT calendar:** [SPDC_TWO_WEEK_UAT_PLAN.md](./SPDC_TWO_WEEK_UAT_PLAN.md)  
**Duration:** ~2.5–3 hours (3 sessions) or ~90 min compressed  
**Projects:** `SPDC-DEMO-01` (CRM bids) · `SPDC-UAT-LIVE` (full UAT pack)  
**Password (all demo logins):** `Demo@1234`  
**Portal:** https://portal.spdc.in  

**Before you start:**

```bash
git pull origin main
npm run db:push && npm run db:seed
npx tsx seed/uatLiveProject.ts   # SPDC-UAT-LIVE full pack
npm run hostinger:build
# restart API + web
```

**Companion docs:** [SPDC_MODULE_DELIVERY_STATUS.md](./SPDC_MODULE_DELIVERY_STATUS.md) · [SPDC_DEMO_WORKFLOW_CHECKLIST.md](./SPDC_DEMO_WORKFLOW_CHECKLIST.md)

---

## Session map

| Session | Time | Login | Show |
|---------|------|-------|------|
| **1 — Setup & design** | 45 min | `office@sharnam.demo` | Master, directory, DMS, drawings, RFIs |
| **2 — Site & quality** | 60 min | `site@` + `vendor@` | Checklists, NCR, safety, DPR, inspection |
| **3 — Office & commercial** | 45 min | `office@` + `client@` | WPR, progress, cost, CRM bids, client view |

---

## Session 1 — Foundation (Office · 45 min)

### 1.1 Login & project hub (5 min)

| Step | Path | Data to show |
|------|------|--------------|
| 1 | `/login/office` → `office@sharnam.demo` | Office portal skin |
| 2 | Select **SPDC-UAT-LIVE** (or SPDC-DEMO-01) | Module hub — **12 workspaces**, 128 sub-tools |
| 3 | Home → Overview | KPI tiles, recent activity |

### 1.2 Master & directory (10 min)

| Step | Path | Data to show |
|------|------|--------------|
| 4 | Project → **Directory** → PMC tab | Office staff assigned |
| 5 | Directory → Site / Client / Contractor tabs | Four user kinds |
| 6 | **Sign-off register** (below DMS card) | Draw/upload signature PNG → DMS `01.03…/Directory_Signatures` |
| 7 | Link to **DMS** | Signatures appear in ISO tree |
| 8 | Master → Projects → Setup | Module toggles, work packages |

**Talking point:** Directory signatures auto-fill branded checklist Excel when fill-specific sign is missing.

### 1.3 DMS — ISO document library (8 min)

| Step | Path | Data to show |
|------|------|--------------|
| 9 | Project → **Documents (DMS)** | Full ISO Rev 02 tree (80+ folders) |
| 10 | Open `08_QUALITY…` or `07.02_Daily_Site_Records` | PDF preview in-app |
| 11 | **Open in SharePoint ↗** | Same file on SPDC tenant |
| 12 | Upload test PDF to HSE folder | Appears in list + SharePoint |

### 1.4 Drawings & design (12 min)

| Step | Path | Data to show |
|------|------|--------------|
| 13 | Drawings → **GFC register** | Published revisions R3/R4 |
| 14 | Drawing files | PDF/DWG in SharePoint `04.02` |
| 15 | Design coordination | Open issue → assignee → **Send follow-up (1/5)** |
| 16 | RFIs → register | **RFI-UAT-2026-142** (Open) |
| 17 | Download RFI branded **XLSX** + print HTML | Logo + sign blocks |

### 1.5 CRM setup snapshot (10 min) — use **SPDC-DEMO-01**

| Step | Path | Data to show |
|------|------|--------------|
| 18 | Switch project → **SPDC-DEMO-01** | |
| 19 | CRM → Comparative bids | Two bidders: **Bhavna** + **Nikhra**, L1/L2 |
| 20 | SharePoint panel | `05.05…/Vendor_BOQs/{Vendor}/{Disc}/R2-*.xlsx` + `05.06…/Comparative-Statement-R2-live.xlsx` |

---

## Session 2 — Site, quality & safety (60 min)

### 2.1 Site login & field tools (10 min)

| Step | Login | Path | Data |
|------|-------|------|------|
| 21 | `site@sharnam.demo` | Site portal → SPDC-UAT-LIVE | Restricted workspace (no cost/finance edit) |
| 22 | Safety → dashboard | Seeded HSE stats |
| 23 | HRMS → Attendance punch | Selfie + GPS demo (if geofence enabled) |

### 2.2 Checklists & inspection (15 min)

| Step | Path | Data to show |
|------|------|--------------|
| 24 | Checklists → Quality inspection | Open assigned QI template |
| 25 | Fill lines + **3 photos** + signature pad → Submit | Branded XLSX sync to DMS |
| 26 | Inspection register → Quality F-01 | IR row → Excel export |
| 27 | Safety → SPDC HSE F-01 IR | Safety inspection request form |
| 28 | Checklists → Safety | PPE / walkthrough fill |

### 2.3 NCR / CAR with contractor loop (15 min)

| Step | Login | Path | Data |
|------|-------|------|------|
| 29 | Office | Quality → NCR/CAR | **NCR-Q-UAT-018**, **CAR-UAT-007** (Open) |
| 30 | Office | Open NCR form → Save | Email to contractor |
| 31 | `vendor@` or contractor login | Open form link → corrective action → Save | Office notify |
| 32 | Office | Send follow-up → Close | XLSX/HTML → DMS quality folder |
| 33 | Safety | **SNCR-UAT-003** | Same email pattern |

### 2.4 DPR maker — daily discipline pack (20 min)

| Step | Path | Data to show |
|------|------|--------------|
| 34 | Reports → **DPR Maker** | Pick date (seeded week) + discipline e.g. Civil |
| 35 | Scroll full page | Manpower → Equipment → Activities (no white gap) |
| 36 | Show auto blocks | HSE + quality pulled from checklists/NCR above |
| 37 | Save draft → **Publish** | XLSX + SharePoint `07.02…/{discipline}` |
| 38 | Recent panel | Last published days |
| 39 | Download PDF (HTML print) | Branded daily pack |

**Data-flow callout:** DPR reads Quality NCR count, Safety obs, Cube register, Cost qty hints — same rows feed WPR weekly slides.

---

## Session 3 — Office reports, progress & client (45 min)

### 3.1 WPR maker — weekly hub (15 min)

| Step | Path | Data to show |
|------|------|--------------|
| 40 | Reports → **WPR Maker** | Week ending (seeded · report #50) |
| 41 | **Load → Regenerate** | **24 sections** populated from DPR + quality + safety + progress |
| 42 | Scroll sections | Quality, HSE, progress, manpower, hindrance, photos |
| 43 | Upload section photo / signature | DMS `10.01…/WPR/signatures` |
| 44 | Save → **Publish** | SharePoint MIS folder |
| 45 | **Client XLSX** + **PPTX** export | Arvind-format branded pack (ExcelJS) |

**WPR data-flow (say aloud):**

```text
MS Project XML → Progress PvA → S-curve
Cost BOQ/MB/BBS → DPR qty blocks → WPR progress slides
QI + Safety checklists → DPR HSE/quality → WPR §Quality / §Safety
NCR/CAR open list → WPR quality table
QAP sign-off → WPR compliance rows
Cube register → WPR test agency / cast summary
```

### 3.2 Progress & cost (12 min)

| Step | Path | Data |
|------|------|------|
| 46 | Progress → Overview / **Planned vs Actual** | Filter pills, sync from cost |
| 47 | S-curve tab | Milestone chart from seed XML |
| 48 | Cost → monitoring + **Cashflow** (3 tabs) | BOQ, MB, BBS from SPDC template |
| 49 | Finance → RA-05 **Certified** → COP unlock | RA/COP chain |

### 3.3 Audit, comms, closure (8 min)

| Step | Path | Data |
|------|------|------|
| 50 | Audit & KPI → dashboard | RAG rollup |
| 51 | Comms → Matrix (BPCL import) → MoM → Send follow-up | Email to action owners |
| 52 | Closure → Snaglist | Open/closed rows |

### 3.4 Client & vendor portals (10 min)

| Step | Login | Show |
|------|-------|------|
| 53 | `client@sharnam.demo` | Read-only progress, published WPR, GFC — **cannot upload** |
| 54 | `vendor@sharnam.demo` on SPDC-DEMO-01 | Vendor bids only — BOQ edit, **no register edit** |
| 55 | `nkinra@sharnam.demo` | Second bidder — comparative updates live |

---

## Compressed 90-minute path

If time is short, run these **must-show** steps only:

`1 → 9 → 13 → 16 → 19 → 24 → 29 → 34 → 40 → 46 → 53 → 54`

---

## Seeded data quick reference

| Record | Project | Where |
|--------|---------|-------|
| RFI-UAT-2026-142 | UAT-LIVE | Drawings → RFIs |
| NCR-Q-UAT-018, CAR-UAT-007 | UAT-LIVE | Quality → NCR/CAR |
| SNCR-UAT-003 | UAT-LIVE | Safety |
| DPR 7-day week | UAT-LIVE | DPR Maker dates Aug 2026 |
| WPR #50 | UAT-LIVE | WPR Maker |
| R2 bid Bhavna + Nikhra | DEMO-01 | CRM comparative |
| RA-05/06 → COP | UAT-LIVE | Finance |

---

## If something breaks during demo

| Issue | Fix |
|-------|-----|
| Empty registers | Re-run `npx tsx seed/uatLiveProject.ts` |
| SharePoint link 404 | Check `SHAREPOINT_*` env; mock path still works locally |
| WPR sections empty | Load → Regenerate after DPR seed |
| Vendor sees registers | Confirm `vendor` workspace restriction deployed |
| Signatures missing in Excel | Upload in Directory sign-off register first |

---

*Rev 02 · September 2026 · Built since 15 July 2026*
