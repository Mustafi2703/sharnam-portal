# Sheet connection diagrams — client share pack

**August 2026 · Sharnam PMC portal**

Open any SVG in a browser, or use the **PNG** files in the same folder for PowerPoint / Word / email.

## Diagram index

| # | File | Contents |
|---|------|----------|
| 1 | [01-master-dpr-wpr-hub.svg](./assets/01-master-dpr-wpr-hub.svg) | Master map — Cost, Progress, Quality, Safety → DPR → WPR |
| 2 | [02-quality-qap-dpr-wpr.svg](./assets/02-quality-qap-dpr-wpr.svg) | **QAP convention** — QAP vs NCR vs Cube vs QI; WPR quality seed |
| 3 | [03-safety-progress-cost-dpr.svg](./assets/03-safety-progress-cost-dpr.svg) | Safety + Progress + Cost tables → DPR/WPR blocks |
| 4 | [04-ms-project-scurve-flow.svg](./assets/04-ms-project-scurve-flow.svg) | **MS Project XML** → S-curve → DPR dashboard + WPR |
| 5 | [05-cost-module-dpr.svg](./assets/05-cost-module-dpr.svg) | Cost BOQ / MB / BBS / cashflow → DPR auto-fill |

See also [05-Sheet-Connection-Maps.md](./05-Sheet-Connection-Maps.md) for mermaid source and table reference.

## QAP convention (summary)

| Register | Purpose | Portal | Feeds |
|----------|---------|--------|-------|
| **QAP** | Weekly planned quality activities — Contractor / PMC / Client sign-off | Quality → QAP | **WPR** quality section |
| **NCR** | Site defects / non-conformance | Quality → NCR | **DPR** quality block + **WPR** |
| **Cube register** | Compressive strength tests | Quality → Cubes | **DPR** + **WPR** |
| **QI checklists** | Hold-point inspections | Checklists → Quality | **WPR** + audit trail |

**Do not** record safety observations as NCR — use **Safety** module for HSE.

## MS Project → S-curve (portal steps)

1. **Progress → MS Project** tab → **Seed demo schedule file** (demo) or **Import XML** (client file).
2. **Progress → S-curve** tab — chart from weekly `ProgressPlannedActual` rows.
3. Same schedule populates **DPR** planned hints and **WPR** progress slides.
4. XML stored under `07.08_Progress_Measurement_SCurve/MS_Project/` on project OneDrive.

Export from Microsoft Project: **File → Save As → XML Data** (not MPP binary).

## Which sheets fill DPR vs WPR

| Sheet / source | Module | DPR | WPR |
|----------------|--------|-----|-----|
| BOQ monitoring | Cost | ✓ qty rows | — |
| MB / BBS | Cost | ✓ cum / rebar | — |
| Cashflow AC | Cost | ✓ header | ✓ cost slide |
| Planned vs Actual Excel | Progress | ✓ planned hints | ✓ progress |
| MS Project XML | Progress | ✓ S-curve hints | ✓ milestones |
| Manpower | Progress | ✓ manpower | ✓ |
| Hindrance | Progress | ✓ delays | ✓ |
| Safety dashboard | Safety | ✓ HSE | ✓ safety slide |
| NCR / Cube | Quality | ✓ quality | ✓ quality |
| QAP weekly | Quality | — | ✓ QAP rows |
| Open RFIs | Comms | ✓ approvals | ✓ (if enabled) |
