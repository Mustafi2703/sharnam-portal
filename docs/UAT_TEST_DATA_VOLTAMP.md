# Voltamp UAT — test data pack

Everything here is invented test data for **SPDC-VOLTAMP-01**. Type or paste it as written; the "Expected" column tells you what the portal must show back. Dates assume today is **10 Oct 2026** (a Saturday). Three working weeks are used so the week-to-week chain can be checked:

| Week | Monday → Saturday | Use |
|---|---|---|
| W1 | 21 Sep – 26 Sep 2026 | first DPR / WPR (report no. 1) |
| W2 | 28 Sep – 3 Oct 2026 | second week (must continue from W1) |
| W3 | 5 Oct – 10 Oct 2026 | current week |

## 0. Logins (four mailboxes you own)

| Email | Role in the portal | Why |
|---|---|---|
| baibhabmustafi@gmail.com | **SPDC office / admin** (you) | creates everything, approves, publishes |
| hello@twinoxis.com | **Client** (read-only + sign + raise concern) | Voltamp client PM |
| admin@twinoxis.com | **Design consultant** | RFIs, design coordination, drawing mark-ups |
| hello@qryxtech.com | **Contractor** (site in-charge) | fills checklists, safety, RFIs |

Need more logins (site engineer, HR, planning)? Gmail delivers `baibhabmustafi+site@gmail.com`, `+hr`, `+planning`, `+qa` to the same inbox, and the portal treats each as a separate login. If your other domains support plus-addressing, `hello+mep@qryxtech.com` works the same way.

## 1. Project card

| Field | Value |
|---|---|
| Code | SPDC-VOLTAMP-01 |
| Name | Voltamp Transformers — New Assembly Shop and Test Bay |
| Client | Voltamp Transformers Ltd. |
| Location | Vadodara, Gujarat |
| Start / end | 01 Sep 2026 → 30 Jun 2027 |
| Project type / contract | Industrial · Item rate contract |
| PMC | Sharnam Project Development Consultants & Co. |
| Design consultant | Twinoxis Design Studio |
| Main contractor | Qryx Infra Pvt. Ltd. |
| Contract value | ₹ 18,50,00,000 |

## 2. Parties and directory

| Party | Name | Designation | Email |
|---|---|---|---|
| Client | Aarav Shah | Client PM | hello@twinoxis.com |
| Design consultant | Meera Kapoor | Principal architect | admin@twinoxis.com |
| Contractor | Rohan Desai | Site in-charge | hello@qryxtech.com |
| SPDC | Baibhab Mustafi | Project manager | baibhabmustafi@gmail.com |
| SPDC | Site Engineer (test) | Site engineer — civil | baibhabmustafi+site@gmail.com |
| SPDC | Planning (test) | Planning engineer | baibhabmustafi+planning@gmail.com |
| SPDC | QA (test) | Quality engineer | baibhabmustafi+qa@gmail.com |

Communication matrix: one contact per role above; client = **TO**, everyone else **CC**.

## 3. CRM (do this before the project modules)

| Item | Test data |
|---|---|
| Client record | Voltamp Transformers Ltd. · contact Aarav Shah · hello@twinoxis.com |
| Lead | "Assembly shop and test bay — Vadodara" · value ₹ 18.5 Cr · stage Proposal |
| Vendors | Qryx Infra Pvt. Ltd. (civil) · Twin Electricals (MEP) · test mail hello@qryxtech.com / admin@twinoxis.com |
| Package | Civil & structure — 3 disciplines (Civil, PEB, MEP) |
| Comparative bid | 3 vendors × 4 BOQ lines below |

| BOQ line | Unit | Qty | Qryx Infra | Twin Electricals | Bhavana Test Co. |
|---|---|---|---|---|---|
| PCC M10 | m³ | 120 | 5,200 | 5,450 | 5,100 |
| RCC M25 | m³ | 640 | 8,900 | 9,150 | 8,700 |
| Steel Fe500D | MT | 52 | 62,000 | 63,500 | 61,500 |
| Brick masonry | m² | 3,000 | 780 | 800 | 760 |

