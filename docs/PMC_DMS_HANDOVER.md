# Sharnam Portal · PMC / ISO Document Management — Client Handover

**Doc:** SPDC-PMC-PORTAL-HANDOVER · **Prepared for:** SPDC PMC · **Rev:** 05 · **Date:** 2026-08-10

> Rev 05 additions — Recruitment & Interview Management, Pre-joining checklist, Employee Onboarding checklist, Pay Hike + Payslip workflows, per-employee audit timeline, Teams meeting-link auto-generate for interviews, and photo + PDF markup tools wired into Site Pilot for on-site testing.

---

## 1. What is live now

* **SharePoint site** — `https://spdcsmb.sharepoint.com/sites/SharnamProjects`
* **Sandbox root** — `Shared Documents / Sharnam Portal /` (the portal only ever writes inside this)
* **Reference project** — `Sharnam Portal / SPDC-DEMO-01 /` — full ISO tree created, 112 folders live, test docs dropped in RFI / DPR / WPR / Quality / Safety / Drawings / Design-Coordination
* **Shared mailbox** — `pmc-portal@spdc.in` (mail send is queued; awaiting `Mail.Send` admin consent — see §7)

---

## 2. Folder structure (matches PMC ISO Rev 02)

Every project the portal opens creates the following inside `Shared Documents / Sharnam Portal / {ProjectCode} /`:

```
_Registers/                                  ← CSV dump of every module log, refreshed on demand
01_CONTEXT_AND_GOVERNANCE/                   5 folders
02_PLANNING/                                11 folders
03_SUPPORT_AND_RESOURCES/                    9 folders
04_DESIGN_AND_INFORMATION_MANAGEMENT/        8 folders  ← Drawings · Coord · BIM · Submittals
05_PROCUREMENT_AND_CONTRACTS/               11 folders  ← office/admin only
06_STATUTORY_AND_LAND/                       4 folders
07_EXECUTION_AND_DELIVERY/                  12 folders  ← DPR · WPR · Site Instructions
08_QUALITY_HSE_AND_ENVIRONMENT/             12 folders  ← ITP · Checklists · NCR · HIRA
09_COMMERCIAL_AND_CHANGE/                    9 folders  ← office/admin only
10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/    19 folders  ← MIS · KPI · Handover · Lessons
```

**Rules encoded in the portal**

* Max three folder levels — no arbitrary nesting.
* Only current revision in the live folder. Older revisions never overwrite — they are timestamped and preserved.
* Portal **never deletes** on SharePoint. Any delete has to be done by the admin in SharePoint directly.
* Portal **never writes outside** `Sharnam Portal/…` — hard sandbox check on every path.

---

## 3. Module → ISO folder map

| Portal module | ISO folder |
|--|--|
| Drawings, Specs, GFC log | `04.02_Drawings_and_Specifications` |
| Design coordination / clash | `04.04_Clash_Detection_Design_Coordination` |
| Submittals & shop drawings | `04.08_Shop_Drawings_and_Material_Submittals` |
| **Information RFI** (site ↔ office) | `03.06_Correspondence_Control` |
| Transmittals | `03.07_Transmittal_Control` |
| Meetings & MoM | `03.08_Meetings_Minutes_Action_Tracking` |
| DPR / photos | `07.02_Daily_Site_Records` |
| Site Instructions | `07.03_Site_Instructions_Client_Instructions` |
| Progress / WPR / S-curve | `07.08_Progress_Measurement_SCurve` |
| Hindrance / delay | `07.09_Delay_Analysis` |
| QAP / ITP | `08.01_Quality_Plans_and_Inspection_Test_Plans` |
| Quality checklists · pour cards · **Quality RFI** | `08.02_Inspection_Checklists_Pour_Cards` |
| Cube tests, test reports | `08.03_Testing_Test_Report_Control` |
| NCR | `08.06_Control_of_Nonconforming_Output` |
| HIRA · **Safety RFI** · observations | `08.07_Hazard_Identification_Risk_Assessment` |
| RA bill, JMS, cost report | `09.*` (office/admin only) |
| MIS report, KPI | `10.01_Progress_Reporting_MIS`, `10.02_Project_KPIs_Performance_Measurement` |
| Snag / handover / lessons | `10.05` · `10.06` · `10.14` |

---

## 4. Three RFI streams — separate logs, separate dashboards

