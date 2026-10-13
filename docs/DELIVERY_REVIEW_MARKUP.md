# Delivery review — mark anything that looks off (handover ~15 Oct)

Portal: https://portal.spdc.in · Project: **Voltamp Transformers (Karjan)**  
Reference Excel: `WPR  23 July to 29 July.xlsx` (same file as `WPR-Client-Week-Template.xlsx` — 8 charts)  
Reference PPT: `SPDC_Arvind Limited_WPR_50.pptx` (= `templates/SPDC_WPR_CLIENT_REFERENCE.pptx` — 61 slides)

**How to use this doc:** put `[OK]` / `[FIX: …]` / `[CHANGE: …]` after any line. Reply with those marks and we patch → redeploy → re-UAT.

---

## A. What you get for the client each week (WPR)

| Deliverable | Where in app | SharePoint folder | Editable? |
|---|---|---|---|
| **Client week Excel** | Reports → WPR maker → Download client pack | `10.01_Progress_Reporting_MIS` | **Yes** — native Excel charts + sheets (July template) |
| **SPDC internal WPR Excel** | WPR maker → Download xlsx | same | Yes — full sections |
| **Client PPTX** | WPR maker → Download pptx | same | **Yes** — fills Arvind WPR_50 deck (tables + native chart slides) |
| **PDF** | Publish pack | same | View / share |

**Data that must land in the July Excel tabs**

| Sheet | Source in portal |
|---|---|
| Hinderance Register | Progress → Hindrance |
| Risk Register | Progress → Risk |
| Legal Approval Tracker | Progress → Legal approvals |
| Procurement tracker / Status | Progress → WPR trackers + Finance PR |
| Weekly Manpower | Progress → PvsA · Manpower |
| Project Cashflow | Cost / Progress cashflow |
| HSE Statistic | Safety daily log + safety records |
| Quality Statistic | Quality dashboard / QI fills |
| Cube Test | Quality → Cube Test |
| Planned Vs Actual | Progress → Planned vs Actual |
| Value Addition | Progress → WPR trackers |
| As per drawing status / Design status | Drawings register + design status |
| Communication Matrix *(appended)* | Setup / Comms → Communication matrix |

**Mark here:** Client pack charts / matrix / logos look wrong? `[ ]`

---

## B. Whole job workflow (what “done” means)

```
1 Setup (team, vendors, matrix, client logo, site pin)
2 Attendance (site days + GPS punch)
3 Drawings (register → Drawing Check → upload GFC → publish → dashboard)
4 Design coordination (issues → follow-ups → escalate RFI → markups)
5 Correspondence RFIs / concerns (raise → answer → close)
6 Quality (QI / site checklists, QAP, cubes, NCR/CAR, SOR)
7 Safety (daily log, F-01, observations, safety NCR)
8 Progress (activities, milestones, manpower, S-curve, hindrance/risk/legal)
9 Cost (budget, BOQ, MB, BBS, cashflow)
10 Finance (WO, RA bills, COP)
11 DPR × Mon–Fri (save → publish → 07.02/CIVIL)
12 WPR end of week (build from live data → client xlsx + pptx → publish 10.01)
13 Client / consultant read-only + sign-offs where allowed
```

**Mark here:** Missing step or wrong order? `[ ]`

---

## C. SharePoint storage (where files must land)

| Content | Folder |
|---|---|
| GFC / drawings / registers | `04.02_Drawings_and_Specifications` |
| Design coordination + **Drawing Check fills** | `04.04_Clash_Detection_Design_Coordination` (+ `Drawing_Checklists/`) |
| Drawing / RFI markups | `…/Markups` under drawings, coordination, or `03.06` |
| RFIs / concerns forms | `03.06_Correspondence_Control` (Open / Closed / _Registers) |
| **Quality / site / pour-card checklists** | `08.02_Inspection_Checklists_Pour_Cards` |
| QAP / quality dashboard | `08.01_Quality_Plans…` |
| Cubes | `08.03_Testing…` |
| NCR / CAR registers | `08.06_…/_Registers` (separate NCR vs CAR workbooks) |
| **Safety checklists + HSE packs** | `08.07_Hazard_Identification…/Checklists` |
| DPRs | `07.02_Daily_Site_Records/<discipline>` |
| Progress / S-curve | `07.08_Progress_Measurement_SCurve` |
| WPR packs | `10.01_Progress_Reporting_MIS` |
| RA / COP | `09.01_Interim_Bill…` |
| Client logo | `00_PROJECT_BRANDING` |

**Mark here:** Wrong folder for any type? `[ ]`

---

## D. Module → buttons (what each tool is for)

### Login shells
| Button / page | Does |
|---|---|
| Office / Site / Vendor / Client / HR / Stakeholder login | Same app, role portal |

### Project home
| Button | Does |
|---|---|
| Live project setup | Team, vendors, **communication matrix**, complete setup, invites |
| Directory (PMC/Site/Client/Contractor) | People on the job |
| Sign-off register | Signature PNG for branded exports |
| Vendors | Contractor assignments |

### Drawings hub
| Button | Does |
|---|---|
| Approval & GFC log | Upload after Drawing Check; revisions R0–R5 |
| Dashboard | Charts (location, critical, delay, org) + branded PDF |
| Master register | Planned dates, criticality, delays |
| Drawing settings | Pick-lists + load/save workbooks to SharePoint |
| Design coordination | Assign clash/issue → follow-ups ×5 → escalate RFI |
| Drawing files / library | PDF/DWG in design folders |
| Checklist manager / fill log | Drawing Check templates + fills → **04.04** |
| RFI register / Ask | Drawing-linked clarifications → **03.06** |