Expected totals: **Bhavana Test Co. ₹ 1,16,58,000 (L1)** · Qryx Infra ₹ 1,18,84,000 (L2) · Twin Electricals ₹ 1,22,12,000 (L3). The comparative Excel must rank them in that order.

## 4. HRMS

| Item | Test data |
|---|---|
| Departments | Civil, Quality, Safety, Planning, HR (add two, delete one to test delete) |
| Roles | Site Engineer — Civil, Quality Engineer, Safety Officer, Planning Engineer |
| Requisition | Site Engineer — Civil · 1 opening · Department Civil |
| Candidate | Test Candidate One · baibhabmustafi+cand1@gmail.com · 4 yrs experience |
| Interview | R1, R2, R3 — score 7 / 8 / 8 on the SPDC scorecard |
| Offer | Joining 02 Nov 2026 · fixed CTC ₹ 6,00,000 a year · performance pay 10 % |
| Expected | Offer letter + Annexure I; appointment letter; portal login created (note the one-time password) |
| Attendance site pin | Pin SPDC-VOLTAMP-01 where you are testing, radius 150 m |
| Check-in tests | Inside radius = "location verified"; outside = "manual review" |
| Leave | 1 day casual leave — apply as site login, approve as HR |
| Payroll days | Month 26 days, 24 present, 1 leave, 1 absent → expect prorated pay |
| Payroll-only staff | "Test Helper" · ₹ 18,000 a month · 26 days → payslip PDF |

## 5. Drawings (12 drawings)

| No. | Title | Discipline | Rev | Planned issue | Critical |
|---|---|---|---|---|---|
| A-101 | Ground floor plan | Architecture | R0 → R1 | 10 Sep | Yes |
| A-102 | First floor plan | Architecture | R0 | 14 Sep | No |
| A-201 | Elevations | Architecture | R0 | 18 Sep | No |
| S-101 | Foundation layout | Structure | R0 → R1 | 05 Sep | Yes |
| S-102 | Column schedule | Structure | R0 | 08 Sep | Yes |
| S-201 | Roof framing (PEB) | Structure | R0 | 25 Sep | Yes |
| E-101 | Lighting layout | Electrical | R0 | 30 Sep | No |
| E-102 | Power layout | Electrical | R0 | 30 Sep | No |
| P-101 | Drainage layout | Plumbing | R0 | 28 Sep | No |
| F-101 | Fire fighting layout | Fire | R0 | 05 Oct | No |
| M-101 | Test bay crane layout | Mechanical | R0 | 12 Oct | Yes |
| E-201 | Earthing layout | Electrical | R0 | 12 Oct | No |

