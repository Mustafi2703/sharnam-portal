# SPDC — Two-week UAT plan (Sep 8–19, 2026)

**Portal:** https://portal.spdc.in  
**Projects:** SPDC-UAT-LIVE (full pack) · SPDC-DEMO-01 (CRM bids)  
**Password:** `Demo@1234`  
**Goal:** **~147 test scenarios** (see scenario bank) · module finals · security · multi-user · daily → closure workflows — **all roles**  
**Handover:** Formal sign-off **Fri Sep 19** · **Soft launch from Mon Sep 8** — teams start using passed modules immediately while testing continues.

**Companion docs:** [SPDC_UAT_SCENARIO_BANK.md](./SPDC_UAT_SCENARIO_BANK.md) · [SPDC_MODULE_DELIVERY_STATUS.md](./SPDC_MODULE_DELIVERY_STATUS.md) · [12-Live-Client-UAT-Workbook.md](./12-Live-Client-UAT-Workbook.md)

---

## 0. Test hard · use early · hand over once

| Principle | Detail |
|-----------|--------|
| **Robust testing** | ~147 scenarios — happy path, edge cases, negative role checks, multi-user, mobile spot-checks |
| **Use while testing** | Office + site **from Day 1** on DMS, directory, checklists, DPR; vendors from Day 3; client from Week 2 Mon |
| **Log, don’t block** | P2/P3 issues logged in Workbook §2 — daily work continues unless IT marks **P1 stop-ship** |
| **Handover gate** | Fri Sep 19 — all HP + NEG + M1–M16 + S1–S15 pass · leadership signatures |

### Soft launch schedule (start using before full sign-off)

| From | Roles unlocked for real work | Modules safe to use daily |
|------|------------------------------|---------------------------|
| **Mon Sep 8** | Office, site, IT | DMS · directory · sign-off register · browse all registers |
| **Wed Sep 10** | + vendor | + checklist fills · NCR response · quality/safety field |
| **Mon Sep 15** | + client | + read-only WPR · progress · published GFC |
| **Wed Sep 17** | + stakeholder | + RFI response · MoM actions |
| **Fri Sep 19** | All — **full handover** | Production cut-over · real project data |

---

## 1. Who tests (every session)

| Role | Login | Portal | Tests in every week |
|------|-------|--------|---------------------|
| **Office / PMC** | `office@sharnam.demo` | `/login/office` | Registers, publish, close, WPR, cost, CRM |
| **Site** | `site@sharnam.demo` | `/login/site` | DPR, checklists, attendance, safety field |
| **Contractor (Bhavna)** | `vendor@sharnam.demo` | `/login/vendor` | BOQ, NCR response, checklist fill |
| **Contractor (Nikhra)** | `nkinra@sharnam.demo` | `/login/vendor` | Second bidder, parallel BOQ, RFI |
| **Client** | `client@sharnam.demo` | `/login/client` | Read-only reports, GFC, progress |
| **Stakeholder (Struct)** | `struct@sharnam.demo` | `/login/stakeholder` | RFI response, coordination |
| **Stakeholder (MEP)** | `mep@sharnam.demo` | `/login/stakeholder` | Parallel RFI / coordination |
| **PMC partner** | `pmc@sharnam.demo` | `/login/stakeholder` | MoM, matrix desk |
| **IT** | SPDC IT account | Office | Security S1–S10, SharePoint, backup |

---

## 2. Workflow cadence under test

Each cadence is exercised on UAT with **real multi-user input** (not demo-only viewing).

| Cadence | Portal workflows | Roles | DMS / SharePoint output |
|---------|------------------|-------|-------------------------|
| **Daily** | Safety TBT · QI/Safety checklist fill · cube log · DPR publish (1+ discipline) · attendance punch | Site, vendor | `07.02…/{discipline}`, HSE, quality drafts |
| **Weekly** | QAP sign-off · WPR Regenerate (24 sections) · MoM follow-up · progress PvA sync · open NCR review | Office, site, client | `10.01…/WPR`, comms MoM exports |
| **Monthly** | Audit KPI rollup · cashflow chart review · client WPR pack · RA/COP stage check · comparative bid refresh | Office, client, vendor | Commercial + MIS folders |
| **Project closure** | Snaglist close-out · lessons learnt · final GFC archive · directory sign-off complete · register exports | Office, client, site | Closure + archive ISO paths |

