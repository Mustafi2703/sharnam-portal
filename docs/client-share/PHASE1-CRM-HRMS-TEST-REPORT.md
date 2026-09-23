# Phase 1 UAT — CRM, HRMS & Custom Sheets (client summary)

**Portal:** https://portal.spdc.in  
**Phase 1 scope:** Office-side CRM, full HRMS, Custom Sheet Maker (not project site modules)  
**Report date:** 24 Sep 2026  
**Environment:** Production UAT after deploy from `main`

---

## Executive summary (WhatsApp-ready — copy block below)

```
Sharnam Portal — Phase 1 test status | 24 Sep 2026

✅ Phase 1 scope (done / ready for your sign-off walkthrough)
• CRM — clients, consultants, vendors; multi contacts; portal activation from CRM; directory separate from SPDC staff
• HRMS — users & SPDC company roles; leave (CL/PL/SL etc., PL default 12); attendance calendar + Excel export; vouchers with bill upload; holidays CSV
• HR letters — SPDC Word templates (01–11); preview + generate .docx; scrollable letter desk per employee
• Custom Sheet Maker — grid, formulas, CSV + XLSX export; wide canvas layout fix

🔜 Phase 2 (starting next — see PHASE2 plan)
• Two real/demo projects — module-by-module data entry, uploads, exports
• Multi-login (office, site, client, vendor) on same records
• Drawings, quality, safety, progress, cost, comms, reports integrity checks

⚠️ Known / next polish (Phase 1)
• Letter preview = HTML draft; use Generate for exact Word match
• Comms matrix branded Excel/PDF export — in progress per change list
• Auto PDF for letters (server-side) — planned

Please confirm Phase 1 sign-off date and name two projects for Phase 2 seed data.
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
| Bid / BOQ flow | Vendor rate upload path | Partial — Phase 2 with project cost module |

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
