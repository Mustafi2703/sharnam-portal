# SPDC — UAT scenario bank (robust pre-handover testing)

**UAT window:** 8–19 September 2026  
**Portal:** https://portal.spdc.in · Password: `Demo@1234`  
**Projects:** SPDC-UAT-LIVE · SPDC-DEMO-01  

**Purpose:** Exhaustive scenario list for **test-before-handover**. Teams may **start daily use from Week 1** on passed modules — see §1 below.

**Calendar:** [SPDC_TWO_WEEK_UAT_PLAN.md](./SPDC_TWO_WEEK_UAT_PLAN.md) · **Workbook:** [12-Live-Client-UAT-Workbook.md](./12-Live-Client-UAT-Workbook.md)

---

## 1. Soft launch vs full handover

| Stage | When | Who | What they can do |
|-------|------|-----|------------------|
| **Soft launch (use while testing)** | From **Mon Sep 8** | Office, site | DMS browse/upload · directory · checklists · DPR draft/publish · attendance · read registers |
| **Soft launch +** | From **Wed Sep 10** | + vendor | NCR response · checklist fills · bid BOQs (DEMO-01) |
| **Soft launch +** | From **Mon Sep 15** | + client | Read-only WPR, progress, published GFC |
| **Soft launch +** | From **Wed Sep 17** | + stakeholders | RFI response · MoM actions |
| **Full handover** | **Fri Sep 19** sign-off | All roles | Production cut-over · real project data · no demo-only restrictions |

**Rule:** Log issues in Workbook §2 — **do not block daily work** for P2/P3 items unless IT marks **P1 stop-ship**.

---

## 2. Scenario legend

| Tag | Meaning |
|-----|---------|
| **HP** | Happy path — must pass for module sign-off |
| **EC** | Edge case — empty data, max rows, special characters |
| **NEG** | Negative — wrong role, blocked action (expect 403) |
| **MU** | Multi-user — run simultaneously with another tester |
| **EXP** | Export — branded XLSX/HTML/PDF lands in DMS/SharePoint |
| **MOB** | Mobile browser or site phone |

---

## 3. Master & directory (Day 1)

| ID | Scenario | Tag | Role | Steps | Expected | Pass |
|----|----------|-----|------|-------|----------|:----:|
| DIR-01 | Assign existing user to project | HP | Office | Directory → assign `site@` | Member appears on Site tab | ☐ |
| DIR-02 | Create new portal login via HR form | HP | Office | Directory → create user + assign | Login works same day | ☐ |
| DIR-03 | Link global vendor to project | HP | Office | Assign Bhavna from catalog | Shows under Contractor | ☐ |
| DIR-04 | Upload sign-off PNG (draw) | HP | Office | Sign-off register → draw → Save DMS | Thumbnail + file in `01.03…/Directory_Signatures` | ☐ |
| DIR-05 | Upload sign-off PNG (file upload) | HP | Site | Own row → upload scanned sign | Only self or office can update | ☐ |
| DIR-06 | Vendor company signatory | HP | Office | Project vendor row → signature | DMS file named for company | ☐ |
| DIR-07 | Wrong user updates another signature | NEG | Site | Try update office member sign | 403 or UI disabled | ☐ |
| DIR-08 | Work packages save | HP | Office | Work packages panel → save | Persists on reload | ☐ |
| DIR-09 | Four user-kind tabs populated | HP | Office | PMC / Site / Client / Contractor tabs | Counts match assignments | ☐ |
| DIR-10 | Sign-off used in checklist export | EXP | Office | Export checklist without fill sign | Directory PNG in Excel sign block | ☐ |

---

## 4. DMS & SharePoint (Day 1)

| ID | Scenario | Tag | Role | Steps | Expected | Pass |
|----|----------|-----|------|-------|----------|:----:|
| DMS-01 | Browse full ISO tree | HP | Office | Open DMS root → expand 08 Quality | All seeded folders visible | ☐ |
| DMS-02 | PDF in-app preview | HP | Office | Open seeded PDF | Renders without download-only | ☐ |
| DMS-03 | Upload PDF to HSE folder | HP | Site | Upload 2 MB PDF | Listed + SharePoint path | ☐ |
| DMS-04 | Open in SharePoint ↗ | HP | IT | Click external link | Same file on tenant | ☐ |
| DMS-05 | Upload to wrong project URL | NEG | Office | Manually swap projectId in URL | 403 / empty | ☐ |
| DMS-06 | Upload 30 MB file | NEG | Office | Oversized upload | Rejected with clear error | ☐ |
| DMS-07 | Client opens granted folder | HP | Client | DMS read-only browse | Preview works, no upload button | ☐ |
| DMS-08 | Matrix party folder access | HP | Stakeholder | Open comms-linked folder | Read per matrix rules | ☐ |
| DMS-09 | Module files panel (Quality files) | HP | Office | Quality → Quality files | Portal rows + SharePoint browse | ☐ |
| DMS-10 | Concurrent uploads same folder | MU | Office×2 | Two different PDFs same folder | Both files unique names | ☐ |

