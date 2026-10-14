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

### Snapshot — run on `34cada1` · **24 / 44** · portal dropped mid-run

| Module | Worked | Didn’t / watch | Your mark |
|---|---|---|---|
| **CRM / Logins** | ✅ All 6 portal logins | CRM-1…3 on newer commit `abaf17f` (not in this run) | `[ ]` |
| **Setup** | ✅ Team, matrix, logo, pin | — | `[ ]` |
| **Drawings** | ✅ **9/9 GFC**, R1, exports, client blocked, fill log | Settings 404 soft; library timeout soft | `[ ]` |
| **Design coordination** | ✅ Issue → escalate → consultant close | ❌ DCI-4 export `0/200` (gateway) | `[ ]` |
| **Quality** | ✅ QA-3 SOR + QA-4 NCR | ❌ QA-1/2 download timeout; QA-5/6 **fetch failed** (API down) | `[ ]` |
| **Safety / Progress / DPR / WPR** | — | ❌ All **TypeError: fetch failed** — **portal.spdc.in unreachable** after ~QA-4 | `[ ]` |

**Blocker:** Hostinger / `portal.spdc.in` went offline mid-UAT. Retest `UAT_ONLY=QA,SAF,PRG,DPR,WPR` once health is OK.

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

## 4. Commands (module slices)

```bash
# CRM + logins + setup only
UAT_ONLY=SET node scripts/prod-deep-uat.mjs

# Drawings + coordination
UAT_ONLY=SET,DWG,DCI node scripts/prod-deep-uat.mjs

# Quality + Safety
UAT_ONLY=SET,QA,SAF node scripts/prod-deep-uat.mjs

# Full chain into WPR
UAT_ONLY=SET,DWG,DCI,QA,SAF,PRG,DPR,WPR node scripts/prod-deep-uat.mjs
```
