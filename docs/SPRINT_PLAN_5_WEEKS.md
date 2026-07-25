# Sharnam Portal — 5-week sprint plan (shareable)

**Goal:** Complete build + pilot verification in **5 one-week sprints**.  
**UAT:** Starts only **after one month** (Week 5 end → UAT window).  
**Cadence:** **Biweekly meetings** for module finalization (end of Week 2 and Week 4; optional Week 5 gate).  
**Pilot:** **One isolated project** loaded with client data to verify end-to-end flows.  
**Microsoft:** Connection testing (OneDrive + Outlook) runs in parallel from Week 1.  
**Sheets:** Every shared Excel becomes a **portal dashboard** — see `docs/SHEET_TO_DASHBOARD.md`.

---

## Timeline overview

| Week | Sprint focus | Biweekly? | Exit criteria |
|------|--------------|-----------|---------------|
| **1** | Shell, Master, Directory (4 users), Dashboard, Drawings checklist manager + popup fill, **Finance shell** | — | Login → dashboard → modules; Drawings upload gate; Finance tools visible |
| **2** | Quality + Safety (Excel checklist upload + **QAP**) + Comms + RFI notify; M365 dry-run | **Meeting 1 — finalize Master / Drawings / Home** | QI/Safety/QAP/Comms usable on pilot |
| **3** | Progress (incl. S-curve / MS Project / summary schedule / procurement) + Field + Reports; pilot sheet → dashboard load | — | Progress/Field/Reports + client civil views on pilot |
| **4** | Cost + Finance baseline + custom meeting sheet maker + PDF viewer + Outlook/OneDrive live test | **Meeting 2 — finalize Quality / Safety / Comms / Progress / Field** | Cost usable; meeting maker; PDF view; Graph smoke test pass |
| **5** | Snag / closure / CRM / HRMS **design only**, bug bash, UAT pack | **Gate — ready for UAT** | UAT start checklist signed |

**UAT (Month 2):** Client + Sharnam walk pilot project; formal defects → fix sprints (out of this 5-week build plan).

---

## Week 1 — Foundation & Drawings & Finance shell

**Build**

- [ ] Ops dashboard (open RFIs, alerts, diary signals, QI/Safety Ask shortcuts)  
- [ ] Module selection after dashboard  
- [ ] Master as module with tools (Projects, Directory, Roster, toggles; CRM/HRM links only)  
- [ ] Directory tools: **Office · Site · Client · Contractor**  
- [ ] Drawings: Checklist manager; upload opens **new window** for check fill → then upload  
- [ ] **Finance module shell** — Overview, Invoice, PO, RA bill, COP (detail later)  
- [ ] Deploy to Render  

**Pilot**

- [ ] Create **one** pilot project; enable only needed modules  
- [ ] Seed directory with 4 user kinds (demo or client people)  

**M365**

- [ ] Confirm Entra app + permissions list (`docs/M365_SETUP.md`)  
- [ ] Collect Tenant ID / Client ID / secret / site URL / mailbox (no secrets in git)  

---

## Week 2 — Quality, Safety, QAP, Comms + Meeting 1

**Build**

- [ ] Quality: QI form, **create checklist**, **upload Excel checklist**, choose checklist, Request QI fill  
- [ ] Quality: **QAP** tool — upload / update Quality Assurance Plan (Week-50 sheet)  
- [ ] Safety: dashboard, create / **upload Excel** checklists, Safety RFI  
- [ ] Comms: Matrix → MoM flow; Ask (PMC RFI); Email settings  
- [ ] RFI email notifications verified in outbox  

**Biweekly Meeting 1 (finalize)**

- Master, Home, Drawings (incl. checklist manager + popup fill)  
- Sign-off or punch list  

**M365**

- [ ] Dry-run: Graph token acquire in staging / Render env (no prod mail yet if preferred)  

---

## Week 3 — Progress, Field, Reports + pilot sheet data

**Build**

- [ ] Progress tools (Overview … Legal) as dashboards matching shared Progress / Milestone / Hindrance sheets  
- [ ] **S-curve** from MS Project file / sync (or Excel fallback) — **client civil visible**  
- [ ] **Project summary schedule** upload (file client shares) + view  
- [ ] **MS Project progress** view for Client  
- [ ] **Procurement plan** tool + Client view  
- [ ] Field day log / photos / Field RFIs  
- [ ] DPR / WPR packs from shared report templates  
- [ ] **Generated documents** surface on client civil side  