---

## 5. Drawings & design (Day 2)

| ID | Scenario | Tag | Role | Steps | Expected | Pass |
|----|----------|-----|------|-------|----------|:----:|
| DWG-01 | GFC register filter published | HP | Office | Drawings → GFC register | R3/R4 published visible | ☐ |
| DWG-02 | Master drawing register export | EXP | Office | Master register → download | Branded/register XLSX | ☐ |
| DWG-03 | Drawing check fill + submit | HP | Site | Checklist overlay on drawing | Fill log entry | ☐ |
| DWG-04 | Publish new revision | HP | Office | Upload → check gate → publish | Revision increments | ☐ |
| DWG-05 | Client sees published only | NEG | Client | Browse GFC | No draft/unpublished rows | ☐ |
| DWG-06 | Design coordination create | HP | Office | New issue → assign struct@ | Email/assignee set | ☐ |
| DWG-07 | Follow-up 1 of 5 | HP | Office | Send follow-up | Count increments | ☐ |
| DWG-08 | Escalate to RFI | HP | Office | Escalate open issue | RFI created linked | ☐ |
| DWG-09 | RFI-UAT-2026-142 download | EXP | Office | Open RFI → XLSX + HTML | Branded export in DMS | ☐ |
| DWG-10 | Drawing files PDF preview | HP | Office | Drawing library | PDF/DWG links work | ☐ |
| DWG-11 | Concurrent publish + client view | MU | Office+Client | Publish while client refreshes | Client sees new rev after publish only | ☐ |
| DWG-12 | Vendor cannot publish GFC | NEG | Vendor | Attempt publish | Blocked | ☐ |

---

## 6. Quality (Day 3)

| ID | Scenario | Tag | Role | Steps | Expected | Pass |
|----|----------|-----|------|-------|----------|:----:|
| QLT-01 | Quality dashboard loads KPIs | HP | Office | Quality → dashboard | Tiles populated from seed | ☐ |
| QLT-02 | SOR log tab | HP | Office | SOR log | Rows from seed | ☐ |
| QLT-03 | QI checklist fill all items | HP | Site | Checklists → QI → photos×3 + sign | Submitted status | ☐ |
| QLT-04 | Branded checklist XLSX | EXP | Office | Download submission | Logo + sign blocks | ☐ |
| QLT-05 | NCR-Q-UAT-018 open form | HP | Office | Open → Save | Contractor email triggered | ☐ |
| QLT-06 | Contractor corrective action | HP | Vendor | Open link → fill → Save | Office notify | ☐ |
| QLT-07 | NCR follow-up email | HP | Office | Send follow-up | Contractor reminder | ☐ |
| QLT-08 | NCR close + DMS export | EXP | Office | Close NCR | XLSX/HTML in quality folder | ☐ |
| QLT-09 | CAR-UAT-007 same loop | HP | Office+Vendor | Repeat NCR flow for CAR | CAR prefix preserved | ☐ |
| QLT-10 | Raise new NCR from portal | HP | Site | Quality → Raise NCR | New row with NCR- prefix | ☐ |
| QLT-11 | Cube register — log cast | HP | Site | Cube → new row test agency | Appears in DPR hints | ☐ |
| QLT-12 | QAP Week 50 load template | HP | Office | QAP → Load Week 50 | ~295 lines | ☐ |
| QLT-13 | Inspection register F-01 export | EXP | Site | Inspection → Quality IR | Excel + PDF | ☐ |
| QLT-14 | Office close vs vendor fill same NCR | MU | Office+Vendor | Simultaneous | Audit coherent; no 500 | ☐ |
| QLT-15 | Vendor cannot delete NCR row | NEG | Vendor | Attempt delete | Blocked | ☐ |
| QLT-16 | Client read-only quality | NEG | Client | Attempt raise NCR | Blocked or read-only UI | ☐ |

---

