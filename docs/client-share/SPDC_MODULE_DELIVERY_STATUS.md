# Sharnam Portal — Module Delivery Status & Go-Live Readiness

**Prepared for:** SPDC / Sharnam PMC leadership & module owners  
**Product:** Sharnam Portal (शरणम्) — Project Management Consultants  
**Demo project:** SPDC-DEMO-01 · SPDC-UAT-LIVE  
**Portal (UAT):** https://portal.spdc.in  
**Document date:** September 2026 · Rev 03  
**Build window:** 15 July 2026 → present  
**UAT window:** **8–19 September 2026** (two weeks · all roles · daily → closure workflows)  
**Demo password:** `Demo@1234`

> **Presentable version:** Open [`SPDC_MODULE_DELIVERY_STATUS.html`](./SPDC_MODULE_DELIVERY_STATUS.html) in Chrome → **Print → Save as PDF** (include background graphics).  
> **Two-week test plan:** [`SPDC_TWO_WEEK_UAT_PLAN.md`](./SPDC_TWO_WEEK_UAT_PLAN.md) — day-by-day schedule, multi-user matrix, security gates.  
> **Live demo script:** [`SPDC_FE_DEMO_RUNBOOK.md`](./SPDC_FE_DEMO_RUNBOOK.md) — step-by-step FE walkthrough with seeded record IDs.

---

## 1. Executive summary

Sharnam Portal is a **single online workspace** per construction project: drawings, quality, safety, progress, cost, communications, reports, CRM bids, and HR — with **SharePoint (ISO 19650)** as the document store.

| Dimension | Status today |
|-----------|----------------|
| **Core modules built** | 18 module areas · **12 project workspaces** · **128 portal tools** (sub-tools) |
| **Build since 15 Jul 2026** | ~53 days · 500+ API endpoints · 74 Excel sheet mappings · 80+ ISO DMS folders |
| **SharePoint integration** | Live path on SPDC tenant; mock fallback for offline dev |
| **Role-based portals** | Office · Site · Contractor · Client · Stakeholder (+ CRM master) |
| **WPR / DPR data hub** | 7 DPR disciplines → **24 WPR sections** · branded ExcelJS export |
| **Client demo readiness** | Full 3-session runbook + UAT workbook available |
| **UAT schedule** | **Sep 8–19, 2026** — **~147 scenarios** · soft launch Day 1 · full handover Sep 19 |
| **Production go-live** | After two-week UAT — HP + NEG + M1–M16 + S1–S15 pass ([scenario bank](./SPDC_UAT_SCENARIO_BANK.md)) |

**Bottom line:** **Test thoroughly, use immediately.** Office and site can start daily work from **Mon Sep 8** on DMS, directory, and field modules while UAT runs. Formal **handover Fri Sep 19** after ~147 scenarios pass including multi-user, security, and daily→closure workflows.

---

## 1A. Delivery metrics — since 15 July 2026

| Category | Count | Notes |
|----------|------:|-------|
| **Portal tools (sub-tools)** | **128** | Hub cards + horizontal strip in `workspaces.ts` |
| **Project workspaces** | **12** | Drawings, DMS, Quality, Safety, Inspection, Progress, Comms, Audit, Cost, Finance, Reports, Closure |
| **Module delivery areas** | **18** | See §2 matrix (includes client + contractor portals) |
| **Login portals** | **6** | Office, Site, Vendor, Client, Stakeholder, Master |
| **Excel sheet mappings** | **74** | Tool ↔ client workbook tab (SPDC pack) |
| **API route handlers** | **500+** | Express routers across 20+ modules |
| **ISO DMS folders** | **80+** | Auto-created per project in SharePoint library |
| **WPR sections** | **24** | Weekly pack aligned to client WPR format |
| **DPR disciplines** | **7** | Civil, Structural, Architectural, MEP, HSE, QA/QC, General |
| **Branded export templates** | **40+** | RFI, NCR, CAR, checklists, IR F-01/F-02, DPR, WPR, MoM, audit |
| **Directory sign-off register** | **New** | Per-person PNG in DMS → auto in branded Excel |

### Milestone timeline (15 Jul → Sep 2026)

| Period | Delivered |
|--------|-----------|
| **Jul 15 – Jul 31** | Project hub, DMS ISO tree, GFC register, directory, auth & roles |
| **Aug 1 – Aug 15** | Quality/Safety modules, checklist fills, branded HTML/XLSX exports |
| **Aug 16 – Aug 31** | DPR maker, inspection register, NCR/CAR email loop, SharePoint file sync |
| **Sep 1 – Sep 6** | WPR ExcelJS pack, CRM two-bidder comparative, vendor portal lock-down, directory signatures, audit KPI restore, FE demo runbook |

