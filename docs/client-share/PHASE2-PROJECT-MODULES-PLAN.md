# Phase 2 — Project modules UAT (5-day plan)

**Follows:** Phase 1 (CRM, HRMS, Custom Sheets) — [PHASE1-CRM-HRMS-TEST-REPORT.md](./PHASE1-CRM-HRMS-TEST-REPORT.md)  
**Portal:** https://portal.spdc.in  
**Data:** SPDC test data — entered together during sessions (two projects in parallel where useful).

---

## Objectives

1. Load **your test data** into each project module on **Project A** and **Project B**.
2. Confirm **RFI integrity** — drawing information RFIs only under Drawings; Quality, Safety, and Inspection each keep their own logs (no cross-mix in lists).
3. **Multi-login** — office, site, client, vendor on the same records where applicable.
4. **Bid management** — BOQ without rates → vendor notification → rate upload → comparative / R2 when 2+ vendors.
5. Short **pass/fail trace** per module for sign-off.

---

## Roles (use each day as needed)

| Role | Typical use in Phase 2 |
|------|-------------------------|
| Office | Registers, uploads, raises RFIs, bid open/close |
| Site | Field, DPR, quality/safety fills, attendance punch |
| Client | Read-only + sign-offs |
| Vendor | BOQ rates, checklist fills, NCR reply |
| HR | Cross-check attendance vs site punch (optional same week) |

---

## 5-day calendar (one focus per day)

| Day | Modules & tests | Both projects |
|-----|-----------------|---------------|
| **1** | **Setup & CRM touchpoints** — project directory, vendors/clients linked, communication matrix rows + export; sanity on portal logins | A + B setup |
| **2** | **Drawings + DMS + RFI (drawings only)** — GFC/register, revisions, checklist master + fill log; Ask (PMC RFI) + drawing checklist requests; download RFI register XLSX; DMS uploads + preview; **confirm Quality/Safety RFIs do not appear in drawing log** | A deep, B spot-check |
| **3** | **Quality · Safety · Inspection · Field** — SOR/QI/NCR, cube/QAP; safety obs/SNCR/checklist; Inspection IR register (Quality IR / Safety IR / activity); site diary + photos; attendance punch vs HRMS calendar | A + B |
| **4** | **Progress · Cost · Finance · Bid management** — milestones / PvA; **PMC uploads BOQ (no rates)** → open to vendors → vendor upload rates (portal or download/upload) → **R2 / comparative statement with 2+ vendors**; RA/COP row if in scope; SharePoint save paths where enabled | A + B |
| **5** | **Comms · Reports · Closure · integrity** — MoM/follow-up; DPR → WPR regenerate → export sample; snag + lessons learnt; **multi-user parallel** (office RFI + vendor fill + client read-only); integrity sheet (counts, dates, roles, re-download files) | A + B sign-off |

---

## RFI integrity checklist (Day 2 + Day 5)

| Check | Pass |
|-------|:----:|
| Drawings module log shows only Request for Information / drawing checklist / manual | ☐ |
| Quality module log shows only quality inspection / site execution fills | ☐ |
| Safety module log shows only safety checklist (and HSE IR if raised from safety) | ☐ |
| Inspection module log shows Quality IR / Safety IR / activity only | ☐ |
| Same RFI number does not appear in wrong module filter | ☐ |
| Register export row count matches on-screen filtered list | ☐ |

---

## Bid management checklist (Day 4)

| Step | Pass |
|------|:----:|
| PMC uploads BOQ for project (rates blank or hidden from vendor view) | ☐ |
| Vendors notified / can access bid workspace | ☐ |
| Vendor submits rates via portal or re-upload workflow | ☐ |
| Rates stored (SharePoint / portal) and visible to office only | ☐ |
| With **two vendors**, comparative / **R2 statement** generates correctly | ☐ |
| Vendor cannot edit master BOQ or other vendors’ rates | ☐ |

---

## Data integrity (Day 5)

| Check | Pass |
|-------|:----:|
| Register totals = list filters (RFI, NCR, snag, etc.) | ☐ |
| WPR/DPR dates and counts align with entered field/quality data | ☐ |
| Client login cannot upload drawings or edit cost/BOQ | ☐ |
| Generated .docx / xlsx / exports open after refresh | ☐ |
| Project A data not visible on B without membership | ☐ |

---

## Deliverables

- Updated rows in [03-Module-Test-Plan.md](./03-Module-Test-Plan.md) for both projects  
- Simple trace: module · record ref · tester · date · pass/fail  
- Bug log with role + project + screenshot  

---

## References

- `docs/client-testing/00-MASTER-INDEX.md`  
- `docs/client-testing/modules/*.md`
