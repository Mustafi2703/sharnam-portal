# UAT — Drawings module + what DPR / WPR need

**Run:** `node scripts/uat-drawings-module.mjs`  
**Full stack (existing):** `UAT_ONLY=DWG,DCI,RFI,PRG,DPR,WPR node scripts/prod-deep-uat.mjs`

Mark gaps `[OK]` / `[MISSING]` / `[FIX]`.

---

## 1. Drawings UAT matrix (each hub button)

| ID | Button / action | Pass criteria | Feeds WPR? |
|---|---|---|---|
| D1 | Master register — add/enrich lines | ≥6 lines; disciplines Architecture/Structure/MEP/PEB; planned + critical set | **Yes** → Design status rollup; SPDC drawingRegister |
| D2 | Drawing Check gate | Precheck returns `unlockToken`; signature required; second use of same token fails | Fills → 04.04/Drawing_Checklists |
| D3 | Approval & GFC — upload R0 | PDF filed; drawing published; SharePoint `04.02/…/R0` | Design status % published |
| D4 | Upload R1 (new rev) | New Drawing Check required; R0 superseded; 2 revisions on list | Rev on register / GFC log |
| D5 | Dashboard + exports | register-dashboard JSON; master xlsx; GFC xlsx/pdf; dashboard pdf | Export only (not July tabs) |
| D6 | Publish registers | `publish-registers` OK → 04.02 copies | — |
| D7 | Drawing settings | Office can GET pick-lists / import (smoke) | — |
| D8 | Design coordination | Issue + markup + 5 follow-ups + escalate RFI | SPDC drawingRegister notes / PPT DCI |
| D9 | Resolve without escalate | Second issue closed after follow-ups; coordination xlsx/pdf | — |
| D10 | Checklist fill log | ≥1 Drawing Check fill listed; branded download | — |
| D11 | Drawing files / library | Browse 04.02 returns folder tree | — |
| D12 | RFI Ask + register | Drawing-linked RFI; register export | Correspondence (not July dwg sheets) |
| D13 | Client read-only | Sees drawings; add/upload 403 | — |
| D14 | Consultant markup | Markup on escalated RFI | — |

---

## 2. What July client WPR Excel actually takes from Drawings

July template sheets (`WPR  23 July to 29 July.xlsx`):

| Sheet | Source | Drawings-related? |
|---|---|---|
| **Design status** | Published drawings by discipline (or register rollup) | **Yes — primary** |
| **As per drawing status** | Progress activities + **DPR week qty** (name is misleading) | Needs **PRG + DPR**, not GFC files |
| Hinderance / Risk / Legal | Progress | No |
| Weekly Manpower / Cashflow / PvA | Progress / Cost | No |
| HSE / Quality / Cube | Safety / Quality | No |
| Procurement / Value Addition | Progress trackers | No |

**Not in July template** (only old `WPR File.xlsx`): Master Drawing Register, Site Drawing Register, Milestone Dashboard, CAR register, safety sheet list.  
→ Code that writes “Master Drawing Register” is a no-op on the July pack. Drawing detail for the **client** is **Design status** + SPDC/PPT drawing register.

---

## 3. DPR prerequisites (for WPR “As per drawing status” + weekly executed)

| Need | Module | UAT must create |
|---|---|---|
| Activity register (BOQ, unit, weekly plan) | Progress | PRG-1 |
| Daily qty on DPR lines matching activity names | DPR maker | DPR-1…3 |
| Continuity cum qty | DPR | Assert day-to-day |
| Manpower on DPR (optional for charts) | DPR | Line manpower |
| Week ending Sunday for WPR | WPR maker | WPR-1…3 |

Without **PRG + DPR**, WPR fails with *“weekly executed section has no DPR rows”* (seen on WPR-only recheck).

---

## 4. WPR prerequisites (full week pack)

| Need | From |
|---|---|
| Communication matrix ≥3 | Setup |
| Client logo | Setup SET-4 |
| Design status rows | Drawings published (or register lines) |
| As per drawing / PvA / executed | Activities + DPRs |
| Manpower chart | Progress manpower trades |
| HSE / Quality charts | Safety daily + quality/NCR/cubes |
| Hindrance / risk / legal | Progress |
| Cashflow | Cost |
| Photos (PPT) | WPR photo uploads or defaults |

---

## 5. Gaps found (fix or watch)

| Gap | Status |
|---|---|
| Prod used old WPR File (4 charts) | Fixed — prefer July week template |
| July pack has no Master Drawing Register sheet — register writes skipped | **By design**; Design status is the client feed |
| Design status empty if no `sections` and no published drawings | **Fixed** — rollup from register lines |
| WPR-only UAT without DPR | Expected fail — script must run PRG+DPR+WPR together |
| Checklist photo 504s | Softened; still watch on full CHK |
| Drawing Check fills folder | 04.04/Drawing_Checklists |

---

## 6. Recommended test order (tomorrow)

```
SET → DWG (D1–D7) → DCI (D8–D9, D14) → RFI (D12) → client (D13)
   → PRG → DPR ×15 days → WPR ×3
Assert client pack: ≥6 charts · Design status ≥1 row · Communication Matrix · logos
Assert SPDC WPR: drawingRegister rows · weeklyExecuted from DPRs
```

Human spot-check: open client xlsx **Design status** + **As per drawing status** after a green WPR step.