---

## 2. Module delivery matrix

Legend: **Live** = built & demo-ready · **UAT** = needs client test sign-off · **Pilot** = works with seed; needs live Excel · **Planned** = roadmap

| # | Module | Delivery | What works today | UAT sign-off |
|---|--------|----------|------------------|:------------:|
| 1 | **Master & directory** | Live | Create project, enable modules, assign people, global vendor catalog, **sign-off register → DMS** | ☐ |
| 2 | **Drawings / GFC** | Live | Register, revisions R0–R5, drawing check gate, publish to SharePoint | ☐ |
| 3 | **Documents (DMS)** | Live | Full ISO folder tree, upload, PDF preview, SharePoint links | ☐ |
| 4 | **Quality** | Live | Dashboard, SOR log, QI, NCR/CAR, cube register, QAP, checklist fills | ☐ |
| 5 | **Safety & HSE** | Live | Dashboard, safety NCR, SPDC HSE F-01 IR, checklist fills, SharePoint HSE | ☐ |
| 6 | **Inspection register** | Live | Quality / Safety / Activity F-01 & F-02, Excel + PDF export | ☐ |
| 7 | **Comms & RFIs** | Live | Communication matrix, MoM, follow-up, classic RFI + checklist RFIs | ☐ |
| 8 | **Progress & PvA** | Live | Milestones, S-curve, planned vs actual (cashflow / manpower / qty) | ☐ |
| 9 | **Cost & cashflow** | Live · Pilot | BOQ monitoring, MB/BBS, three cashflow views; full client BOQ import pending | ☐ |
| 10 | **Finance (RA/COP)** | Live · Pilot | RA submission, COP certification shell; live commercial chain on UAT seed | ☐ |
| 11 | **Reports — DPR** | Live | Discipline DPR maker, SharePoint publish, recent list | ☐ |
| 12 | **Reports — WPR** | Live | Weekly pack, branded Excel export (ExcelJS), CAPEX from budget WBS | ☐ |
| 13 | **CRM & bids** | Live | Lead → quotation → **two-bidder R2 comparative**, vendor BOQ → SharePoint 05.05/05.06 | ☐ |
| 14 | **HRMS** | Live · Pilot | Attendance (selfie + GPS + IST), leave, payslip demo; geofence on master | ☐ |
| 15 | **Audit & KPI** | Live | Audit dashboard, findings register (restored for demo) | ☐ |
| 16 | **Closure** | Live | Snaglist, lessons learnt registers | ☐ |
| 17 | **Client portal** | Live | Read-only progress, reports, published GFC, raise concerns | ☐ |
| 18 | **Contractor portal** | Live | Bid BOQs, RFI/NCR responses, checklist fills — **no register editing** | ☐ |

---

## 3. Cross-cutting platform capabilities

| Capability | Status | Notes |
|------------|--------|-------|
| SharePoint `SharnamProjects` library | Live | Per-project ISO tree; module exports auto-file |
| Branded exports (logo, SPDC formats) | Live | RFI, NCR, checklists, DPR/WPR, MoM — **directory signatures in Excel** |
| Directory sign-off register | Live | PNG per person in DMS `01.03…/Directory_Signatures` |
| Audit trail (who / when / what) | Live | Uploads, punches, publishes, bid saves |
| Multi-portal authentication | Live | Separate login URLs per role |
| Communication matrix → email notify | Live · UAT | Verify SMTP on production |
| Excel register import (seed once) | Live | Project setup imports client packs |
| Mobile-friendly site flows | UAT | Test on actual site phones |

---

## 3A. Sheet & data-flow integration (DPR ↔ WPR ↔ modules)

The portal mirrors the **client Excel pack** — each tool maps to a workbook tab. **DPR** is the daily aggregation hub; **WPR** is the weekly rollup in the **client WPR format** (24 sections, ExcelJS + PPTX export).

### Data lineage — site to weekly report

