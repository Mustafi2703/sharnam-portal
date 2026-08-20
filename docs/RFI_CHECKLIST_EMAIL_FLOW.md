# RFI + checklist fill → review → close

Checklists are **not** a separate silo for IR / QI / Safety / Drawing / Field requests. Raise an **RFI of the right kind**, attach the checklist assignment, then use email deep links.

## Flow

```
1. RAISE RFI (+ checklist assignment for fill kinds)
       ↓ email: Action required + FILL LINK
2. SITE opens link → fills → Submit
       ↓ email: For review + Branded HTML/Excel + fill-log link
       RFI status → Answered · ball in court → Office
3. OFFICE opens branded file on Fill log
       → Approve + close RFI  (or Reject)
       ↓ emails: review decision + Closed (if approved with close)
4. Done
```

## Kinds that attach a checklist

| Kind | Module pill | Fill family |
|------|-------------|-------------|
| `DrawingChecklist` | Drawings → Request checklist fill | DrawingCheck |
| `QualityInspection` | Quality → Request QI fill | QualityInspection |
| `SafetyChecklist` | Safety → Safety checklist fill | Safety |
| `ActivityInspection` | Inspection → Activity checklist | ActivityInspection |
| `SiteExecution` | Field → Field checklist fill | SiteExecution |
| `QualityIR` / `SafetyIR` | Inspection IRs | QI / Safety |

Kinds **without** checklist: `RequestForInformation` (Ask PMC), `ClientConcern` — respond in register, then Close.

## Emails (Graph → `pmc-portal@spdc.in`)

| Event | Context | Contents |
|-------|---------|----------|
| Raise | `rfi.create` | Kind, subject, **fill URL** or register URL |
| Submit | `checklist.submit.review` | Branded HTML + XLSX URLs, fill log, linked RFI nos |
| Review | `checklist.review` | Approved / Rejected |
| Close | `rfi.status.closed` | Closed notice + register link |

Recipients: project `notificationEmails` (set on Project → Email).

## Portal paths

- Fill: `/projects/:id/checklist/fill/:assignmentId?family=…`
- Logs: `/projects/:id/{quality\|safety\|drawings\|inspection\|field}/checklist-logs`
- RFI: `/projects/:id/rfis?kind=…`

On close, portal also archives:

- Register CSV → SharePoint `03.06_Correspondence_Control/Closed/`
- Branded checklist XLSX (if linked fill) → `08.02_Inspection_Checklists_Pour_Cards/Closed_RFI/`

See [MASTER_DATA_FLOW.md](./MASTER_DATA_FLOW.md) §4–7.