The portal keeps three RFI streams strictly separate. They share the same form but different labels, different prefixes, different registers, different folder drops.

| Stream | Prefix | Portal home | ISO folder drop |
|--|--|--|--|
| **Information RFI** (site ↔ office / consultant) | `RFI-###` | Comms module | `03.06_Correspondence_Control/RFI-Information-Log.csv` |
| **Quality RFI / Quality Inspection** — *client-visible* | `QI-RFI-###` | Quality module | `08.02_Inspection_Checklists_Pour_Cards/RFI-Quality-Log.csv` |
| **Safety RFI** — *client-visible* | `SAF-RFI-###` | Safety module | `08.07_Hazard_Identification_Risk_Assessment/RFI-Safety-Log.csv` |
| Drawing-checklist RFI | `DWG-RFI-###` | Drawings module | `04.02_Drawings_and_Specifications/RFI-DrawingChecklist-Log.csv` |

* Each has open / closed / status filters.
* Dashboards live per module (Home KPI card) and roll up to the master KPI.
* Quality & Safety RFIs are the only two streams the client sees on their desk.

---

## 5. Log Refresh & Dump-to-Drive

Every registered module has a **live log** in the portal *and* a **CSV mirror in the ISO folder**.

**How to refresh**

1. Open the project → **Documents** module.
2. Click **Refresh registers to drive**.
3. Every register below is regenerated and dropped both (a) into its ISO folder and (b) into the flat `_Registers/` folder for quick download.

**Registers refreshed**

* `RFI-Information-Log.csv`
* `RFI-Quality-Log.csv`
* `RFI-Safety-Log.csv`
* `RFI-DrawingChecklist-Log.csv`
* `Drawings-Log.csv`
* `Design-Coordination-Log.csv`
* `DPR-Log.csv`
* `WPR-Log.csv`
* `QualityInspection-Log.csv`
* `Checklist-Submissions-Log.csv`
* `Safety-Log.csv`
* `NCR-Log.csv`
* `Cube-Test-Log.csv`
* `Meetings-Log.csv`
* `Submittals-Log.csv`
* `Hindrance-Log.csv`
* `_INDEX.csv` — manifest of every register with record count + timestamp

API endpoint (for automation): `POST /api/dms/{projectId}/dump-logs` — admin / office / site-employee.

---

## 6. Login page — separate URLs per user

