# UAT evidence plan — new project, every module, every login

A fresh project (**SPDC-UAT-NN · UAT Warehouse, Sanand** — a new code per run, `UAT_PROJECT=SPDC-UAT-02`) is set up from nothing and each module is exercised with the
client's own sheet layouts. Every step leaves one screenshot named by its evidence ID (`B3-boq-sections.png` …).
The automated run (`scripts/uat-evidence/run.mjs`) produces the screenshots and an evidence index; testers repeat
the same IDs on the live portal and attach their own screenshots against them.

**Logins** — office `operations@spdc.in` · site `hitesh.rajput@spdc.in` · vendor `site@bhavanainfra.demo`
(Bhavana Infra) · client `projects@arvind.demo` · admin for setup only.
**Cadence** — D = daily, W = weekly, P = project / as needed.

## A. Project setup (office · P)

| ID | Step | Expected |
|---|---|---|
| A1 | Projects → New project: code, name, client, dates | Project card created, ISO SharePoint folders made |
| A2 | Project setup: add site employee + planning; assign vendor Bhavana Infra; project card client = Arvind Limited / `projects@arvind.demo` | Team + vendor listed; client portal linked to the project |
| A3 | Site employees check in (selfie + GPS at site) | Attendance logged — site tools open only after check-in |

## B. Cost — from the SPDC Budget workbook (office · P / W)

| ID | Step | Expected |
|---|---|---|
| B1 | Cost → Upload the SPDC budget workbook (`SPDC_Budget_*.xls`) | Every tab loaded: Budget WBS, Monitoring per package, MB, BBS, rate differences |
| B2 | Budget WBS: + Heading, + Budget line (budgeted, WO, certified, forecast) | Heading band + line saved, totals roll up |
| B3 | BOQ monitoring: + Section, + Subsection, + Item (rate, BOQ qty, GFC qty) | Section › subsection bands with the item under them |
| B4 | **site** MB: + Heading, + measurement row (nos × L × B × H) | Qty computed; achieved qty rolls to the BOQ item |
| B5 | **site** BBS: + bar row (dia, shape, cutting length m, nos) | Weight = d² / 162 × total m (16 mm × 43.2 m = 68.27 kg) |
| B6 | Cashflow: + period (planned / actual) | Chart updates |
| B7 | Download XLSX of each sheet | Sharnam-branded workbook, chart, row kinds kept |
| B8 | Save to SharePoint (each sheet) | "Saved … live copy + this week's copy" — file in the ISO folder |

## C. Finance — PO → RA bill (3 stages) → COP → payment summary

| ID | Login | Step | Expected |
|---|---|---|---|
| C1 | office | COP tab → Work orders / POs → + PO | PO listed with WO value, budget code, GST |
| C2 | vendor | RA Bill Tracker → Raise RA bill + workbook (stage 1) | Status Submitted; vendor sees only own bills |
| C3 | office | Upload Corrected → Certified (try Certified first) | Order enforced; status Checked → Certified |
| C4 | office | RA from BOQ (package → items → raise) | Bill in the package discipline, abstract filed |
| C5 | office | COP: pick the certified bill | Every field fills; Create COP; bill "COP generated" |
| C6 | office | COP PDF / All COPs PDF / COPs → SharePoint | Branded certificate, register by discipline, saved |
| C7 | office | Payment summary + PR / Invoice tracker → Download + Save to SharePoint | Branded workbooks with charts |

## D. Quality — QAP, cube, observations, NCR / CAR (site · vendor · office)

| ID | Login | Step | Expected |
|---|---|---|---|
| D1 | office | QAP: + row, download, publish | QAP week sheet with drop-downs |
| D2 | site | Cube register: + cube set | 7/28-day results, register download |
| D3 | site (D) | Site observation with photo | Logged; quality statistics +1 |
| D4 | site | Raise NCR to Bhavana Infra (and a CAR) | NCR in register, issued to the vendor |
| D5a / D5 | vendor | Action desk → open NCR → work carried out + signature | Before: "Your action"; after: "With PMC" |
| D6 | vendor | Try to close it | Refused — only PMC closes |
| D7 | office | Verify and close the NCR | Closed; vendor desk shows it under Closed |
| D8 | office | Quality module Excel + Save to SharePoint | Dashboard with charts, saved in 08.01 |

## E. Safety — daily log, notices to contractor (site · vendor · office)

| ID | Login | Step | Expected |
|---|---|---|---|
| E1 | site (D) | Weekly desk: log today (manpower, toolbox talk) | Week total and cumulative update |
| E2 | site | Raise safety NCR / unsafe act issued to Bhavana Infra | In the register, issued to the vendor |
| E3 | vendor | Action desk → record action taken | Moves to "With PMC" |
| E4 | vendor | Try to close / edit another company's record | Refused |
| E5 | office | Close the safety NCR | Closed |
| E6 | office (W) | Safety week Excel + Publish; Safety module Excel → SharePoint | HSE statistic carried forward, saved |

## F. Progress — DPR daily, WPR weekly, registers (site · office)

| ID | Login | Step | Expected |
|---|---|---|---|
| F1 | site (D) | DPR Maker: today's quantities → publish → Excel | DASHBOARD with S-curve |
| F2 | office (W) | Planned vs Actual: weekly plan / actual → download → SharePoint | Charts; saved in 07.08 |
| F3 | site | Milestone, hindrance, risk, legal approval: + one each | Registers + Progress Excel |
| F4 | planning | S-curve: generate from schedule | Planned / actual % chart |
| F5 | office (W) | WPR Maker → Excel / PPTX / client workbook → publish | Client layout with charts, 10.01 folder |

## G. Logins and dashboards

| ID | Login | Step | Expected |
|---|---|---|---|
| G1 | site | Project home after check-in | Site tools open |
| G1b | site | Cost → MB / BBS (measurement) | Opens; budget / cashflow refused |
| G2a / G2 | vendor | Contractor home → action desk | NCR / CAR, safety notices, RA bills with next step |
| G3 | client | Project desk (read-only) | Dashboards, reports; edits refused |
| G4a–f | office | Project overview + Cost / Finance / Quality / Safety / Progress dashboards | KPIs and charts populated from the entries above |

Screenshots go to `docs/uat-evidence/<ID>-<slug>.png` (automated run) and the evidence index lists each ID
with its result. Failures are logged with the ID, login, project and screenshot.