**End-to-end proof (Week 2, Day 9):** Run one **synthetic week** — Mon–Fri daily DPR + Fri WPR + month-end audit row + snag close — with site + office + vendor + client logged in concurrently.

---

## 3. Week 1 — Module finals + daily/weekly base (Sep 8–12)

| Day | Date | Focus | Modules | Multi-user / security | Scenario IDs |
|-----|------|-------|---------|------------------------|--------------|
| **Mon** | Sep 8 | Kick-off · roles · DMS · directory | Master, Directory, DMS, sign-off register | **S1–S5** · all roles login | **DIR-01–10 · DMS-01–10** |
| **Tue** | Sep 9 | Design & comms | Drawings, RFIs, coordination, Comms matrix | **M5** · **S2** | **DWG-01–12 · COM-06** |
| **Wed** | Sep 10 | Quality loop | QI, NCR/CAR, inspection, cubes, QAP | **M4** · **S3–S4** | **QLT-01–16** · vendors soft launch |
| **Thu** | Sep 11 | Safety & site daily | Safety NCR, HSE IR, checklists, attendance | Daily cadence · **MOB-01–04** | **SAF-01–10** |
| **Fri** | Sep 12 | DPR & progress | DPR 7 disciplines, PvA, photos, diary | **M1 · M2 · M15** | **DPR-01–15** |

**Week 1 exit criteria:** Phases A–C pass · daily workflow documented · issues logged in UAT Workbook §2.

---

## 4. Week 2 — Commercial, cadence, security hardening (Sep 15–19)

| Day | Date | Focus | Modules | Multi-user / security | Scenario IDs |
|-----|------|-------|---------|------------------------|--------------|
| **Mon** | Sep 15 | Weekly & reports | WPR 24 sections, client XLSX/PPTX | Weekly · client verify | **WPR-01–12 · M12** |
| **Tue** | Sep 16 | Commercial | Cost, cashflow, Finance, CRM | **M3 · M7 · M15** | **CST-01–05 · FIN-01–03 · CRM-01–08** |
| **Wed** | Sep 17 | People & audit | HRMS, Audit KPI, Inspection | **M6 · M11** · stakeholders | **COM-01–05 · HRM-01–05 · AUD-01–05** |
| **Thu** | Sep 18 | Monthly + closure | Synthetic week · snag · lessons | **M8 · M16 · E2E-01–06** | **CLS-01–05 · E2E-01–06** |
| **Fri** | Sep 19 | **Final gate** | Re-test P1 · sign-off | **S6–S15 · M1–M16** | All open HP/NEG retest |

**Week 2 exit criteria:** All **HP** scenarios pass · M1–M16 · S1–S15 · leadership sign-off · **production handover**.

Full scenario list: **[SPDC_UAT_SCENARIO_BANK.md](./SPDC_UAT_SCENARIO_BANK.md)** (~147 cases).

---

## 5. Per-module final test checklist (tick during two weeks)

Each module: **(a)** single-user critical path · **(b)** role boundary · **(c)** multi-user row · **(d)** export to DMS.

| # | Module | Final test (critical path) | Roles | Multi-user | Sec | Pass |
|---|--------|---------------------------|-------|------------|-----|:----:|
| 1 | Master & directory | Create/link party · sign-off PNG → DMS | Office | M6 | S7 | ☐ |
| 2 | Drawings / GFC | Upload → check → publish · client sees published only | Office, client | M8 | S3 | ☐ |
| 3 | DMS | ISO tree · upload · SharePoint link | Office, IT | — | S8 | ☐ |
| 4 | Quality | NCR loop · checklist branded XLSX · cube · QAP | Office, site, vendor | M4 | S4 | ☐ |
| 5 | Safety | SNCR loop · HSE IR · safety checklist | Site, office | — | S4 | ☐ |
| 6 | Inspection | F-01/F-02 export Excel + PDF | Site, office | — | — | ☐ |
| 7 | Comms & RFIs | Matrix · MoM follow-up · RFI close → DMS | Office, stakeholder | M5 | — | ☐ |
| 8 | Progress & PvA | S-curve · PvA sync from cost | Office, client | — | S2 | ☐ |
| 9 | Cost & cashflow | BOQ · MB · BBS · 3 cashflow tabs | Office | — | — | ☐ |
| 10 | Finance | RA certified → COP · vendor submission | Office, vendor | — | S4 | ☐ |
| 11 | DPR | Publish discipline day · PDF · SharePoint | Site, office | M1, M2 | — | ☐ |
| 12 | WPR | Regenerate 24 sections · Client XLSX | Office, client | M2 | — | ☐ |
| 13 | CRM & bids | Two bidders · 05.05/05.06 · L1 | Office, vendor×2 | M3, M7 | — | ☐ |
| 14 | HRMS | Punch · leave · roster | Site, office | — | S6 | ☐ |
| 15 | Audit & KPI | Dashboard · finding · workbook export | Office | M6 | S6 | ☐ |
| 16 | Closure | Snag close · lessons learnt | Office, client | — | — | ☐ |
| 17 | Client portal | Read-only all modules · no upload | Client | M8 | S3 | ☐ |
| 18 | Contractor portal | BOQ · fills · no register edit | Vendor×2 | M3, M4 | S4 | ☐ |