### DMS
| Button | Does |
|---|---|
| Document manager | Full ISO tree browse/upload/preview |

### Quality hub
| Button | Does |
|---|---|
| Dashboard | Quality KPIs |
| SOR / Site observation / Site instruction | Observation registers |
| CAR / NCR register | Separate NCR & CAR cards + downloads |
| NCR / CAR fill log | Form fills + Sync SharePoint |
| Cube Test | Cast / load / branded register |
| QAP + QAP master | Week plan + master library |
| Quality IR / Site checklist masters & fills | Templates + fills → **08.02** |
| Request for Inspection (F-01) | Raise / assign IR |
| Quality files | SharePoint 08 tree |
| Vendor: NCR/CAR to answer | Contractor response desk |

### Safety hub
| Button | Does |
|---|---|
| Dashboard | HSE one-pager |
| Site instruction / Unsafe act / NCR / Observation / HIRA / Safety hours | Sheet registers |
| Safety checklist master / fills | Safety fills → **08.07/Checklists** |
| Safety IR (F-01) | Work-at-height clearance |
| Safety files | HSE folder |
| Vendor: NCR & safety responses | Contractor desk |

### Inspection hub
| Button | Does |
|---|---|
| Quality IR / Safety IR / Activity F-02 | Registers + fill windows |
| Fill reports | Branded closed fills |

### Progress hub
| Button | Does |
|---|---|
| Overview / Milestones / PvsA tabs | Live progress data → **feeds WPR** |
| Hindrance / Risk / Legal | Registers → WPR sheets |
| WPR trackers | Value addition, procurement, materials |
| S-curve / MS Project | Planned % for DPR/WPR |
| Progress files | DPR/WPR SharePoint |

### Comms hub
| Button | Does |
|---|---|
| Communication matrix | Who is TO/CC (TECHNICAL + COMMERCIAL) → WPR matrix + NCR “Attention to” |
| Agenda / MoM / Follow-up / Comm log | Meetings → 03.08 |
| Day log / Photos | Site notes & albums → DPR |
| Email / Outlook | Outbox (when live mail on) |

### Cost / Finance / Reports
| Button | Does |
|---|---|
| BOQ / MB / BBS / Budget / Cashflow | Cost sheets → WPR cashflow & CAPEX |
| PR Tracker / RA / COP / invoices | Commercial path |
| **DPR maker** | Daily CIVIL (etc.) publish |
| **WPR maker** | Week pack: SPDC xlsx + **client July pack** + **Arvind PPTX** |
| DPR/WPR files | Review published packs |

### Closure / Audit KPI / HRM
| Area | Does |
|---|---|
| Closure | Snag / lessons / handover |
| Audit KPI | Findings, site walk, role KRA |
| HRM (`/hrm`) | Company HR — attendance, leave, payroll, letters (not project WPR) |

**Mark here:** Button missing / wrong label / should be hidden for a role? `[ ]`

---

## E. Roles (who may do what)

| Role | Typical actions |
|---|---|
| Office (PMC) | Setup, registers, close RFIs/NCRs, certify bills, **publish WPR** |
| Site | Attendance, DPRs, raise RFIs/NCRs, Drawing Check, safety daily |
| Planning | Activities, milestones, manpower, S-curve |
| Vendor | Fill assigned checklists, answer NCR/CAR, raise RA bills |
| Client | Read, concerns, client signature on QI — **no** GFC upload / WPR edit |
| Consultant | Answer RFIs, markups (on matrix) |

**Mark here:** Permission wrong? `[ ]`

---

## F. Known gaps / status (14 Oct)

| # | Item | Status | Your mark |
|---|---|---|---|
| 1 | Client WPR Excel = July template with **8 charts** | Fixed (was wrong `WPR File.xlsx` on prod) | `[ ]` |
| 2 | Communication Matrix tab + Sharnam/client logos on Excel | Fixed | `[ ]` |
| 3 | PPTX from Arvind WPR_50 (editable tables/charts) | In place via `SPDC_WPR_CLIENT_REFERENCE.pptx` | `[ ]` |
| 4 | Drawing Check → 04.04 folder | Fixed this pass | `[ ]` |
| 5 | Safety checklists → 08.07 | Fixed this pass | `[ ]` |
| 6 | Quality checklists → 08.02 | Already | `[ ]` |
| 7 | Checklist submit 504 (heavy photos / mail) | Hardened (defer SP + mail; UAT 1 photo/line) | `[ ]` |
| 8 | Bid module | Out of scope | — |
| 9 | Visual open of week Excel + PPTX in Office | **You must spot-check before handover** | `[ ]` |
| 10 | Full deep UAT green after folder + template fix | Re-run after this deploy | `[ ]` |

---

## G. Tomorrow delivery checklist

- [ ] Open Voltamp → WPR maker → download **client xlsx** — all July tabs, charts visible, matrix + logos  
- [ ] Download **pptx** — open in PowerPoint, edit a table/chart, save  
- [ ] Spot-check Drawing Check file under **04.04/Drawing_Checklists**  
- [ ] Spot-check QI fill under **08.02**, safety fill under **08.07/Checklists**  
- [ ] DPR recent list = last 15 site days; WPR report numbers sequential  
- [ ] Client login: can download WPR, cannot edit  
- [ ] Your markup on this file returned and fixed  

Workflow detail also in `docs/WORKFLOW_UAT_HANDOVER.md`.