```text
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│ Cost BOQ/MB │────▶│  DPR Maker   │────▶│   WPR Maker     │
│ BBS/Cashflow│     │  (7 disc.)   │     │  (24 sections)  │
└─────────────┘     └──────┬───────┘     └────────▲────────┘
                           │                        │
┌─────────────┐            │                        │
│ QI checklist│────────────┤                        │
│ NCR / CAR   │            │                        │
│ Cube / QAP  │────────────┤                        │
└─────────────┘            │                        │
┌─────────────┐            │                        │
│ Safety IR   │────────────┤                        │
│ HSE obs/TBT │────────────┘                        │
└─────────────┘                                     │
┌─────────────┐     ┌──────────────┐                │
│ MS Project  │────▶│ Progress PvA │────────────────┘
│ XML import  │     │ + S-curve    │
└─────────────┘     └──────────────┘
```

### Register → DPR → WPR mapping

| Source register | Portal path | DPR block | WPR section(s) |
|-----------------|-------------|-----------|----------------|
| QI checklist fill | Checklists → Quality | Quality / inspection count | Quality · compliance |
| Safety checklist | Checklists → Safety | HSE statistics | Safety slide |
| Safety NCR / obs | Safety module | HSE block | Safety · open items |
| Quality NCR / CAR | Quality → NCR/CAR | Open NCR count + issues | Quality list |
| Cube register | Quality → Cube | Cast/test today | Quality · test agency |
| QAP | Quality → QAP | Test agency names | WPR QAP sign-off rows |
| Manpower / equipment | Progress registers | DPR manpower table | WPR manpower |
| Hindrance register | Progress | DPR hindrance | WPR constraints |
| Cost BOQ qty | Cost monitoring | DPR activity qty | WPR progress % |
| Published DPR days | DPR Maker | — | WPR auto-regenerate source |

**Convention:** QAP = planned weekly quality sign-off · NCR = defect · CAR = corrective action · Safety observations stay in **Safety**, not Quality NCR.

**Diagram pack:** [05-Sheet-Connection-Maps.md](./05-Sheet-Connection-Maps.md) · SVG assets in `docs/client-share/assets/`

**Demo flow:** Fill checklist (site) → publish DPR (site) → Regenerate WPR (office) → download Client XLSX — all three show the same seeded counts.

---

## 4. Two-week UAT plan (8–19 September 2026)

**All testing on portal.spdc.in** with **SPDC-UAT-LIVE** and **SPDC-DEMO-01**.  
**Calendar:** [SPDC_TWO_WEEK_UAT_PLAN.md](./SPDC_TWO_WEEK_UAT_PLAN.md) · **Scenarios (~147):** [SPDC_UAT_SCENARIO_BANK.md](./SPDC_UAT_SCENARIO_BANK.md)

### Test hard · use early · hand over Fri Sep 19

Teams **start using the portal from Mon Sep 8** on modules that pass Day-1 smoke tests (DMS, directory, registers). Vendors join Wed Sep 10; client Mon Sep 15; stakeholders Wed Sep 17. **Full production handover** after robust UAT sign-off — not a hard wait until Sep 19 for daily work.

### Roles in every session

Office · Site · Client · Contractor (`vendor@`, `nkinra@`) · Stakeholder (`struct@`, `mep@`, `pmc@`) · SPDC IT (security)

### Workflow cadence tested

| Cadence | What we run on UAT | Roles |
|---------|-------------------|-------|
| **Daily** | Checklists · cube · DPR publish · attendance · safety obs | Site, vendor |
| **Weekly** | WPR regenerate · QAP · MoM follow-up · progress sync | Office, site, client |
| **Monthly** | Audit KPI · cashflow review · client report pack · RA/COP | Office, client |
| **Project closure** | Snaglist · lessons learnt · final exports · directory signs complete | Office, client, site |

**Week 2 Day 4 (Sep 18):** Synthetic full week replay — daily DPR Mon–Fri + weekly WPR + monthly audit + snag close with **multi-user concurrent input**.

### Week 1 — Module finals (Sep 8–12)

| Day | Focus | Security / multi-user |
|-----|-------|------------------------|
| Mon Sep 8 | Kick-off · DMS · directory · all-role login | S1–S5 |
| Tue Sep 9 | Drawings · RFIs · comms | M5 · S2 |
| Wed Sep 10 | Quality · NCR/CAR · inspection | M4 · S3–S4 |
| Thu Sep 11 | Safety · site daily workflow | Daily cadence |
| Fri Sep 12 | DPR · progress | M1 · M2 |

### Week 2 — Commercial · cadence · final gate (Sep 15–19)