## 7. Safety & HSE (Day 4)

| ID | Scenario | Tag | Role | Steps | Expected | Pass |
|----|----------|-----|------|-------|----------|:----:|
| SAF-01 | Safety dashboard | HP | Site | Safety → dashboard | HSE stats visible | ☐ |
| SAF-02 | Log toolbox talk | HP | Site | New TBT record today | In DPR HSE block | ☐ |
| SAF-03 | Safety checklist fill | HP | Site | PPE/walkthrough template | Submit + photos | ☐ |
| SAF-04 | SNCR-UAT-003 contractor loop | HP | Office+Vendor | Save → follow-up → close | Same as quality NCR | ☐ |
| SAF-05 | HSE F-01 IR form | HP | Site | Safety IR panel | Branded export | ☐ |
| SAF-06 | Safety observation log | HP | Site | Log near miss | Not in Quality NCR | ☐ |
| SAF-07 | Safety files → SharePoint | HP | Office | Safety files tool | ISO 08.07 browse | ☐ |
| SAF-08 | Daily cadence: TBT + checklist + obs | HP | Site | All three same morning | DPR HSE section populated | ☐ |
| SAF-09 | Vendor safety checklist fill | HP | Vendor | Assigned safety template | Submit OK | ☐ |
| SAF-10 | Mobile safety checklist | MOB | Site | Fill on phone browser | Scroll + camera upload | ☐ |

---

## 8. DPR & progress (Day 5)

| ID | Scenario | Tag | Role | Steps | Expected | Pass |
|----|----------|-----|------|-------|----------|:----:|
| DPR-01 | Select date + Civil discipline | HP | Site | DPR Maker | Full page scroll, no white gap | ☐ |
| DPR-02 | Auto-fill HSE from safety seed | HP | Site | Open DPR after SAF-08 | HSE block non-empty | ☐ |
| DPR-03 | Auto-fill quality from QLT | HP | Site | Quality block matches NCR/checklist | ☐ |
| DPR-04 | Manpower table → equipment flow | HP | Site | Enter manpower rows | Equipment section follows | ☐ |
| DPR-05 | Save draft | HP | Site | Save draft | Reload preserves | ☐ |
| DPR-06 | Publish + SharePoint | EXP | Site | Publish | XLSX in `07.02…/Civil` | ☐ |
| DPR-07 | PDF print pack | EXP | Site | Download PDF/HTML | Branded daily pack | ☐ |
| DPR-08 | Second discipline same date | MU | Site+Office | Structural + Civil same day | Two separate files | ☐ |
| DPR-09 | Recent DPR panel | HP | Office | Reports → recent | Last 7 days listed | ☐ |
| DPR-10 | All 7 disciplines spot-check | EC | Site | One publish each discipline | 7 folders/files | ☐ |
| DPR-11 | Progress PvA overview | HP | Office | Progress → Overview | Filter pills work | ☐ |
| DPR-12 | PvA sync from cost | HP | Office | Sync qty/manpower | Tables update | ☐ |
| DPR-13 | S-curve from MS Project seed | HP | Office | S-curve tab | Chart renders | ☐ |
| DPR-14 | Day log + photos | HP | Site | Field diary upload | Progress folder | ☐ |
| DPR-15 | DPR publish during WPR regen | MU | Site+Office | M2 scenario | Both succeed | ☐ |

---

## 9. WPR & reports (Week 2 Mon)

| ID | Scenario | Tag | Role | Steps | Expected | Pass |
|----|----------|-----|------|-------|----------|:----:|
| WPR-01 | Load week ending seeded | HP | Office | WPR Maker → Load | 24 sections appear | ☐ |
| WPR-02 | Regenerate from DPR week | HP | Office | Regenerate | Counts match DPR/quality/safety | ☐ |
| WPR-03 | Edit section text + save | HP | Office | Edit one section | Persists | ☐ |
| WPR-04 | Section photo upload | HP | Office | Upload photo to section | DMS reference | ☐ |
| WPR-05 | Signature upload (PMC/client) | HP | Office | WPR signature blob | `…/signatures/` folder | ☐ |
| WPR-06 | Publish WPR | EXP | Office | Publish | SharePoint MIS URL | ☐ |
| WPR-07 | Client XLSX export | EXP | Office | Client XLSX | ExcelJS branded pack | ☐ |
| WPR-08 | Client PPTX export | EXP | Office | PPTX download | Slides populated | ☐ |
| WPR-09 | Client read-only WPR view | HP | Client | Reports as client | View/download only | ☐ |
| WPR-10 | WPR after 5 daily DPRs | HP | Office | After DPR-08 week | Progress slides non-zero | ☐ |
| WPR-11 | Empty week regenerate | EC | Office | New week no DPR | Graceful empty sections | ☐ |
| WPR-12 | Reports files browser | HP | Office | Reports files tool | Published packs listed | ☐ |

