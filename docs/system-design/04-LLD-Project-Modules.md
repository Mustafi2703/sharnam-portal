# 04 — LLD: Project Modules (PMC Delivery)

**Version:** 0.1 · 2026-08-03  
**IA source:** [`PRODUCT_IA.md`](../../PRODUCT_IA.md), [`CLIENT_REQUIREMENTS.md`](../CLIENT_REQUIREMENTS.md)  
**Hub route:** `/projects/:id/hub/{module}`

This LLD reconciles locked PMC modules with naming fixes and build gaps. Deep field lists for mature modules stay as implemented; this doc is the contract for further work.

---

## 1. Home

| Tool | Status | Notes |
|------|--------|-------|
| Overview | **Exists** | Ops signals, open RFIs |
| Directory | **Exists** | Office / Site / Client / Contractor |
| Vendors | **Exists** | `ProjectVendor` |
| Documents (DMS) | **Partial** | Mock → Graph SharePoint |

---

## 2. Drawings

| Tool | Status | Requirement |
|------|--------|-------------|
| GFC register | **Exists** | R0–R5, publish, view |
| Checklist manager | **Exists** | Drawing Check Master; unlock before upload |
| Upload flow | **Exists** | Modal + checklist fill window |
| DMS under Drawings | **Partial** | |
| Coordination | **Exists** | Design issues → escalate |
| Request checklist fill | **Exists** | |
| **Ask — Request for Information** | **Exists** (label fix) | Clarification / information **only** — not inspection |
| Submittals | Out of scope | Keep model dormant |

### RFI naming (Drawings)

- UI label: **Request for Information**  
- `rfiKind`: `RequestForInformation` (and drawing checklist kinds as today)  
- Prefix example: `RFI-###`

**Gate:** Drawing Check Master complete before revision upload / publish.

---

## 3. Quality

| Tool | Status | Requirement |
|------|--------|-------------|
| QI dashboard | **Exists** | Inspections, items |
| Checklist master | **Exists** | Excel upload + choose template |
| QAP | **Exists** | Upload / update Week-50 style plan |
| Site checklists | **Exists** | Assign / fill |
| NCR / cube / assurance | **Exists** / Partial | Registers |
| **Request for Inspection** | **Exists** (label fix) | Request QI / checklist fill |

### Naming

- UI: **Request for Inspection** (Quality)  
- `rfiKind`: `QualityInspection`  
- Prefix: `QI-RFI-###` or `QI-###` (product pick one; keep stable)

Office, Site, Client (where enabled) create templates; Contractor fills assigned.

---

## 4. Safety

| Tool | Status | Requirement |
|------|--------|-------------|
| Safety dashboard | **Exists** | Observations, incidents |
| Safety checklists | **Exists** | Excel upload + choose |
| **Request for Inspection** | **Exists** (label fix) | Safety checklist / inspection request |

- `rfiKind`: `SafetyChecklist`  
- Prefix: `SAF-###`

---

## 5. Progress

| Tool | Status | Notes |
|------|--------|-------|
| Overview KPIs | **Partial** | |
| Milestones | **Exists** | |
| Planned vs Actual / S-curve | **Partial** | Excel/manual; Graph MS Project when licensed |
| Project summary schedule | **Design** / Partial | Upload + PDF view for Client |
| MS Project progress | **Design** | Import / sync |
| Procurement plan | **Design** | Client-visible |
| Monthly | **Exists** | |
| Hindrance / Risk / Legal | **Exists** | |
| Manpower / activity lines | **Exists** | |

Client civil visibility required for schedule, S-curve, procurement, generated PDFs.

---

## 6. Field

| Tool | Status | Notes |
|------|--------|-------|
| Day log (`DailyLog`) | **Exists** | Manpower, equipment, notes, photos |
| Photos | **Exists** | |
| Field RFIs | **Exists** | |

