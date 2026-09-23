# Phase 1 UAT — CRM, HRMS & Custom Sheets (client summary)

**Portal:** https://portal.spdc.in  
**Phase 1 scope:** Office-side CRM, full HRMS, Custom Sheet Maker (not project site modules)  
**Report date:** 24 Sep 2026  
**Environment:** Production UAT after deploy from `main`

---

## Executive summary (WhatsApp-ready — copy block below)

```
Sharnam Portal — Portal update | 24 Sep 2026

✅ CRM (Phase 1 — ready to test with your data)
• Clients, consultants, vendors; multiple contacts per client
• Portal login activated from CRM only; SPDC staff stay in HRMS Users
• Communication matrix — grid + export (branded BPCL Excel/PDF still on roadmap)

✅ HRMS (Phase 1 — ready to test with your data)
• Users, departments, company roles (Director, PM, engineers, etc.)
• Leave — CL/PL/SL/Emergency/Short; PL default 12; HR approve, convert, cancel
• Attendance — site punch, calendar, Download Excel (Attendance + Leave tabs)
• Expense vouchers with bill/receipt upload; holiday CSV on Masters
• Letters — official SPDC Word templates; per-employee form; scrollable register; Generate = filled .docx

✅ Custom Sheet Maker — grid, formulas, CSV + XLSX export

✅ RFI integrity (project modules — live on portal after deploy)
• Drawing “Ask / information” RFIs only in Drawings module log
• Quality, Safety, and Inspection each have separate logs (no mixed lists)

🔜 Phase 2 — 5-day UAT plan (two projects, your test data)
Day 1 Setup & matrix · Day 2 Drawings/DMS/RFI · Day 3 Q/S/Field · Day 4 Progress/Cost/Bid/R2 · Day 5 Reports/closure/integrity
Detail: docs/client-share/PHASE2-PROJECT-MODULES-PLAN.md

⚠️ Note: Letter Preview = HTML draft; use Generate for exact Word layout.
```

---

## CRM — test areas & status

| Area | What we verified | Status |
|------|------------------|--------|
| Client add → edit | Company profile, contacts | Ready for UAT |
| Multiple client reps | Site/client contacts per client | Ready for UAT |
| Portal activation | Login from CRM only (not auto on create) | Ready for UAT |
| Consultants / vendors | CRM directory only; not HRMS users | Ready for UAT |
| Demo credentials | Set/update login from directory pages | Ready for UAT |
| Communication matrix | Data grid + export tab | Ready; branded BPCL export pending |
| Bid / BOQ flow | BOQ upload, vendor rates, R2 with 2+ vendors | Phase 2 — Day 4 |

**Suggested CRM UAT script (30–45 min):** Add client → add 2 contacts → activate portal → login as client (read-only) → add vendor → consultant type → open comms matrix → export Excel.

---

## HRMS — test areas & status

| Area | What we verified | Status |
|------|------------------|--------|
| Users | SPDC staff, departments, company roles vs portal role | Ready for UAT |
| Leave | Apply, HR approve/reject/convert/cancel, balances | Ready for UAT |
| Attendance | Site punch, calendar, register Excel (Attendance + Leave tabs) | Ready for UAT |
| Vouchers | Submit with bill/receipt attachment | Ready for UAT |
| Holidays | CSV import on Masters | Ready for UAT |
| Letters | 11 template kinds, token fill smoke test offline | Ready for UAT |
| Letter desk UI | Per-person form, scrollable register, .docx download | Ready for UAT |
| Onboarding | Offer → pack generate (offer, appointment, NDA, confirmation) | Ready for UAT |

**Suggested HRMS UAT script (45–60 min):** Pick one employee → fill letter variables → preview → generate appointment → download .docx → compare to shared SPDC template → apply leave → HR approve → attendance calendar → download Excel → voucher with PDF bill.

---

## Custom Sheet Maker — status

| Check | Status |
|-------|--------|
| Create sheet, columns, row edit | Ready |
| Formulas (SUM, IF, etc.) | Ready |
| Export CSV / XLSX | Ready |
| Layout (scroll, wide canvas) | Fixed |

---

## Phase 1 sign-off criteria

- [ ] CRM client + vendor + consultant flows signed by SPDC office user  
- [ ] HRMS leave + attendance + vouchers signed by HR  
- [ ] At least 3 letter types generated on portal and matched to Word masters  
- [ ] Custom sheet exported and opened in Excel without layout break  

**Sign-off:** Name · Role · Date · Notes

---

## Link to Phase 2

Detailed day-wise plan: [PHASE2-PROJECT-MODULES-PLAN.md](./PHASE2-PROJECT-MODULES-PLAN.md)
