# Sharnam Portal — Client delivery update

**Prepared for:** SPDC / Sharnam PMC · **Rev:** 06 · **Date:** 10 Aug 2026  
**Live demo:** https://sharnam-portal.onrender.com  
**Demo password:** `Demo@1234`

---

## 1. Executive summary

The **शरणम् (Sharnam) PMC portal** is a construction management workspace aligned to Procore-style modules, SPDC ISO folder structure, and your existing Excel / WPR / DPR templates. It is live on Render for review; production cutover to your domain (e.g. Hostinger) is planned after sign-off.

**What works today without extra IT setup**

- Full module navigation (Drawings, Quality, Safety, Field, Comms, Cost, Reports, HRMS, CRM, Master)
- Project-scoped data, roles, audit trail
- Branded login hub with separate portals per user type
- Demo data for **SPDC-DEMO-01** (Arvind Worker Dormitory · Santej)

**What needs Microsoft 365 admin consent (one-time)**

- Live Outlook send (RFI / publish emails) — see [M365_SETUP.md](./M365_SETUP.md)
- Already connected: **SharePoint** `Sharnam Projects` site, shared mailbox `pmc-portal@spdc.in`

---

## 2. Portal logins (share with users)

| Portal | URL | Demo login | Lands on |
|--------|-----|------------|----------|
| Hub (all portals) | `/login` | — | Portal picker |
| Office / PMC | `/login/office` | `office@sharnam.demo` | Dashboard |
| Site / field | `/login/site` | `site@sharnam.demo` | **Attendance punch** |
| Contractor | `/login/vendor` | `vendor@sharnam.demo` | Workspace |
| Client | `/login/client` | `client@sharnam.demo` | Dashboard (read-only) |
| Employee | `/login/employee` | `employee@sharnam.demo` | Workspace |
| Master setup | `/login/master` | `office@sharnam.demo` | Master |
| HRMS | `/login/hr` | `office@sharnam.demo` | HRMS desk |

Password for all demo accounts: **`Demo@1234`**

---

## 3. Modules delivered (Aug 2026)

### Home & governance

| Feature | Status | Notes |
|---------|--------|-------|
| Project picker + module hubs | Live | Procore-style tool cards per module |
| Directory (Office / Site / Client / Contractor) | Live | Matrix parties for RFIs & fills |
| **Document manager (DMS)** | Live | Procore-style folder browse, upload, preview — ISO Rev 02 tree |
| Master setup (modules, CRM, roles) | Live | Office / admin only |

### Drawings (separate from Documents)

| Feature | Status | Notes |
|---------|--------|-------|
| **GFC register** | Live | R0–R5 revisions, publish gate, Drawing Check overlay on upload |
| **Drawing file library** | Live | `/drawings/library` — PDF/DWG in Design & Engineering folders only |
| Design coordination | Live | Issues → Ask RFI |
| Drawing checklist fill / log | Live | Branded print → PDF |

### Quality & Safety

| Feature | Status | Notes |
|---------|--------|-------|
| QI dashboard, NCR/CAR, cube register | Live | Separate from Safety NCR |
| QAP upload | Live | Week-50 style sheet |
| Checklist master + filled export (XLSX) | Live | Full line data, not metadata-only |
| Safety register + Safety RFI | Live | Separate log from QI |

### Field & site

| Feature | Status | Notes |
|---------|--------|-------|
| **Site attendance punch** | Live | Selfie + GPS + timestamp → SharePoint + audit log |
| Day log, photos, field RFIs | Live | Feeds DPR |
| Site check-in (Site Pilot) | Live | Photo · PDF markup · signature |
| **Upload Lab** | Live | Mobile test desk for camera + PDF markup |

### Reports & makers

| Feature | Status | Notes |
|---------|--------|-------|
| DPR maker + civil dashboard format | Live | SPDC reference layout |
| WPR maker | Partial | Pack builder; full PPTX template parity in progress |
| Branded HTML → Print → PDF | Live | Sharnam logo on client packs |

### HRMS

