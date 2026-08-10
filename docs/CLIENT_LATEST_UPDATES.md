# Sharnam Portal — Latest updates (shareable)

**For:** SPDC PMC, client stakeholders, site teams  
**Date:** 10 August 2026  
**Live demo:** https://sharnam-portal.onrender.com  
**Demo password:** `Demo@1234`

Plain-language summary of what was built, what is connected, and how to use it.

---

## 1. What is the Sharnam portal?

One online workspace for a construction project — like Procore, aligned to SPDC ISO folders and your Excel registers (DPR, WPR, cashflow, QAP, drawings log, etc.).

| Who | Login URL | What they do |
|-----|-----------|--------------|
| **Office / PMC** | `/login/office` | Full control — master setup, drawings, quality, cost, reports, HR |
| **Site team** | `/login/site` | Day log, photos, checklists, **attendance punch with selfie + GPS** |
| **Contractor** | `/login/vendor` | Fill assigned checklists and inspection requests |
| **Client** | `/login/client` | View published drawings, progress packs, raise concerns (read-only) |

Hub (pick a portal): `/login`

---

## 2. Login & branding (Aug 2026)

| Item | Detail |
|------|--------|
| Logo | Official **शरणम्** wordmark — transparent PNG on construction hero |
| Hub | Big centred logo + four portal tiles (Office · Site · Contractor · Client) |
| Each portal | Large logo on the left, simple sign-in on the right — no clutter |
| ISO strip | Removed from login for cleaner layout (standards still in project docs) |

Brand reference: [CLIENT_BRAND_GUIDE.md](./CLIENT_BRAND_GUIDE.md)

---

## 3. Site attendance — selfie, GPS, IST time, SharePoint

When a site engineer checks in:

| What is recorded | Where it goes |
|------------------|---------------|
| Selfie photo | SharePoint `…/Attendance/` folder + database |
| Check-in / check-out time | **Indian Standard Time (IST)** — e.g. `15:42 IST` |
| GPS latitude, longitude, accuracy | Database + audit trail + **Open map** link |
| Project / site name | Linked to selected project |

**How to test:** Phone → `/login/site` → `site@sharnam.demo` / `Demo@1234` → allow Camera + Location → selfie → **Check in**. Success line should say **SharePoint** if Microsoft connection is healthy.

If upload does not reach SharePoint, IT should verify Render env vars: [SHAREPOINT_RENDER_ENV.md](./SHAREPOINT_RENDER_ENV.md)

---

## 4. Documents — SharePoint store + in-app viewer

| Principle | What it means |
|-----------|---------------|
| **SharePoint is the store** | Every upload through the portal saves to `SharnamProjects` first |
| **Portal DMS is the window** | Browse, preview, and download from the same SharePoint folders |
| **Communication Matrix** | Names who is on the project — they get access to document folders their role is granted |
| **In-app preview** | PDFs and images open inside the portal — not download-only |

### Two separate tools (do not mix)

| Tool | What it is | Who uses it |
|------|------------|-------------|
| **Documents (DMS)** | All project files — contracts, HSE, daily records, MIS | Office, site (upload), client (view) |
| **Drawings register (GFC)** | Revision control R0–R5, publish gate, checklist before upload | Office, design, site |
| **Drawing file library** | PDF/DWG sheets in design folders only | Same as drawings module |

Do not mix general documents with GFC revision workflow — they are intentionally separate.

---

## 5. Modules at a glance

| Module | Plain English | Status |
|--------|---------------|--------|
| **Master** | Turn modules on/off per project; directory; CRM handover | Live |
| **Drawings** | GFC log, upload with drawing check, Ask (information requests) | Live |
| **Quality** | QI inspections, NCR/CAR, cube register, QAP | Live |
| **Safety** | Safety observations, NCR — separate from quality NCR | Live |
| **Field / Site** | Day log, photos, field RFIs, attendance | Live |
| **Progress** | Milestones, S-curve, summary schedule, procurement plan | Live |
| **Comms** | Meeting matrix → agenda → MoM → follow-up; Teams meetings | Live |
| **Cost (engineering)** | BOQ monitoring, MB, BBS, budget, **cashflow** (see §6) | Live |
| **Finance (commercial)** | Invoice, PO, RA bill, COP tracking | Shell — detail phased |
| **Reports** | DPR / WPR from live registers; branded PDF print | Live |
| **HRMS** | Recruitment, onboarding, **geofence attendance**, leave, payslips | Live |
| **CRM** | Leads, quotation, bid compare → new project | Live |
| **Sheet Maker** | Custom meeting / register templates | Live |
| **Site Audit & KPI** | Audit pack tools, master KPI dashboard | In scope |

Full requirement tables: [CLIENT_REQUIREMENTS.md](./CLIENT_REQUIREMENTS.md)

---

## 6. Cashflow — three tools (not one spreadsheet)

Your **Cashflow Dashboard** Excel has three views. The portal keeps them **separate** so teams do not mix chart, forecast, and tracking:

| Portal tool | Excel sheet idea | What office sees |
|-------------|------------------|------------------|
| **Cash Flow Chart** | Chart view | Month-by-month planned vs actual bars |
| **Cash Flow Forecast** | Forecast view | Forward-looking cash projection |
| **Cashflow Tracking** | Tracking view | Line-by-line follow-up against packages |

**Where:** Project → **Cost** module → Cashflow tab (Chart / Forecast / Tracking).  
**Rule:** Cost module is **engineering measurement** — separate from **Finance** (invoices, PO, RA bills).

---

## 7. Microsoft 365 connection

| Service | Status | Notes |
|---------|--------|-------|
| **SharePoint** file storage | Connected on Render | `spdcsmb.sharepoint.com/sites/SharnamProjects` |
| **Outlook send** | Needs final mail consent | RFI / MoM emails queue until `Mail.Send` granted |
| **Teams meetings** | Via Graph when live | Comms + HR interviews |

IT setup guide: [M365_SETUP.md](./M365_SETUP.md)

---

## 8. Mobile checklist for client QA

1. `/login/site` on phone → attendance punch with selfie + GPS  
2. Confirm time shows **IST** and message mentions **SharePoint**  
3. **Upload Lab** — camera photo + PDF markup  
4. **Documents** — browse folder, preview PDF  
5. **Drawings** — open GFC register, view published revision  

---

## 9. Related documents (share this folder)

| Document | Purpose |
|----------|---------|
| [CLIENT_REQUIREMENTS.md](./CLIENT_REQUIREMENTS.md) | Full module requirements (sign-off baseline) |
| [CLIENT_DELIVERY_UPDATE.md](./CLIENT_DELIVERY_UPDATE.md) | Technical delivery detail |
| [CLIENT_BRAND_GUIDE.md](./CLIENT_BRAND_GUIDE.md) | Logo, colours, portal tones |
| [SHAREPOINT_RENDER_ENV.md](./SHAREPOINT_RENDER_ENV.md) | IT — env vars & upload troubleshooting |
| [PMC_DMS_HANDOVER.md](./PMC_DMS_HANDOVER.md) | SharePoint folder map |

---

*SPDC-CLIENT-UPDATES-REV02 · Aug 2026 · CLIENT_REQUIREMENTS v2.1*