---

## 10. Cost, finance & CRM (Week 2 Tue)

| ID | Scenario | Tag | Role | Steps | Expected | Pass |
|----|----------|-----|------|-------|----------|:----:|
| CST-01 | Load SPDC cost template | HP | Office | Cost → load template | BOQ/MB/BBS tabs | ☐ |
| CST-02 | Cashflow chart tab | HP | Office | Cashflow → Chart | Scrolls, data visible | ☐ |
| CST-03 | Cashflow forecast tab | HP | Office | Forecast | No layout break | ☐ |
| CST-04 | Cashflow tracking tab | HP | Office | Tracking | Matches seed | ☐ |
| CST-05 | BBS per-mark shapes | HP | Office | BBS row shapes | No bulk-only dead end | ☐ |
| FIN-01 | RA-05 Certified | HP | Office | Finance → certify RA-05 | COP unlocks | ☐ |
| FIN-02 | Vendor RA-06 submission | HP | Vendor | Upload submission workbook | DMS commercial | ☐ |
| FIN-03 | Create COP | EXP | Office | COP from certified RA | Viatrix workbook filed | ☐ |
| CRM-01 | Open DEMO-01 comparative | HP | Office | CRM comparative | Bhavna + Nikhra L1/L2 | ☐ |
| CRM-02 | Vendor BOQ edit Civil | HP | vendor@ | Edit R2 Civil BOQ | Save OK | ☐ |
| CRM-03 | Nikhra BOQ edit Structural | MU | nkinra@ | Parallel different disc | 05.05 two paths | ☐ |
| CRM-04 | SharePoint 05.05 tree | HP | Office | SharePoint panel | Vendor/discipline folders | ☐ |
| CRM-05 | Master 05.06 refresh | HP | Office | After vendor save | Comparative updates | ☐ |
| CRM-06 | Award L1 | HP | Office | Award from totals | Package status Awarded | ☐ |
| CRM-07 | Vendor cannot see office cost | NEG | Vendor | Navigate to cost module | Hidden/blocked | ☐ |
| CRM-08 | BOQ save + office recompute | MU | Vendor+Office | M7 | Totals consistent | ☐ |

---

## 11. Comms, HRMS, audit (Week 2 Wed)

| ID | Scenario | Tag | Role | Steps | Expected | Pass |
|----|----------|-----|------|-------|----------|:----:|
| COM-01 | Communication matrix BPCL | HP | Office | Comms → matrix | Parties listed | ☐ |
| COM-02 | Create meeting + agenda | HP | Office | New meeting | Agenda items saved | ☐ |
| COM-03 | MoM record + action owners | HP | pmc@ | MoM entry | Actions assigned | ☐ |
| COM-04 | MoM follow-up email | HP | Office | Send follow-up | Action owners notified | ☐ |
| COM-05 | MoM XLSX export | EXP | Office | Download MoM | Branded → DMS | ☐ |
| COM-06 | Parallel RFI responses | MU | struct@+mep@ | Two RFIs | M5 — both saved | ☐ |
| HRM-01 | Attendance punch selfie+GPS | HP | Site | HRMS punch | SharePoint + IST timestamp | ☐ |
| HRM-02 | Geofence reject (if configured) | EC | Site | Punch outside fence | Clear reject message | ☐ |
| HRM-03 | Leave balance view | HP | Site | Leave balances | CL/SL/EL shown | ☐ |
| HRM-04 | Office approve leave | HP | Office | Pending requests | Status update | ☐ |
| HRM-05 | Holidays calendar | HP | All | Holidays tab | India + Gujarat | ☐ |
| AUD-01 | Audit dashboard RAG | HP | Office | Audit KPI dashboard | Rollup visible | ☐ |
| AUD-02 | Add finding NC | HP | Office | New finding | CAPA row | ☐ |
| AUD-03 | KPI subject data 127 | HP | Office | Subject health | Grid loads | ☐ |
| AUD-04 | Audit workbook XLSX | EXP | Office | Download sheet | Branded export | ☐ |
| AUD-05 | Parallel audit export + signature | MU | Office×2 | M6 | Both complete | ☐ |