| Feature | Status | Notes |
|---------|--------|-------|
| Unified HR desk (`/hrm/*`) | Live | Recruitment, onboarding, payroll, attendance |
| Attendance with geo log | Live | See §5 |
| HR dashboard KPIs | Live | |

### Integrations

| Feature | Status | Notes |
|---------|--------|-------|
| SharePoint file storage | **Live** | `spdcsmb.sharepoint.com/sites/SharnamProjects` |
| Outlook send | Queued | Needs `Mail.Send` admin consent |
| MS Project S-curve | Optional | If Project licenses exist |

---

## 4. Document management — two tools (important)

| Tool | Route | Purpose |
|------|-------|---------|
| **Documents (DMS)** | Project → Documents | All project files — contracts, HSE, daily records, MIS (Procore Documents parity) |
| **GFC register** | Drawings → GFC register | Revision workflow, publish gate, checklist link |
| **Drawing files** | Drawings → Drawing files | Sheet PDFs/DWG in `02_DESIGN_AND_ENGINEERING` only |

Do not mix drawing revision control with general document storage — they are intentionally separate.

---

## 5. Site attendance — GPS, time, and audit

Every site punch records:

| Field | Stored where |
|-------|----------------|
| Selfie photo | SharePoint `…/Attendance/` + DB |
| **Check-in / check-out time** | HRMS attendance row (HH:MM local) |
| **GPS lat, lng, accuracy (±m)** | DB + audit trail |
| Site / project name | Matched to selected project |
| ISO timestamp | Audit trail (`punchedAt`) |
| Map link | Audit trail (`mapsUrl`) |

**Office view:** HRMS → Attendance, or Audit trail → `hrm.attendance.punch`  
**Site view:** `/attendance` after site login — roster shows **In/Out time · location · coordinates**

Photos and coordinates are evidence for manpower and site presence registers.

---

## 6. Mobile testing checklist (client QA)

1. Phone browser → `/login/site` → `site@sharnam.demo` / `Demo@1234`
2. **Attendance** — allow Camera + Location → selfie → Check in → confirm time + map link on card
3. **Upload Lab** (sidebar) — Camera → upload photo; **PDF + markup** → draw → save
4. **Site check-in** — Field module → Site Pilot → same evidence flow
5. **Documents** — open a folder (use Sync library if empty); preview PDF

---

## 7. Standards & branding

- Logo: शरणम् wordmark (`/logo.png`) — centred on login hero, not repeated as text everywhere
- ISO badges on login: 9001 · 45001 · 14001 · 19650 · 21502
- Client-facing brand guide: **[CLIENT_BRAND_GUIDE.md](./CLIENT_BRAND_GUIDE.md)**
- Internal engineering brand spec: **[BRAND.md](./BRAND.md)**

---

## 8. Related documents

| Document | Audience |
|----------|----------|
| [CLIENT_BRAND_GUIDE.md](./CLIENT_BRAND_GUIDE.md) | Client — logo, colours, portal tones |
| [PMC_DMS_HANDOVER.md](./PMC_DMS_HANDOVER.md) | Client + IT — SharePoint folder map |
| [M365_SETUP.md](./M365_SETUP.md) | IT admin — Entra app + Graph permissions |
| [CONNECTIVITY_REVIEW.md](./CONNECTIVITY_REVIEW.md) | Internal — how modules connect |
| [CLIENT_DEMO_SUMMARY.md](../CLIENT_DEMO_SUMMARY.md) | Short demo walkthrough |

---

## 9. Next steps for SPDC

1. **Review** live demo — office + site logins on mobile  
2. **IT:** Grant Graph `Mail.Send` + Teams permissions ([M365_SETUP.md](./M365_SETUP.md))  
3. **Confirm** custom domain for production (avoid browser warnings on `*.onrender.com`)  
4. **Sign-off** module list → production deploy on Hostinger / Azure with Postgres (Render SQLite is demo-only)

**Contact for credentials / env vars:** development team (do not share client secrets in email body — use secure channel).

---

*Doc ref: SPDC-PORTAL-DELIVERY-REV06*
