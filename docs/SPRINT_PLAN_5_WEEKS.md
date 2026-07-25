# Sharnam Portal — 5-week sprint plan (shareable)

**Goal:** Complete build + pilot verification in **5 one-week sprints**.  
**UAT:** Starts only **after one month** (Week 5 end → UAT window).  
**Cadence:** **Biweekly meetings** for module finalization (end of Week 2 and Week 4; optional Week 5 gate).  
**Pilot:** **One isolated project** loaded with client data to verify end-to-end flows.  
**Microsoft:** Connection testing (OneDrive + Outlook) runs in parallel from Week 1.

---

## Timeline overview

| Week | Sprint focus | Biweekly? | Exit criteria |
|------|--------------|-----------|---------------|
| **1** | Shell, Master, Directory (4 users), Dashboard, Drawings checklist manager + popup fill | — | Login → dashboard → modules; Drawings upload gate works |
| **2** | Quality + Safety + Comms + RFI notify; M365 dry-run | **Meeting 1 — finalize Master / Drawings / Home** | QI/Safety/Comms usable on pilot |
| **3** | Progress + Field + Reports; pilot data load | — | Progress/Field/Reports on pilot project |
| **4** | Cost + Outlook/OneDrive live test; harden notifications | **Meeting 2 — finalize Quality / Safety / Comms / Progress / Field** | Cost usable; Graph send/upload smoke test pass |
| **5** | Snag/closure **design only**, bug bash, UAT pack | **Gate — ready for UAT** | UAT start checklist signed |

**UAT (Month 2):** Client + Sharnam walk pilot project; formal defects → fix sprints (out of this 5-week build plan).

---

## Week 1 — Foundation & Drawings

**Build**

- [ ] Ops dashboard (open RFIs, alerts, diary signals, QI/Safety Ask shortcuts)  
- [ ] Module selection after dashboard  
- [ ] Master as module with tools (Projects, Directory, Roster, CRM, HRM, toggles)  
- [ ] Directory tools: **Office · Site · Client · Contractor**  
- [ ] Drawings: Checklist manager; upload opens **new window** for check fill → then upload  
- [ ] Deploy to Render  

**Pilot**

- [ ] Create **one** pilot project; enable only needed modules  
- [ ] Seed directory with 4 user kinds (demo or client people)  

**M365**

- [ ] Confirm Entra app + permissions list (`docs/M365_SETUP.md`)  
- [ ] Collect Tenant ID / Client ID / secret / site URL / mailbox (no secrets in git)  

---

## Week 2 — Quality, Safety, Comms + Meeting 1

**Build**

- [ ] Quality: QI form, checklists, Request QI fill  
- [ ] Safety: dashboard, checklists, Safety RFI  
- [ ] Comms: Matrix → MoM flow; Ask (PMC RFI); Email settings  
- [ ] RFI email notifications verified in outbox  

**Biweekly Meeting 1 (finalize)**

- Master, Home, Drawings (incl. checklist manager + popup fill)  
- Sign-off or punch list  

**M365**

- [ ] Dry-run: Graph token acquire in staging / Render env (no prod mail yet if preferred)  

---

## Week 3 — Progress, Field, Reports + pilot data

**Build**

- [ ] Progress tools (Overview … Legal) clean Workday-style  
- [ ] Field day log / photos / Field RFIs  
- [ ] DPR / WPR packs  

**Pilot isolation**

- [ ] Import **client Excel / register data** into the single pilot project only  
- [ ] Verify: drawing upload → check fill window → publish → fill RFI → QI/Safety Ask  

---

## Week 4 — Cost + Microsoft live test + Meeting 2

**Build**

- [ ] Cost tools (MB, BBS, Budget, Cashflow, Bills…)  
- [ ] Harden open-issue dashboard counts  

**M365 live test**

- [ ] OneDrive / SharePoint: upload one drawing + one DMS file on pilot  
- [ ] Outlook: send one RFI notice + one publish notice to test mailbox  
- [ ] Record pass/fail in test log below  

**Biweekly Meeting 2 (finalize)**

- Quality, Safety, Comms, Progress, Field, Reports  
- Cost interim review  

---

## Week 5 — Harden, design later modules, UAT gate

**Build / harden**

- [ ] Bug bash on pilot  
- [ ] Performance / mobile pass on dashboards  
- [ ] Docs pack for UAT (scripts + known issues)  

**Design only (no full build this week)**

- [ ] **Snag list** module outline  
- [ ] **Project closure** + client-facing pack outline  
- [ ] Capture decisions in `docs/ROADMAP_SNAG_CLOSURE.md`  

**Gate**

- [ ] All critical Week 1–4 items green  
- [ ] M365 smoke tests signed  
- [ ] **UAT may start** (Month 2)  

---

## Biweekly meeting agenda (template)

1. Demo of modules in scope  
2. Pilot project walkthrough with client data  
3. Punch list (P0 / P1 / P2)  
4. Sign-off: **Final** / **Conditional** / **Rework**  
5. Next sprint priorities  

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

Details: `docs/M365_SETUP.md`

---

## Pilot project isolation rules

1. Exactly **one** project flagged as Pilot.  
2. No mixing other projects’ data in UAT.  
3. Module toggles: only modules under test enabled.  
4. Restore / reseed from client sheets only into Pilot.  

---

## Out of this 5-week build

- Full Snag list product  
- Full Project closure workflow  
- Extra client marketing dashboards  
- Submittals (explicitly deferred)  

These are tracked for post-UAT / Month 2+.