**Relation to HRMS personal diary:** separate entity; optional future “copy to day log”.

---

## 7. Comms

| Tool | Status | Notes |
|------|--------|-------|
| Communication Matrix | **Exists** | Meeting + RFI parties |
| Meeting → Agenda → MoM → Follow-up | **Partial** | |
| **Teams meeting integration** | **Design** | Graph OnlineMeetings only (not Zoom/Meet) |
| Custom meeting sheet maker | **Design** | See [06-LLD-Sheet-Maker.md](./06-LLD-Sheet-Maker.md) |
| Ask (PMC RFI) | **Exists** | Request for Information |
| Email / Outlook | **Partial** | Outbox; Graph send when live |
| Generated docs → Client | **Partial** | MoM/agenda PDFs on civil side |

### Meeting fields (extend)

| Field | Notes |
|-------|-------|
| teamsMeetingUrl, teamsMeetingId | From Graph |
| sheetTemplateId | Sheet Maker template |
| agendaHtml / momHtml | |
| start/end, attendeesJson | |

---

## 8. Cost (engineering — not commercial finance)

| Tool | Status |
|------|--------|
| Monitoring, MB, BBS, Budget WBS | **Exists** |
| Cashflow | **Exists** |
| Rate difference | **Exists** |
| BOQ structure import | **Exists** |
| Vendor bills | **Exists** |

Keep **Cost ≠ Finance**.

---

## 9. Finance (commercial tracking)

| Tool | Status | Notes |
|------|--------|-------|
| Overview | **Partial** | Shell UI |
| Invoice tracking | **Design** | |
| PO tracking | **Design** | |
| RA bill tracking | **Design** | |
| COP tracking | **Design** | |

Detail columns / Excel import: see `docs/MODULE_FINANCE.md`; finalize post-shell.

---

## 10. Reports

| Tool | Status | Notes |
|------|--------|-------|
| DPR pack | **Exists** | Computed from registers |
| WPR pack | **Exists** | |
| PDF viewable on Client civil | **Partial** | Required |

---

## 11. Documents / PDF (cross-module)

| Requirement | Status |
|-------------|--------|
| PDF upload | **Partial** / Exists on attachments |
| In-app PDF viewer | **Design** / Partial — required for civil packs |
| Min civil packs | Summary schedule, Procurement plan, Generated meeting/civil PDF |

---

## 12. RFI kind matrix (canonical)

| Kind | UI term | Module |
|------|---------|--------|
| `RequestForInformation` | Request for Information | Drawings / Comms Ask |
| `DrawingChecklist` | Checklist fill request | Drawings |
| `QualityInspection` | Request for Inspection | Quality |
| `SafetyChecklist` | Request for Inspection | Safety |
| `ClientConcern` | Concern | Client |
| `Manual` / Field | Field request | Field |

Respond/close rules remain Communication Matrix driven (**Exists**).

---

## 13. Cross-module API map (existing)

| Area | Prefix |
|------|--------|
| Projects / drawings | `/api/projects`, `/api/drawings` |
| Checklist | `/api/checklist` |
| Diary | `/api/diary` |
| Comms | `/api/comms` |
| Cost | `/api/cost` |
| Reports | `/api/reports` |
| RFIs | `/api/rfis` |
| Inspections | `/api/inspections` |
| Safety | `/api/safety` |
| Progress | `/api/progress` |
| Directory / Vendors | `/api/directory`, `/api/vendors` |
| DMS | `/api/dms` |
| Audit | `/api/audit` |

---

## 14. Build-next priorities (project modules)

1. Rename UI strings Information vs Inspection  
2. Sheet Maker + bind to Meetings  
3. Teams meeting create via Graph  
4. Progress civil tools (summary schedule, procurement, PDF viewer)  
5. Finance entity model + import  
6. Live SharePoint DMS  

Next: [05-LLD-Audit-KPI.md](./05-LLD-Audit-KPI.md).
