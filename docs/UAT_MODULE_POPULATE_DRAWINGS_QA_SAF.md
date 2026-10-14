# Populate by module — Drawings · Quality · Safety → WPR

Each module owns its registers **and** the July / SPDC WPR tabs that read them.  
Run together:

```bash
UAT_ONLY=SET,DWG,DCI,QA,SAF,PRG,DPR,WPR node scripts/prod-deep-uat.mjs
# Optional: CHK (checklist fills) — may 504 on gateway; non-blocking for WPR sheets
```

---

## Drawings module populates

| Portal action (UAT) | SharePoint | WPR / client pack |
|---|---|---|
| Master register 9 lines | 04.02 | SPDC drawingRegister |
| Drawing Check + **all 9** GFC R0 PDFs + publish | 04.02 + 04.04/Drawing_Checklists | **Design status** (discipline %) |
| R1 on VT-ST-101 | 04.02 | Rev history |
| Dashboard / GFC / master exports + publish-registers | 04.02 | — |
| Design coordination + markups + escalate RFI | 04.04 / 03.06 | Drawing Register (DCI) notes / PPT |
| Type contains `GFC` + issued dates | — | **Site Drawing Register** filter |

**Not from Drawings:** July **As per drawing status** = Progress activities + **DPR** qty.

---

## Quality module populates

| Portal action (UAT) | SharePoint | WPR / client pack |
|---|---|---|
| QAP weekly plans | 08.01 | Quality notes / SPDC |
| Cubes + **7-day + 28-day** loads | 08.03 | **Cube Test** |
| Site Observation / Site Instruction (quality-site-records) | 08.02 area | Quality Statistic |
| **Progress SOR stats** (from QA totals) | — | July **SOR Log** |
| NCR + CAR registers | 08.06 _Registers | **CAR register** (all NCRs) |
| Quality dashboard export | 08.01 | Charts |
| QI / pour-card fills (CHK) | 08.02 | Fill counts in notes |

---

## Safety module populates

| Portal action (UAT) | SharePoint | WPR / client pack |
|---|---|---|
| Daily log 15 days (manpower, TBT, PPE) | 08.07 | **HSE Statistic** |
| **Site Instruction** (safety records) | 08.07 | July **Site Instruction** |
| **Unsafe act** / **Unsafe condition** | 08.07 | HSE right block + Unsafe Act Summary |
| Toolbox Talk, Near Miss, First Aid, NCN, HSE Training | 08.07 | HSE Statistic rows |
| Safety NCR + close | 08.06/07 | **NCR Summary** |
| Weekly safety packs | 08.07 | — |
| Safety checklist fills (CHK) | 08.07/Checklists | Fill counts |

---

## Mark checklist

| Module | Fully seeds its WPR tabs? | Your mark |
|---|---|---|
| Drawings | Design status + drawing register + GFC files | `[ ]` |
| Quality | Cube, CAR/NCR, SOR Log, Quality Statistic | `[ ]` |
| Safety | HSE Statistic, Site Instruction, Unsafe act sheets | `[ ]` |
| Progress+DPR | As per drawing status + weekly executed | `[ ]` |