Each user type opens a **different login URL** (no picker on the page — you can't switch inside the modal).

| User type | Direct URL |
|--|--|
| Office | `/login/office` |
| Site | `/login/site` |
| Employee | `/login/employee` |
| Contractor / Vendor | `/login/vendor` |
| Client | `/login/client` |
| Master / Admin | `/login/master` |
| Drawings desk | `/login/drawings` |
| Quality desk | `/login/quality` |
| Comms desk | `/login/comms` |
| Field desk | `/login/field` |

* The Sharnam mark shows **शरणम्** (Devanagari) with the Latin **Sharnam** underneath, centred against a clear-sky hero.
* Policy rotator cycles through the module's own rules.
* Demo password: `Demo@1234` (rotated before go-live).
* The hub page `/login` shows only the picker tiles — chosen user opens their own URL.

---

## 7. Mail — pending action on your side

The Microsoft Entra app has SharePoint working. To turn on the shared mailbox notifications, please grant these **Application** permissions on the app registration (Client ID `2fd78789-594e-4af6-b43d-cb82f59df39c`) and click *Grant admin consent*:

* `Mail.Send`
* `Mail.ReadWrite` (optional — for reading replies later)
* `User.Read.All` (to resolve `pmc-portal@spdc.in` by UPN)

Once granted, `POST /api/graph/test-mail` with `{ "to": "you@spdc.in" }` will send a real message from `pmc-portal@spdc.in`.

---

## 8. Deployment

* Web + API run on Render as one service (`sharnam-portal.onrender.com`).
* Envs on Render (already set): `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `SHAREPOINT_SITE_URL`, `GRAPH_SHARED_MAILBOX=pmc-portal@spdc.in`, `MOCK_ONEDRIVE=false`.
* Any push to `main` auto-deploys.

**Operator scripts** (run locally with `npx tsx`)

* `apps/api/scripts/bootstrap-sharepoint-project.ts [PROJECT_CODE]` — create ISO tree + drop test docs
* `apps/api/scripts/verify-sharepoint-folders.ts [PROJECT_CODE]` — list top of tree
* `apps/api/scripts/print-sharepoint-links.ts` — spit out webUrls
* `apps/api/scripts/test-mailbox.ts` — probe the shared mailbox

---

## 9. Finance module — now live

Full commercial ledger. Sits alongside the Cost module (which keeps BOQ / BBS / MB / cashflow) — Finance is the money side.

| Tab | What it does |
|--|--|
| **Overview** | KPI cards for CAPEX budgeted · PO original / billed / certified / paid · RA gross / net / retention / advance adjusted · COP certified / payable. Also shows the last 8 RA bills and 8 COPs. |
| **Project CAPEX** | Line-level project capex — description · package · stakeholder · budgeted · work-order value. Rolls up into Payment Summary. |
| **Purchase Orders** | PO number · date · vendor · trade · package · original value · amended value · retention % · advance % · PAN · GST · payable-to. PDF/scan attaches to `09.01_Interim_Bill_Verification_Certification`. |
| **RA Bill Tracker** | Every column from the Payment Summary sheet: against-bill-raised · price variation · totals w/w-out GST · advance adjusted · retention · other recoveries · net payable · **cumulative** auto-computed per PO. |
| **COP (Certificate of Payment)** | Exact fields from the Viatrix CoP sheet — certificate no · type (Against-RA / Advance) · date · contractor · work/trade · budget code · PO no & date · original / amended WO value · amendment no · invoice no & date · linked RA · amount certified / payable · GST · retention · PAN · GST · payable-to · remarks. Attachment lands in `09.05_Variation_Extra_Item_Evaluation`. |
| **Payment Summary** | Per-PO ledger — original · amended · billed w/w-out GST · net payable · retention · advance adjusted · balance · RA count. Grand-total row. |
| **Audit sheets → drive** | One-click regenerates `Capex-Log`, `PurchaseOrder-Log`, `RA-Bill-Log`, `COP-Log`, `Payment-Summary` into 09.01 + 09.08 + `_Registers/`. Never overwrites — timestamps on conflict. |

API: `/api/finance/:projectId/{summary,capex,po,ra,cop,audit-dump}`.
Prisma models: `ProjectCapex`, `PurchaseOrder`, `RaBill`, `CertificateOfPayment`.

## 10. HRMS additions — now live

* **Directory + role assignments** already existed; enriched with attendance & leave.
* **Attendance** now captures GPS (lat/lng/accuracy) plus site-name and geo-fence flag. Every check-in/out records where you were.
* **Check-in with GPS** button in HRM header — pick a project, browser prompts for location, portal stamps the row.
* **Leave types (masters)** — create CL, SL, PL, CO, LWP, etc. with days-per-year, paid/unpaid, carry-forward.
* **Leave balances** — auto-decrement when a request is approved.
* **Holidays** — upload the year's list, region-tagged.
* **Leave request (pre-approval)** — pick type, half-day, from-to, reason. Approver clicks Approve / Reject.
* Employee profile now stores personal + bank + PF/ESIC + nominee + emergency contact + CTC/basic/HRA (used by payroll later).

API: `/api/hrm/{leave-types,leave-balances,holidays,leave,attendance,documents}`.

## 11. CRM · Quotation Maker

* `/quotations/new` — editable proposal maker that renders the SPDC PMC format (Devanagari शरणम् masthead + Latin Sharnam under it), section-based with live totals.
* Sections + rows are fully editable. Print / PDF button uses the browser print UI (proper A4 layout).
* **Award button** on a saved quotation creates the project (or links to an existing one) and bootstraps the SharePoint ISO tree.

API: `/api/crm/quotations` + `/api/crm/quotations/:id/award`.
Prisma: `Quotation` model with `sectionsJson`, `awardedProjectId`.

## 12. Custom Sheet Maker

* Upload any `.xlsx / .xls / .csv` — the portal parses it into an editable table.
* Edit in-place, save, then export back to `.xlsx`.
* If uploaded against a project, the raw file lands in `10.18_Management_Review_and_Audit_Programme` for the audit trail.
* Route: `/custom-sheets` (list) → `/custom-sheets/:id` (editor).

## 13. HRMS · Recruitment · Onboarding · Payroll — now live

**Recruitment (`/hrms/recruitment`)**

1. **Manpower Requisition** — dept raises → HR approves / rejects. Head-count, employment type, urgency, CTC band, location, business justification.
2. **Job Posting** — LinkedIn / Naukri / Website / Referral / Instahyre channels. Link to an approved requisition.
3. **Candidates / Resume DB** — upload resume PDF/DOC (stored in `03.01_Competence_and_Training`), filter by stage, source, or free-text search. Statuses: New → Screened → Shortlisted → Interview → Selected → Offered → Joined → Rejected → Withdrawn.
4. **Interviews & scorecard** — schedule technical / HR / management / client / assessment rounds; auto-generates a Teams meeting link when mode=Teams. Panel, duration, feedback fields, and 4-axis scorecard (technical / communication / culture / overall). Decision (Advance / Hold / Reject) auto-transitions the candidate.
5. **Offers** — CTC breakdown (basic / HRA / other allowances / variable pay %), joining date, probation months, reporting manager, upload the offer letter PDF (stored in `06.03_Labour_and_Statutory_Compliance`). Draft → Approved → Sent → Accepted → Declined → Joined.

**Pre-joining + Onboarding (`/hrms/onboarding`)**

* Every accepted offer gets a **Pre-joining checklist** (document collection, BGV, medical fitness, employee-code, appointment letter URL, IT asset, email ID, ID card, welcome kit) with per-item state and timestamps.
* When the offer moves to `Joined`, an **Onboarding checklist** appears — joining formalities, personal info, bank, PAN/Aadhaar, PF/ESIC, nominee, doc verification, department allocation, reporting manager, orientation, HR policy acknowledgement — with a completion timestamp per item.
* **Live progress bars** and a **per-candidate audit timeline** rendered from `AuditEvent` (every HRMS action is recorded).

**Payroll (`/hrms/payroll`)**

* **Pay Hike** — submit old/new CTC, monthly basic, monthly HRA, reason, performance rating. Hike % auto-computed. States: Submitted → Approved → Rejected → Applied. When set to Applied the employee's profile CTC updates automatically (feeds future payslips).
* **Payslip** — pick year + month + employee. Compute is deterministic from CTC breakdown and paid-days:
  * Basic = `profile.basicMonthly` (or CTC × 50% ÷ 12) × factor
  * HRA = `profile.hraMonthly` (or Basic × 50%) × factor
  * Conveyance = ₹1600 × factor · Medical = ₹1250 × factor · Special = residual
  * PF (employee) = min(Basic, ₹15000) × 12% · ESIC = 0.75% if gross ≤ ₹21000 · PT = ₹200
  * TDS (Income tax) input by admin
* Editable overrides on every value. Status: Generated → Approved → Released → Paid.

**Audit log per employee**

* API: `GET /api/hrm/employees/:userId/timeline` returns the merged AuditEvent stream (own actions + entity=User events + related HRMS entities).
* Surfaced inside the Onboarding page as a scrollable timeline.

## 14. Teams meeting integration (HRMS interviews)

* Interview scheduling with `mode = Teams` auto-generates a Teams meetup URL of the shape `https://teams.microsoft.com/l/meetup-join/…`. Panel and candidate can click the link from the interview card.
* Real Graph-native calendar events + calendar invites remain gated on `Calendars.ReadWrite` + `Mail.Send` admin consent (see §7). Once granted, the URL is upgraded to a live Teams event with attendees.

## 15. Photo & PDF markup — Site Pilot

* **ImageMarkup component** — pen (8 colours × 4 widths), text annotation, eraser, undo, clear. Exports a flattened PNG File that flows straight into the existing upload pipeline.
* Wired into **Site Pilot** for every photo — tap the thumbnail to mark up before submitting. The marked-up PNG replaces the raw photo in the submission.
* **PdfMarkup component** — renders any uploaded PDF page-by-page (pdfjs-dist), letting the user annotate each page. "Save annotated pages" appends each page as its own PNG to the submission.
* Both landed under `07.02_Daily_Site_Records/SitePilot/` in SharePoint, so a site engineer can hand back drawings and checklists with red-lines on them.

## 16. What is *not* done yet (still deferred)

* **Bid management (comparative statement full flow)** — vendor uploads + BOQ compare across vendors is the next major module (Comparative Statement R2 template).
* **DPR / WPR PDF export** with rich-text narrative editor — cost + progress calc feeds are already in place, need the print layout.
* **Mail sending & real Teams calendar events** — awaits `Mail.Send` + `Calendars.ReadWrite` admin consent (§7).
