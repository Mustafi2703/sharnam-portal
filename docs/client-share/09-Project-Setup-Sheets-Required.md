# Project setup — sheets required for DPR & WPR

**What you must upload vs what the portal generates · idempotent data · excluding Comms**

Reference proposal: `Sharnam_modules_docs/SPDC_PMC_Proposal_ Arvind (1).docx`  
Commercial format: `Sharnam_modules_docs/Viatrix_RA BILL_COP.xlsm`

---

## 1. Minimum uploads to generate DPR & WPR

| Priority | Client Excel / source | Upload in portal | Feeds |
|----------|----------------------|------------------|-------|
| **Required** | BOQ / monitoring per structure | **Cost → BOQ** (per structure) | DPR qty rows |
| **Required** | Planned Vs Actual Dashboard | **Progress → Planned vs Actual → Import** | DPR planned hints, WPR progress |
| **Strongly recommended** | MB sheet | **Cost → MB** (from global master) | DPR cumulative qty |
| **Strongly recommended** | BBS + shape codes | **Cost → BBS** | DPR rebar kg |
| **Recommended** | MS Project schedule (XML export) | **Progress → MS Project → Import XML** | S-curve, milestones, WPR |
| **Recommended** | NCR 01.xlsx | `npm run db:seed` or **Quality → raise NCR** | DPR quality, WPR quality |
| **Recommended** | SPDC Cube Register | Seed, **sync-template**, or **Quality → Cube Test** | DPR quality (sets, 7d/28d, agency) |
| **Recommended** | QAP weekly sheet | **Quality → `/qap`** — **Load Week 50 template** (~295 rows) | WPR quality; test agency → DPR |
| **Recommended** | Safety dashboard | **Safety** module (log records) | DPR HSE, WPR safety |
| **Daily site** | QI + Safety checklists | **Checklists → fill** (photos + sign) | DPR quality line, audit log |
| **Optional for DPR** | Cashflow / AC certified | **Cost → Cashflow** | DPR header AC value |
| **Optional for WPR** | Hindrance register | **Progress → Hindrance** | DPR delays, WPR slides |
| **Not required for DPR** | Comms matrix, design coordination | *(excluded from this setup)* | — |

**Site engineer still enters manually each day:** today's qty, weather, photos, signatures.

---

## 2. What the system generates (do not re-type in Excel)

| Output | How |
|--------|-----|
| **DPR XLSX** (7 disciplines) | DPR Maker → Download XLSX → DASHBOARD sheet + formulas |
| **DPR PDF** | DPR Maker → Download HTML → Print → PDF (charts included) |
| **WPR XLSX + PPTX** | WPR Maker → week ending → Download |
| **S-curve chart** | Progress → S-curve (from MS Project or Planned vs Actual) |
| **Checklist fill PDF** | Checklist fill → Export branded HTML |
| **Connection diagrams** | `docs/client-share/assets/*.png` |
| **Quotation / proposal** | CRM → Quotation maker → Print / PDF |
| **RA cumulative + COP** | Finance → RA Bill Tracker + COP (auto previous/cumulative on new RA) |

---

## 3. Idempotent data rule (single source of truth)

| Rule | Meaning |
|------|---------|
| **One register per module** | Edit in portal OR re-import Excel — not both in parallel without sync |
| **Re-seed is safe** | `npm run db:seed` refreshes sheet-backed NCR/cubes/QAP/safety from `Sharnam_modules_docs/` |
| **Demo seed is safe** | `db:seed-quality-safety-demo`, `db:seed-dpr-demo` replace demo-tagged rows only |
| **Published DPR** | `DprSnapshot` is the daily truth; prior days feed cumulative + S-curve |
| **Finance chain** | New RA bill auto-reads **previous cumulative** for same PO; COP links to RA |

**Do not** maintain a parallel Excel DPR if you publish from the portal — use portal as master after go-live.

---

## 4. QAP + checklists — are they connected?

**Yes — same database, different roles:**

```text
Checklist master (QI / Safety templates + line items)
    → Assign to project
    → Site fills checklist (photos + signature)
    → Checklist logs (audit)
    → DPR auto-fill: "QI / Safety checklists filled today"
    → WPR auto-seed: quality + safety sections

QAP register (weekly activities)
    → Full Week 50 sheet on /qap (sync-template from seed/data)
    → testAgency → DPR "Testing agency" line when logged
    → WPR quality section (sign-off flags)
```