---

## 6. Multi-user parallel database test matrix (run Week 2 Fri + spot-check daily)

Run on **SPDC-UAT-LIVE** with separate browsers/incognito. **Pass = no 500 errors, no cross-project rows, audit log correct.**

| ID | Scenario | Users (simultaneous) | DB / files to verify after |
|----|----------|----------------------|----------------------------|
| M1 | Two DPR disciplines, same date | site ×2 (or site + office) | Two XLSX paths under `07.02…` |
| M2 | DPR publish + WPR regenerate | site + office | Both completes; WPR counts match DPR |
| M3 | Two vendor BOQ saves | vendor@ + nkinra@ | Two files in 05.05; 05.06 consistent |
| M4 | NCR close + contractor action | office + vendor | Audit trail; final status coherent |
| M5 | Two RFI responses | struct@ + mep@ | Two response rows; no overwrite |
| M6 | Signature upload + XLSX export | office ×2 | Both files in DMS |
| M7 | BOQ save + comparative recompute | vendor + office | Comparative totals match |
| M8 | Drawing publish + client browse | office + client | Client never sees draft revision |
| M9 | Three checklist submits same template | site + vendor×2 | Three distinct submission rows |
| M10 | WPR + DPR + NCR same window | office + site + vendor | All three complete |
| M11 | Two MoM action edits | office×2 | Both actions saved |
| M12 | Client WPR download during regenerate | client + office | Stable file for client |
| M13 | Stakeholder RFI + drawing publish | struct + office | Independent records |
| M14 | Dual attendance punch same minute | site×2 | Both logged with audit |
| M15 | Rapid dual vendor BOQ saves | vendor×2 | 05.06 valid final state |
| M16 | Full synthetic week all roles | all 6 types | E2E-06 pass |

---

## 7. Security gate checklist (IT — Week 1 Mon + Week 2 Fri)

| Gate | Test | Pass |
|------|------|:----:|
| S1 | Unauthenticated `/api/*` → 401 | ☐ |
| S2 | Cross-project URL → no data | ☐ |
| S3 | Client upload blocked | ☐ |
| S4 | Vendor register edit blocked | ☐ |
| S5 | Oversized upload rejected | ☐ |
| S6 | Audit log on close/publish/punch | ☐ |
| S7 | Directory signature: self or office only | ☐ |
| S8 | SharePoint path scoped to project code | ☐ |
| S9 | Token invalid after credential change | ☐ |
| S10 | No secrets in git; prod env on server | ☐ |
| S11 | Logout clears session | ☐ |
| S12 | Invalid JWT → 401 | ☐ |
| S13 | Injection in search fields sanitized | ☐ |
| S14 | XSS in remarks escaped in exports | ☐ |
| S15 | Login rate limit (if enabled) | ☐ |

---

## 8. Daily stand-up template (15 min, each UAT day)

1. **Yesterday:** modules ticked · failures logged in Workbook §2  
2. **Today:** day row from §3 or §4 · who plays which role  
3. **Blockers:** IT / SharePoint / SMTP  
4. **Multi-user slot:** which M-test runs today  

---

## 9. Sign-off (Sep 19, 2026)

| Role | Name | Date | Signature |
|------|------|------|-----------|
| SPDC Project Director | | | |
| SPDC IT | | | |
| PMC Office lead | | | |
| Site lead | | | |
| HSE / Quality lead | | | |
| Client representative | | | |
| Development team | | | |

---

*Sharnam PMC · Two-week UAT plan · Sep 8–19, 2026 · Rev 02 · ~147 scenarios in SPDC_UAT_SCENARIO_BANK.md*
