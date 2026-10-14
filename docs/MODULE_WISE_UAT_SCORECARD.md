# Module-wise UAT scorecard — Voltamp · 14 Oct 2026

Portal: https://portal.spdc.in · Password for UAT accounts: `Demo@1234`  
**Start here:** CRM directory → Live project setup → each `/login/…` → then module data.

Mark each row `[OK]` / `[FIX]` / `[RETEST]` after you check in the UI.

---

## 0. CRM & logins (start here)

| Check | How | Status (latest automation) | Your mark |
|---|---|---|---|
| CRM hub (office) | `/crm` → Projects / Directory / Setup | Office login works | `[ ]` |
| Directory — Clients | `/crm/directory/clients` — Voltamp card | Expected present | `[ ]` |
| Directory — Vendors | `/crm/directory/vendors` — Reeca | Expected present | `[ ]` |
| Directory — Stakeholders | `/crm/directory/stakeholders` — Shah & Talati | Expected present | `[ ]` |
| Activate portal | Company → Activate portal / person → password `Demo@1234` | **CRM-2** restores via API | `[ ]` |
| Live project setup | `/crm/setup` or project **setup** — team + matrix + Complete setup | Voltamp already set up | `[ ]` |
| `/login/office` | operations@spdc.in | ✅ LOG-office | `[ ]` |
| `/login/site` | jaideep.parmar@spdc.in | ✅ LOG-site | `[ ]` |
| `/login/vendor` | sanjaythakor.reeca@gmail.com | ✅ LOG-vendor | `[ ]` |
| `/login/client` | deven_mktg@voltamptransformers.com | ✅ LOG-client | `[ ]` |
| `/login/stakeholder` | ashish.chobe@shahntalati.com | ✅ LOG-consultant | `[ ]` |
| Each login sees Voltamp | After CRM assign / setup | **CRM-3** (new) | `[ ]` |

**Rule:** Creating a CRM company alone does **not** create a login — use **Activate portal** or **Complete setup**. Then add data **as that login** (vendor fills checklists; client signs; consultant answers RFIs).

---

## 1. Results by module (automation — refresh after each full run)

Evidence folder: `docs/uat-evidence/prod-deep-YYYY-MM-DD/REPORT.md` (now includes **Module scorecard**).

### Snapshot — `9a5c062` · 14 Oct 2026

| Module | Worked | Didn’t / watch | Your mark |
|---|---|---|---|
| **CRM / Logins** | ✅ **15/15** — all 6 logins, Voltamp visible, SET-5 scrubbed UAT- labels | Restore admin API returns 403 (logins still OK) | `[ ]` |
| **Drawings / PDF viewer** | ✅ **10/10** revisions re-uploaded with **real 3-page GFC PDF**; `/revision/:id/pdf` returns 200; viewer uses auth blob | Open any GFC → Full-screen PDF / Mark up drawing | `[ ]` |
| **Design coordination / RFI markup** | Markup loads linked drawing PDF via same API | Check cloud/box tools on VT-ST-101 | `[ ]` |
| **Other modules** | Per-module runners: `node scripts/uat-modules/run.mjs CRM` etc. | Run `--from DWG` when checking next | `[ ]` |

**How to check PDF markup now:** Site login → Voltamp → Drawings → open VT-ST-101 → viewer shows 3 pages → Coordination / RFI → **Mark up drawing**.

---

## 2. Who adds what data (login → module)

| Login | Portal | Creates / does |
|---|---|---|
| Office | `/login/office` | CRM setup, matrix, registers, publish WPR, close NCR/RFI, certify bills |
| Site | `/login/site` | Drawing Check + GFC upload, DPR, raise RFI/NCR, safety daily, coordination |
| Planning | `/login/site` (planning user) | Activities, milestones, manpower, S-curve |
| Vendor | `/login/vendor` | Checklist fills, NCR responses, RA bills |
| Client | `/login/client` | View, concerns, QI client signature — **no** GFC upload |
| Consultant | `/login/stakeholder` | Answer RFIs, markups |

---

## 3. Suggested check order for you tomorrow

1. Office → CRM directory → confirm Voltamp / Reeca / Shah & Talati → Activate portal if needed (`Demo@1234`).  
2. Open each login URL above → confirm Voltamp appears.  
3. Site → Drawings hub → see 9 GFCs.  
4. Office → Quality / Safety / Progress → spot registers.  
5. Office → WPR maker → download **client xlsx** + **pptx** for latest week.  
6. Mark this scorecard + `DRAWINGS_MODULE_REVIEW.md`.

---

## 4. Commands (three phases, one script per module)

```bash
# 1. CRM, then HRMS
node scripts/uat-modules/phase-1-crm-hrm.mjs

# 2. Onboard already done in phase 1. This writes three weeks of project data.
node scripts/uat-modules/phase-2-three-weeks.mjs

# 3. Generate WPR for those three weeks, then every other report
node scripts/uat-modules/phase-3-reports.mjs

# One module
node scripts/uat-modules/HRM.mjs
node scripts/uat-modules/RPT.mjs
```