| Day | Focus | Security / multi-user |
|-----|-------|------------------------|
| Mon Sep 15 | WPR weekly workflow · client pack | Weekly cadence · client verify |
| Tue Sep 16 | Cost · finance · CRM bids | M3 · M7 |
| Wed Sep 17 | HRMS · audit · inspection polish | M6 |
| Thu Sep 18 | Monthly + closure synthetic week | M8 · closure cadence |
| Fri Sep 19 | **Final gate** · re-test · sign-off | S6–S10 · M1–M8 full · §7 signatures |

---

## 4A. Module & gate checklists (detail)

Complete these **in order** during the two-week window. Use [12-Live-Client-UAT-Workbook.md](./12-Live-Client-UAT-Workbook.md) for page-level steps. **Demo rehearsal:** [SPDC_FE_DEMO_RUNBOOK.md](./SPDC_FE_DEMO_RUNBOOK.md).

### Phase A — Foundation (Week 1, Day 1)

| # | Test | Owner | Pass |
|---|------|-------|:----:|
| A1 | Office login, project select, module hub loads | SPDC IT | ☐ |
| A2 | DMS: browse ISO tree, upload PDF, preview in-app | Office | ☐ |
| A3 | SharePoint: file appears in correct folder; Open in SharePoint works | IT | ☐ |
| A4 | Directory: assign contractor + **upload sign-off PNG** → DMS | Office | ☐ |
| A5 | Role check: client cannot upload drawings; vendor cannot edit registers | IT | ☐ |
| A6 | Branded checklist export uses directory signature when fill sign absent | Office | ☐ |

### Phase B — Design & quality (Week 1, Days 2–3)

| # | Test | Owner | Pass |
|---|------|-------|:----:|
| B1 | GFC upload → drawing check → publish revision | Office | ☐ |
| B2 | RFI raise → assign → respond → close → export to DMS | Office + consultant | ☐ |
| B3 | Quality IR (F-01) → checklist fill → branded XLSX/PDF | Site + vendor | ☐ |
| B4 | NCR/CAR raise → contractor response → close | Office + vendor | ☐ |
| B5 | Safety IR (HSE F-01) + PPE checklist demo flow | Site + HSE | ☐ |

### Phase C — Site & progress (Week 1, Days 4–5)

| # | Test | Owner | Pass |
|---|------|-------|:----:|
| C1 | Site attendance: selfie + GPS + IST punch → SharePoint | Site | ☐ |
| C2 | Day log + photos filed to progress folders | Site | ☐ |
| C3 | DPR maker: save discipline day → export XLSX | Site + office | ☐ |
| C4 | Progress PvA: sync qty / manpower from live data | Office | ☐ |
| C5 | WPR maker: Load → Regenerate 24 sections → Client XLSX with logo | Office | ☐ |
| C6 | WPR sections match DPR + quality + safety seed counts | Office | ☐ |

### Phase D — Commercial & CRM (Week 2, Day 2)

| # | Test | Owner | Pass |
|---|------|-------|:----:|
| D1 | CRM comparative bid: two bidders, L1/L2 totals | Office | ☐ |
| D2 | Contractor uploads/edits BOQ → SharePoint 05.05/{vendor}/{discipline} | Vendor | ☐ |
| D3 | Master comparative refreshes in 05.06 on save | Office | ☐ |
| D4 | Cost monitoring + cashflow chart from project BOQ | Office | ☐ |
| D5 | RA bill upload → COP certification (finance chain) | Office + vendor | ☐ |

### Phase E — Go-live hardening (Week 2, Days 4–5)

#### E1 — Security gates (must all pass)

| Gate | Test | Expected | Pass |
|------|------|----------|:----:|
| **S1** | Unauthenticated API call | 401 on all `/api/*` except auth | ☐ |
| **S2** | User A opens Project B URL | 403 or empty — no cross-project rows | ☐ |
| **S3** | `client@` POST upload drawing | Blocked — read-only portal | ☐ |
| **S4** | `vendor@` PATCH quality register | Blocked — fills + bids only | ☐ |
| **S5** | Upload 30 MB file to checklist | Rejected at size limit | ☐ |
| **S6** | Close NCR → check audit log | Row with userId, entity, timestamp | ☐ |
| **S7** | User B uploads User A directory signature | 403 unless office/admin | ☐ |
| **S8** | Project A file URL on Project B | Path contains own project code only | ☐ |
| **S9** | JWT after password change (if enabled) | Old token invalid | ☐ |
| **S10** | Repo / env scan | No `.env` secrets in git; prod keys on server only | ☐ |

#### E2 — Multi-user concurrent input (same project, same window)

Run with **5 browser profiles** (office, site, vendor×2, client). All on **SPDC-UAT-LIVE**. No row loss, no cross-user overwrite.

