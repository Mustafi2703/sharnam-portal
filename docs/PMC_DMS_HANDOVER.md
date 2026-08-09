# Sharnam Portal · PMC / ISO Document Management — Client Handover

**Doc:** SPDC-PMC-PORTAL-HANDOVER · **Prepared for:** SPDC PMC · **Rev:** 03 · **Date:** 2026-08-10

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

## 9. What is *not* done yet (deferred by client)

* **Finance module detail** — Invoice/PO/RA/COP flow is scaffolded; awaiting your definitions.
* **Payroll engine** — HRMS attendance + leave is in; salary compute not started.
* **Mail sending** — code is ready, waiting on §7 permissions.