---

## 12. Closure & end-to-end (Week 2 Thu)

| ID | Scenario | Tag | Role | Steps | Expected | Pass |
|----|----------|-----|------|-------|----------|:----:|
| CLS-01 | Snaglist open item | HP | Office | Closure → snag | Row visible | ☐ |
| CLS-02 | Close snag | HP | Office | Mark closed | Status closed | ☐ |
| CLS-03 | Lessons learnt entry | HP | Office | Add lesson | Handover prep row | ☐ |
| CLS-04 | Final GFC archive browse | HP | Office | DMS closure paths | Published drawings linked | ☐ |
| CLS-05 | Directory all signs complete | HP | Office | Sign-off register | All key roles have PNG | ☐ |
| E2E-01 | **Synthetic Monday** | HP | Site | Daily: TBT + QI + DPR Civil | DMS files created | ☐ |
| E2E-02 | **Synthetic Tue–Thu** | HP | Site | Repeat DPR other disciplines | 4+ DPR days | ☐ |
| E2E-03 | **Synthetic Friday WPR** | HP | Office | Regenerate + publish | Weekly pack | ☐ |
| E2E-04 | **Synthetic month-end** | HP | Office | Audit row + cashflow review | Monthly checklist | ☐ |
| E2E-05 | **Synthetic closure** | HP | Office+Client | Snag close + client WPR view | Client sees published only | ☐ |
| E2E-06 | **All roles concurrent** | MU | All 6 types | Same hour Thu Sep 18 | No 500; audit OK | ☐ |

---

## 13. Extended multi-user matrix (M9–M16)

| ID | Scenario | Users | Pass criteria | Pass |
|----|----------|-------|---------------|:----:|
| M9 | Three checklist submits same template | site + vendor×2 | Three submission rows | ☐ |
| M10 | Office WPR + site DPR + vendor NCR | office + site + vendor | All three complete | ☐ |
| M11 | Two office users edit different MoM actions | office×2 | Both actions saved | ☐ |
| M12 | Client downloads WPR while office regenerates | client + office | Client gets stable file | ☐ |
| M13 | Stakeholder RFI + office drawing publish | struct + office | Independent records | ☐ |
| M14 | HR punch + DPR publish same minute | site×2 accounts | Both punches logged | ☐ |
| M15 | CRM recompute ×2 vendor saves rapid | vendor×2 | 05.06 final state valid | ☐ |
| M16 | Full synthetic week (E2E-06) | all roles | End-to-end sign-off ready | ☐ |

---

## 14. Extended security scenarios (S11–S15)

| ID | Test | Expected | Pass |
|----|------|----------|:----:|
| S11 | Logout clears session | Re-login required | ☐ |
| S12 | Expired/invalid JWT | 401 on API | ☐ |
| S13 | SQL injection in search fields | Sanitized / no error leak | ☐ |
| S14 | XSS in remarks text | Escaped in export HTML | ☐ |
| S15 | Rate limit on login (if enabled) | Lockout or throttle message | ☐ |

---

## 15. Mobile & field scenarios (spot-check Week 1)

| ID | Scenario | Role | Pass |
|----|----------|------|:----:|
| MOB-01 | Site login on Android Chrome | Site | ☐ |
| MOB-02 | Site login on iPhone Safari | Site | ☐ |
| MOB-03 | Checklist photo capture camera | Site | ☐ |
| MOB-04 | Attendance punch camera + GPS | Site | ☐ |
| MOB-05 | DPR scroll full page mobile | Site | ☐ |
| MOB-06 | Client read-only on tablet | Client | ☐ |

---

## 16. Scenario count summary

| Area | Scenarios |
|------|----------:|
| Directory | 10 |
| DMS | 10 |
| Drawings | 12 |
| Quality | 16 |
| Safety | 10 |
| DPR / Progress | 15 |
| WPR / Reports | 12 |
| Cost / Finance / CRM | 16 |
| Comms / HRMS / Audit | 16 |
| Closure / E2E | 11 |
| Multi-user M9–M16 | 8 |
| Security S11–S15 | 5 |
| Mobile | 6 |
| **Total** | **~147** |

**Minimum for handover:** all **HP** + **NEG** + **M1–M16** + **S1–S15** pass. **EC** and **MOB** — fix P1 only before Sep 19.

---

*Rev 02 · September 2026 · SPDC UAT scenario bank*