Steps: upload A-101 R0 (use any PDF; the client's `A_10_101_R0_ GROUND FLOOR PLAN.dwg` for the DWG test), then R1. Leave M-101 and E-201 unissued. Expected: master register shows 2 drawings with a red **delay** flag (past planned date, not issued); the dashboard shows location, criticality and delay charts.

## 6. RFIs and design coordination

| # | Raised by | Subject | Assigned | Expected end state |
|---|---|---|---|---|
| RFI-1 | Contractor | Column C4 reinforcement conflict with S-102 | Consultant | Answered → Closed |
| RFI-2 | Contractor | Conduit routing through beam B7 | Consultant | stays Open (for the dashboard) |
| RFI-3 | Office | Clarify test-bay floor finish | Consultant | Answered |
| DC-1 | Office | Architecture / structure grid mismatch at C4 | Consultant | follow-up, then **Escalate to RFI** |

## 7. Quality

**QAP** — add one section "Reinforcement" and these rows:

| Sr | Activity | Description | Frequency | Code | Agency | Remarks |
|---|---|---|---|---|---|---|
| 1 | Reinforcement | Verify bar diameter, spacing and cover | Every pour | IS 456 | Site QC | Completed |
| 2 | Reinforcement | Lap length and anchorage check | Every pour | IS 456 | Site QC | Pending |
| 3 | Concrete | Slump test at the plant gate | Every truck | IS 1199 | Site lab | Completed |
| 4 | Concrete | Cube sampling | 1 set per 50 m³ | IS 516 | Site lab | Pending |

Expected: 2 done, 2 open.

**F-01 Request for Inspection** — Activity "RCC column casting — C4", Location "Grid C4 / Lvl +0.00 to +4.15", Quantity "3.2 m³", Stage "Pre-pour hold point", ITP "ITP-STR-05", Control point "H — Hold", Drawing "S-102 R0", Method statement "MS-STR-07". Assign to the contractor login.

**F-02 checklist** — use the "RCC Column" example (32 items). Mark items 1–3 "photo required". Fill: all Yes except item 5 = No ("Spacers missing"). Attach **3 photos on each flagged item**, plus 3 general photos.
Expected: submit is refused with fewer than 3 photos on a flagged line; the branded Excel has a Photographs sheet grouped per item; result summary shows 1 Not OK.

**Cube register** (grade ➜ strength = load kN ÷ 22.5, average of 3):

| Group | Cast | Grade | 7-day loads (kN) | 7-day strengths | Avg | 28-day loads (kN) | 28-day strengths | Avg | Expected |
|---|---|---|---|---|---|---|---|---|---|
| Footing F1 | 08 Sep | M25 | 410 / 420 / 405 | 18.22 / 18.67 / 18.00 | 18.30 | 640 / 650 / 630 | 28.44 / 28.89 / 28.00 | 28.44 | both PASS |
| Footing F2 | 10 Sep | M25 | 400 / 395 / 410 | 17.78 / 17.56 / 18.22 | 17.85 | 520 / 500 / 510 | 23.11 / 22.22 / 22.67 | 22.67 | 7-day PASS, 28-day **FAIL** → listed under non-conformance due |
| Column C1 | 22 Sep | M30 | 480 / 495 / 470 | 21.33 / 22.00 / 20.89 | 21.41 | pending (due 20 Oct) | — | — | 7-day PASS (limit 0.67 × 30 = 20.1) |

Test dates must fill by themselves (cast + 7 and + 28 days).

**Site observations** (add with 1–2 photos each; close the first two):

| # | Observation | Location | Severity |
|---|---|---|---|
| 1 | Cover blocks missing at column starter | Grid C4 | Medium |
| 2 | Shuttering joints open — slurry leakage | Grid B5 | High |
| 3 | Honeycombing on stripped column face | Grid C2 | High |
| 4 | Slump test record not available at pour | Plant gate | Medium |

**Site instructions:** (1) "Stop pour until cover blocks are fixed and re-inspected" · (2) "Provide wet curing for 7 days from the pour".

**NCR / CAR:** NCR-01 "Footing F2 28-day cube average 22.67 below M25" (Quality, contractor Qryx Infra, planned closure 17 Oct). CAR-01 "Waterproofing applied without surface-preparation approval". Close NCR-01 with action "Core test ordered; strength verified".

Expected dashboard (week W3): observations 4 (2 closed, 2 open → closure 50 %), instructions 2, NCR 2 (1 closed), cube failures 1, QAP 2 done / 2 open.

## 8. Safety — daily log

| Date | Manpower | Hours | Safe man-hours | Toolbox talk | Inductions | Permits |
|---|---|---|---|---|---|---|
| Mon 5 Oct | 58 | 8 | 464 | Working at height | 4 | 3 |
| Tue 6 Oct | 62 | 8 | 496 | Housekeeping | 2 | 4 |
| Wed 7 Oct | 60 | 8 | 480 | Electrical safety | 0 | 2 |
| Thu 8 Oct | 64 | 8 | 512 | PPE usage | 3 | 5 |
| Fri 9 Oct | 66 | 8 | 528 | Excavation safety | 1 | 3 |
| Sat 10 Oct | 55 | 8 | 440 | Fire prevention | 0 | 2 |

Expected week total: **2,920 safe man-hours**, 6 toolbox talks, 10 inductions, 19 permits. Add: observation "Worker without helmet near hoist" (Medium), a **Near Miss** "Falling bolt from PEB erection" (High), and one safety request using the client's safety IR (F-01 HSE) with result code S1.

## 9. Progress

**Activity register** (BOQ = GFC for simplicity):

| Activity | Unit | Scope | Executed before W1 |
|---|---|---|---|
| RCC column — Grid C1–C6 | m³ | 400 | 20 |
| Brick masonry — internal | m² | 3,000 | 150 |
| Reinforcement fixing | MT | 60 | 5 |

**DPR quantities by day** (enter each day; the "cumulative previous" must chain on its own):

| Day | RCC m³ | Masonry m² | Reinforcement MT |
|---|---|---|---|
| W1 Mon | 12 | 60 | 1.5 |
| W1 Tue | 15 | 80 | 2.0 |
| W1 Wed (rain) | 0 | 0 | 0 |
| W1 Thu | 18 | 75 | 2.2 |
| W1 Fri | 14 | 90 | 1.8 |
| W1 Sat | 11 | 70 | 1.5 |
| **W1 total** | **70** | **375** | **9.0** |
| W2 Mon–Sat | 16, 14, 13, 17, 15, 10 | 85, 90, 95, 0, 100, 80 | 2.0, 2.1, 1.9, 2.4, 2.0, 1.6 |
| **W2 total** | **85** | **450** | **12.0** |

**Expected on the WPR (report no. 1 = W1, no. 2 = W2):**

| Activity | W1 till last week | W1 this week | W1 till date | W2 till last week | W2 this week | W2 till date |
|---|---|---|---|---|---|---|
| RCC | 20 | 70 | 90 | 90 | 85 | 175 |
| Masonry | 150 | 375 | 525 | 525 | 450 | 975 |
| Reinforcement | 5 | 9.0 | 14.0 | 14.0 | 12.0 | 26.0 |

Report number must continue 1 → 2 → 3 by itself. DPR "Concreting this week" on the quality dashboard: W1 = 70 m³, W2 = 85 m³.

**Registers:**

| Register | Entries |
|---|---|
| Milestones | M1 Site mobilisation (plan 14 days / actual 14) · M2 Foundations (45 / 48) · M3 PEB erection (60 / —) |
| Hindrance | "Rain — 1 day lost, 3 Oct" (Weather, 1 day, Closed) · "Client drawing S-201 pending" (Design, 4 days, Open) |
| Risk | "Monsoon extension delays foundations" · Probability 3 · Consequence 4 · Open |
| Legal approvals | "Factory licence amendment" (Authority: Factories Dept., Open) · "Fire NOC" (Open) |
| Lessons learnt | "Order PEB anchor bolts with the foundation drawings" |

## 10. Cost and finance

| Item | Test data |
|---|---|
| Budget packages | Civil ₹ 9.0 Cr · PEB ₹ 4.5 Cr · MEP ₹ 3.0 Cr · Contingency ₹ 2.0 Cr |
| Purchase order | PO-VOL-001 to Qryx Infra · civil package · ₹ 8,50,00,000 |
| RA bill 1 | Gross ₹ 62,00,000 · retention 5 % · expected net before tax ₹ 58,90,000 |
| Cashflow | Planned Sep ₹ 40 L, Oct ₹ 85 L · Actual Sep ₹ 36 L, Oct ₹ 70 L (to date) |

## 11. Communication, closure and audit

- **Comms:** two meeting minutes (kick-off, weekly review) with 3 action items each, assigned to the contractor and consultant; check the next-meeting date shows on the dashboard.
- **Closure:** start the closure report; expect pending items from open NCR, RFIs and hindrance.
- **Audit / KPI:** add one finding (Medium) and one KPI subject for the site engineer.

## 12. Per-login checks

| Login | Must work | Must be refused |
|---|---|---|
| Client (twinoxis hello@) | view dashboard, drawings, reports; sign WPR; raise a concern | create RFIs, edit any register, delete |
| Consultant (twinoxis admin@) | answer RFIs; design coordination; drawing mark-ups | quality / safety / HR screens |
| Contractor (qryxtech hello@) | fill assigned checklists with photos; respond to NCR; safety records; raise RFIs | other projects, HR, cost |
| Any login | — | open a different project's URL (404) |

## 13. Reset between rounds

**UAT data → Simulate Working Days** adds more activity; **Remove simulated data** removes only what it added. To empty the project: **Manage → Clear module data** and **Clear Quality & Safety**.