**Example checklists** are seeded on `db:seed` and assigned to **SPDC-DEMO-01**. Demo fills: `npm run db:seed-quality-safety-demo`.

See [08-Quality-Safety-DPR-WPR-Guide.md](./08-Quality-Safety-DPR-WPR-Guide.md).

---

## 5. New project setup (excluding Comms)

After **Quotation maker → Award** (creates project + SharePoint tree):

| Step | Module | Action |
|------|--------|--------|
| 1 | **Cost** | Upload BOQ per structure; pick MB/BBS from global master |
| 2 | **Progress** | Import Planned vs Actual Excel; seed or import MS Project XML |
| 3 | **Quality** | Seed NCR/cubes OR import; add QAP week rows; assign QI checklists |
| 4 | **Safety** | Log toolbox template; assign Safety checklists |
| 5 | **Drawings** | Upload GFC sheets (gate for QI) |
| 6 | **Finance** | Add PO → RA-01… → COP (see Viatrix format) |
| 7 | **DPR Maker** | Pick date → auto-fill → publish |
| 8 | **WPR Maker** | Week ending → review sections → PPTX |

**Skip for now:** Comms matrix, design coordination, HRMS (office-only).

---

## 6. Finance — RA Bill + COP (Viatrix format)

**Path:** Project → **Finance** → PO → **RA Bill Tracker** → **COP**

| Step | What happens |
|------|----------------|
| Add **PO** | Links vendor, WO value, retention % |
| Add **RA-01, RA-02…** | Portal sets **Previous** + **Cumulative** from prior RAs on same PO |
| Add **COP** | Link to RA; certificate number like `01/N.K.INFRA/2025-26/01` |
| Cost bridge | COP payable feeds **Cost → Cashflow** actual column |

**Demo seed:** `npm run db:seed` creates PO-NK-INFRA-CIV-01 · RA-01…RA-05 · 5 COPs on **SPDC-DEMO-01**.

---

## 7. Quotation maker (client demo)

| Item | Detail |
|------|--------|
| Portal | **Quotation maker** (CRM) — pre-filled Arvind scope |
| Demo record | `SPDC/26-27/INQ/78` after `npm run db:seed` — open CRM → Quotations |
| Print | **Print / PDF** for proposal walkthrough |
| Award | Creates **SPDC-xxx** project + ISO folder tree |

---

## 8. NCR / CAR — raise and close

| Action | Where |
|--------|-------|
| Raise NCR | Quality → **NCR / CAR** → form |
| Raise CAR | Same form — choose **CAR** kind |
| Close | **Close** button on open rows (or office PATCH) |
| Bulk from Excel | `NCR 01 .xlsx` on `db:seed` |

Status **Open** → DPR issues + WPR open list. **Closed** → drops from open count.

---

## 9. Demo seed commands (client evidence)

**Hostinger first deploy:** set `RUN_SEED=1` in hPanel env → build runs everything below in one shot. Remove `RUN_SEED=1` after login works.

```bash
npm run db:seed                    # All-in-one: project, sheets, quotation, RA/COP, DPR day, pilot week
npm run db:seed-full-demo          # Re-run DPR + pilot only (after base seed)
npm run db:seed-quality-safety-demo
npm run db:seed-dpr-demo           # SPDC-DEMO-01 DPR day only
npm run db:seed-pilot-week         # SPDC-PILOT-02 week only
```

**Logins:** `office@sharnam.demo` / `Demo@1234`

**Show client:**

1. Quotation maker → Print proposal  
2. Finance → RA Bill Tracker (Previous + Cumulative columns)  
3. Finance → COP tab  
4. Quality → NCR/CAR → raise + close  
5. DPR Maker → 2026-08-14 → PDF + charts  
6. Connection PNGs in `docs/client-share/assets/`

---

## 10. Diagram index

| File | Topic |
|------|-------|
| [07-Connection-Diagram-Index.md](./07-Connection-Diagram-Index.md) | All PNG maps |
| [08-Quality-Safety-DPR-WPR-Guide.md](./08-Quality-Safety-DPR-WPR-Guide.md) | Checklists + QAP |
| [06-PMC-End-of-Day-Fill-Guide.md](./06-PMC-End-of-Day-Fill-Guide.md) | Daily checklist |