| # | Scenario | Users | Pass criteria | Pass |
|---|----------|-------|---------------|:----:|
| **M1** | Two site engineers edit **different DPR disciplines** same date | site ×2 | Both publishes succeed; separate SharePoint folders | ☐ |
| **M2** | Site publishes DPR while office **Regenerates WPR** | site + office | WPR completes; DPR file intact | ☐ |
| **M3** | Bhavna + Nikhra edit **different BOQ disciplines** on DEMO-01 | vendor ×2 | Both saves; comparative 05.06 updates twice | ☐ |
| **M4** | Office **closes NCR** while contractor **fills action** on same NCR | office + vendor | Last-write wins with audit; no 500 error | ☐ |
| **M5** | Two stakeholders respond **different RFIs** simultaneously | struct + mep | Both responses saved | ☐ |
| **M6** | Directory signature upload during **checklist XLSX download** | office ×2 | Both complete | ☐ |
| **M7** | Vendor BOQ save during office **comparative refresh** | vendor + office | Master comparative consistent | ☐ |
| **M8** | Client read-only browse while office **publishes drawing** | client + office | Client never sees draft; published revision visible after refresh | ☐ |

#### E3 — Infrastructure & acceptance

| # | Test | Owner | Pass |
|---|------|-------|:----:|
| E4 | **Production email** — RFI/NCR/bid notify reaches real inboxes | IT | ☐ |
| E5 | **Backup & restore** — database + SharePoint recovery drill | IT | ☐ |
| E6 | **Performance** — 1000+ drawing rows, 50+ RFIs, acceptable load time | IT | ☐ |
| E7 | **Client acceptance** — sign-off table §7 completed | SPDC lead | ☐ |

---

## 5. Known gaps & roadmap (post go-live)

| Item | Priority | Target |
|------|----------|--------|
| Full client BOQ / budget workbook auto-import | P1 | After first live project pack drop |
| MS Project XML live sync (scheduled) | P2 | Phase 2 |
| Native mobile app (PWA enhancement) | P2 | Phase 2 |
| Advanced analytics / Power BI embed | P3 | Optional |
| Multi-language UI | P3 | On request |

---

## 6. Recommended path to operational go-live

```text
Sep 6           Sep 8–19 UAT                 Sep 19              Production
(demo ready)    module + workflow +          all Pass ☐          portal.spdc.in
                multi-user + security        sign-off §7         live project
                (all 6 role types)
```

1. **Kick-off Mon Sep 8** — [SPDC_TWO_WEEK_UAT_PLAN.md](./SPDC_TWO_WEEK_UAT_PLAN.md) with all module owners.  
2. **Run** daily workflow tests (site) + weekly (office) + monthly/closure (Thu Sep 18).  
3. **Execute** Phases A–E and per-module table in two-week plan.  
4. **Log** issues in UAT Workbook §2 backlog.  
5. **Deploy** fixes to UAT → client re-test same day where possible.  
6. **Sign** §7 on **Fri Sep 19** → production cut-over with `operations@spdc.in` as primary office admin.

---

## 7. Sign-off — operational readiness

| Role | Name | Date | Signature | Modules accepted |
|------|------|------|-----------|------------------|
| SPDC Project Director | | | | All / listed: |
| SPDC IT / SharePoint | | | | DMS + SharePoint |
| PMC Office lead | | | | Office modules |
| Site lead | | | | Field modules |
| HSE / Quality lead | | | | Q + Safety |
| Client representative | | | | Client portal · read-only |
| Development team | | | | Technical delivery |

---

## 8. Quick reference — demo logins

| Role | Email | Portal |
|------|-------|--------|
| Office | `office@sharnam.demo` | `/login/office` |
| Site | `site@sharnam.demo` | `/login/site` |
| Contractor (Bhavna) | `vendor@sharnam.demo` | `/login/vendor` |
| Contractor (Nikhra) | `nkinra@sharnam.demo` | `/login/vendor` |
| Client | `client@sharnam.demo` | `/login/client` |
| Stakeholder (PMC) | `pmc@sharnam.demo` | `/login/stakeholder` |
| Stakeholder (Struct) | `struct@sharnam.demo` | `/login/stakeholder` |
| Stakeholder (MEP) | `mep@sharnam.demo` | `/login/stakeholder` |

Password: **`Demo@1234`**

---

*Sharnam Project Development Consultants & Co. · SPDC-CLIENT-SHARE · Module Delivery Status Rev 03*
