# Module test plan — two-week UAT on SPDC server

**UAT window:** **8–19 September 2026** on https://portal.spdc.in  
**Master calendar:** [SPDC_TWO_WEEK_UAT_PLAN.md](./SPDC_TWO_WEEK_UAT_PLAN.md)

One module per session **plus** role-boundary check **plus** one multi-user scenario where marked.

---

## Roles required (not just Office)

| Role | Email | Must test |
|------|-------|-----------|
| Office | office@sharnam.demo | Every module |
| Site | site@sharnam.demo | Field, DPR, safety, checklists |
| Client | client@sharnam.demo | Read-only on every client-visible module |
| Contractor | vendor@ · nkinra@ | BOQ, NCR response, fills — **no registers** |
| Stakeholder | struct@ · mep@ · pmc@ | RFI, coordination, MoM |
| IT | SPDC IT | Security S1–S10, SharePoint, backup |

---

## How to run a session

1. **Office** walks critical path on desktop  
2. **Site** repeats field/mobile flows  
3. **Client** confirms read-only (cannot upload/edit)  
4. **Vendor / stakeholder** runs parallel scenario (see M-tests in two-week plan)  
5. **IT** spot-checks security gate for that module  
6. Log bugs: screenshot + project code + user role + timestamp  
7. Mark **Pass** when critical path + role + multi-user (if any) succeed  

---

## Workflow cadence tests (in addition to modules)

| Cadence | When in UAT | Pass criteria |
|---------|-------------|---------------|
| **Daily** | Week 1 Thu–Fri, ongoing | Site publishes ≥1 DPR; checklist + safety logged same day |
| **Weekly** | Week 2 Mon | WPR Regenerate 24 sections; counts match DPR/quality seed |
| **Monthly** | Week 2 Thu | Audit KPI row + cashflow review + client WPR pack |
| **Closure** | Week 2 Thu | Snag close + lessons learnt + exports in DMS |

---

## Module checklist (final test)

| # | Module | Critical path | Office | Site | Client | Vendor | Stakeholder | Multi-user | Pass |
|---|--------|---------------|:------:|:----:|:------:|:------:|:-----------:|:----------:|:----:|
| 1 | **Master** | Project, modules, directory, sign-off register | ☐ | — | — | — | — | M6 | ☐ |
| 2 | **Drawings** | GFC, check, publish | ☐ | ☐ | ☐ | — | ☐ | M8 | ☐ |
| 3 | **DMS** | ISO folders, upload, PDF preview | ☐ | ☐ | ☐ | — | ☐ | — | ☐ |
| 4 | **Quality** | SOR, QI, NCR/CAR, cube, QAP | ☐ | ☐ | ☐ | ☐ | — | M4 | ☐ |
| 5 | **Safety** | Observations, SNCR, HSE IR | ☐ | ☐ | — | ☐ | — | — | ☐ |
| 6 | **Field** | Diary, photos, attendance | ☐ | ☐ | — | — | — | — | ☐ |
| 7 | **Progress** | Milestones, S-curve, PvA | ☐ | — | ☐ | — | — | — | ☐ |
| 8 | **Cost** | BOQ, MB, BBS, cashflow ×3 | ☐ | — | — | — | — | — | ☐ |
| 9 | **Finance** | RA / COP chain | ☐ | — | ☐ | ☐ | — | — | ☐ |
| 10 | **Comms** | Matrix, MoM, follow-up | ☐ | ☐ | ☐ | — | ☐ | M5 | ☐ |
| 11 | **Reports** | DPR, WPR, branded export | ☐ | — | ☐ | — | — | M1, M2 | ☐ |
| 12 | **HRMS** | Punch, leave, roster | ☐ | ☐ | — | — | — | — | ☐ |
| 13 | **CRM** | Comparative bid, SharePoint 05.05/05.06 | ☐ | — | — | ☐ | — | M3, M7 | ☐ |
| 14 | **Audit & KPI** | Dashboard, findings export | ☐ | — | ☐ | — | — | M6 | ☐ |
| 15 | **Closure** | Snaglist, lessons learnt | ☐ | — | ☐ | — | — | — | ☐ |

---

## Cross-cutting checks (Week 2 Fri — IT)

| Check | Pass |
|-------|:----:|
| Security S1–S10 (see two-week plan §7) | ☐ |
| Multi-user M1–M8 (parallel DB, no clash) | ☐ |
| SharePoint upload + in-app PDF preview | ☐ |
| Audit trail on upload / punch / publish / close | ☐ |
| Client cannot edit cost or upload drawings | ☐ |
| Vendor cannot edit registers | ☐ |
| Daily → weekly → monthly → closure workflow chain | ☐ |

---

## Sign-off (19 September 2026)

| Role | Name | Date | Signature |
|------|------|------|-----------|
| SPDC Project lead | | | |
| SPDC IT | | | |
| Site lead | | | |
| Client representative | | | |
| Development team | | | |

---

*Rev Sep 2026 · aligns with SPDC_TWO_WEEK_UAT_PLAN*
