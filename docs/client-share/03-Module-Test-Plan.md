# Module test plan — one by one on SPDC server

Use this checklist after deploy to **your server**. One module per session. Sign off each row before moving on.

**Suggested order:** Master → Drawings → Documents → Quality → Safety → Field → Progress → Cost → Finance → Comms → Reports → HRMS → CRM

---

## How to run a session

1. **Office user** walks the module on desktop  
2. **Site user** repeats field/mobile flows where applicable  
3. **Client user** confirms read-only view (if module is client-visible)  
4. Log bugs with screenshot + project code + user role  
5. Mark row **Pass** when critical path works with real project data  

---

## Module checklist

| # | Module | Critical path to verify | Office | Site | Client | Pass |
|---|--------|----------------------|:------:|:----:|:------:|:----:|
| 1 | **Master** | Create project, enable modules, add directory parties | ☐ | — | — | ☐ |
| 2 | **Drawings** | GFC register, upload with drawing check, publish revision | ☐ | ☐ | ☐ | ☐ |
| 3 | **Documents (DMS)** | Browse ISO folders, upload, preview PDF; **matrix party can open granted folders** | ☐ | ☐ | ☐ | ☐ |
| 4 | **Quality** | QI create, checklist fill, NCR/CAR, cube line | ☐ | ☐ | ☐ | ☐ |
| 5 | **Safety** | Safety observation, safety NCR (separate from QI) | ☐ | ☐ | — | ☐ |
| 6 | **Field / Site** | Day log, photos, field RFI, **attendance punch IST + SharePoint + geofence** | ☐ | ☐ | — | ☐ |
| 7 | **Progress** | Milestones, S-curve or schedule, procurement register | ☐ | — | ☐ | ☐ |
| 8 | **Cost** | Monitoring BOQ, MB line, **cashflow chart / forecast / tracking** | ☐ | — | — | ☐ |
| 9 | **Finance** | Invoice / PO / RA / COP shell views | ☐ | — | ☐ | ☐ |
| 10 | **Comms** | Matrix → meeting → agenda → MoM → follow-up | ☐ | ☐ | ☐ | ☐ |
| 11 | **Reports** | DPR maker, WPR pack, print/PDF with logo | ☐ | — | ☐ | ☐ |
| 12 | **HRMS** | Employee record, **attendance roster + override**, leave request, geofence master | ☐ | ☐ | — | ☐ |
| 13 | **CRM** | Lead, quotation PDF, convert to project | ☐ | — | — | ☐ |

---

## Cross-cutting checks (once)

| Check | Pass |
|-------|:----:|
| SharePoint upload returns success (attendance selfie or DMS file) | ☐ |
| DMS PDF opens in-app (not download-only) for Office, Site, Client shared folder | ☐ |
| Communication Matrix party can open assigned DMS folder | ☐ |
| Audit trail shows upload / punch / publish events | ☐ |
| Client cannot edit cost numbers or upload drawings (unless granted) | ☐ |
| “Request for Information” vs “Request for Inspection” labels correct | ☐ |

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| SPDC Project lead | | | |
| SPDC IT | | | |
| Development team | | | |

---

*Full requirements: [../CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md)*