**Pilot isolation**

- [ ] Import **client Excel / register data** into the single pilot project only  
- [ ] Client shares **project summary schedule** file into Pilot  
- [ ] Verify: drawing upload → check fill window → publish → fill RFI → QI/Safety Ask → QAP visible  
- [ ] Verify Client can open S-curve / schedule / procurement / generated docs  

---

## Week 4 — Cost + Finance + meeting sheet maker + PDF + Microsoft live test + Meeting 2

**Build**

- [ ] Cost tools (MB, BBS, Budget, Cashflow…) — **no** commercial invoice/PO (those stay in Finance)  
- [ ] Finance: baseline registers for Invoice / PO / RA / COP (from Payment Summary style)  
- [ ] **Custom meeting sheet maker** (Comms) — create templates → use on meetings  
- [ ] **PDF upload + in-app viewer** for civil packs (summary schedule, procurement, generated MoM/progress)  
- [ ] Harden open-issue dashboard counts  

**M365 live test**

- [ ] OneDrive / SharePoint: upload one drawing + one DMS file on pilot  
- [ ] Outlook: send one RFI notice + one publish notice to test mailbox  
- [ ] **MS Project:** sync or import % for S-curve / progress (or Excel fallback recorded)  
- [ ] Record pass/fail in test log below  

**Biweekly Meeting 2 (finalize)**

- Quality (incl. Excel checklists + QAP), Safety, Comms (incl. meeting sheet maker), Progress (S-curve / schedule / procurement), Field, Reports  
- Cost + Finance interim review  
- Confirm CRM / HRMS / Snag / Closure stay on discuss-later list  
- Confirm client civil PDF / document generation visibility 

---

## Week 5 — Harden, design later modules, UAT gate

**Build / harden**

- [ ] Bug bash on pilot  
- [ ] Performance / mobile pass on dashboards  
- [ ] Docs pack for UAT (scripts + known issues)  

**Design only (no full build this week)**

- [ ] **Snag list** module outline  
- [ ] **Project closure** + client-facing pack outline  
- [ ] **CRM lead management** scope  
- [ ] **HRMS** scope  
- [ ] Finance field-level detail (if not done in Week 4)  
- [ ] Capture decisions in `docs/ROADMAP_DISCUSS_LATER.md`  

**Gate**

- [ ] All critical Week 1–4 items green  
- [ ] M365 smoke tests signed  
- [ ] Sheet → dashboard map covered for pilot  
- [ ] **UAT may start** (Month 2)  

---

## Biweekly meeting agenda (template)

1. Demo of modules in scope  
2. Pilot project walkthrough with client data  
3. Punch list (P0 / P1 / P2)  
4. Sign-off: **Final** / **Conditional** / **Rework**  
5. Next sprint priorities  
6. Discuss-later items: Snag · Closure · CRM · HRMS · Finance detail  

---

## Microsoft connection test log

| # | Test | Owner | Date | Result | Notes |
|---|------|-------|------|--------|-------|
| 1 | Entra app + admin consent | | | ☐ | |
| 2 | Graph token on Render | | | ☐ | |
| 3 | OneDrive drawing upload | | | ☐ | Pilot project |
| 4 | DMS file sync | | | ☐ | |
| 5 | Outlook RFI mail | | | ☐ | Test mailbox |
| 6 | Outlook publish notice | | | ☐ | |
| 7 | MS Project sync / import → S-curve | | | ☐ | Or Excel fallback |
| 8 | Client civil: schedule + procurement + PDF view | | | ☐ | Pilot |

Details: `docs/M365_SETUP.md`

---

## Pilot project isolation rules

1. Exactly **one** project flagged as Pilot.  
2. No mixing other projects’ data in UAT.  
3. Module toggles: only modules under test enabled.  
4. Restore / reseed from client sheets only into Pilot.  

---

## Out of this 5-week full build

- Full Snag list product  
- Full Project closure workflow  
- Full CRM lead pipeline  
- Full HRMS  
- Finance deep approvals / accounting integrations  
- Extra client marketing dashboards  
- Submittals (explicitly deferred)  

Tracked in `docs/ROADMAP_DISCUSS_LATER.md` for post-UAT / Month 2+.
