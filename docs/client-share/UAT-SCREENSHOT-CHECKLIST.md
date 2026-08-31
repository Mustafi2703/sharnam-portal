# UAT Screenshot Pack — Module-wise capture guide

**Portal:** https://portal.spdc.in  
**Login:** `office@sharnam.demo` / `Demo@1234` (office) · `site@sharnam.demo` (site)  
**Demo project:** SPDC-DEMO-01  
**Output folder:** `docs/client-share/uat-screenshots/` (create locally, upload to Google Drive for client)

---

## How to capture (15 min setup)

1. Create folder: `Sharnam Portal UAT Screenshots — Aug 2026`
2. Browser: **1440×900** or full-screen laptop (consistent width)
3. Hide personal bookmarks bar for clean shots
4. Naming: `NN-module-short-name.png` (e.g. `01-login-hub.png`)
5. For each module: **1 overview** + **1 action** (form/modal/upload) if applicable
6. Site modules: repeat key shots on **mobile** (iPhone/Android) → prefix `mobile-`

Optional seed before capture (local or staging):

```bash
npm run db:seed-demo-screenshots
```

---

## Capture checklist

Replace `{PID}` with project id from URL after opening SPDC-DEMO-01.

| # | File name | URL | What to show | Role |
|---|-----------|-----|--------------|------|
| 01 | `01-login-hub.png` | `/login` | Four portal tiles + logo | — |
| 02 | `02-login-office.png` | `/login/office` | Office sign-in hero | Office |
| 03 | `03-dashboard.png` | `/dashboard` | Cross-project KPIs | Office |
| 04 | `04-master.png` | `/master` | Projects + module toggles | Office |
| 05 | `05-crm-register.png` | `/crm` | **Register view — 530 rows, filters, detail panel** | Office |
| 05a | `05a-bid-management.png` | `/crm/bid-compare/{PKG}` | Bid package + vendor matrix | Office |
| 05b | `05b-bid-comparative.png` | `/crm/bid-compare/{PKG}` | Comparative statement (L1) | Office |
| 05c | `05c-vendor-fill-boq.png` | `/crm/vendor-bids` (vendor login) | Vendor fill BOQ online | Vendor |
| 06 | `06-crm-convert-modal.png` | `/crm` | Convert to project modal open | Office |
| 07 | `07-project-home.png` | `/projects/{PID}` | Project home + Load SPDC sheets | Office |
| 08 | `08-drawings-gfc.png` | `/projects/{PID}/drawings/register` | GFC register | Office |
| 09 | `09-drawings-upload.png` | `/projects/{PID}/drawings/upload-revision` | Drawing check + upload | Office |
| 10 | `10-dms-browse.png` | `/projects/{PID}/dms` | ISO folder tree + preview | Office |
| 11 | `11-quality-dashboard.png` | `/projects/{PID}/inspections` | Quality dashboard | Office |
| 12 | `12-qap.png` | `/projects/{PID}/qap` | QAP Week 50 grid | Office |
| 13 | `13-quality-cube.png` | `/projects/{PID}/inspections?sheet=cube` | Cube register | Office |
| 14 | `14-safety.png` | `/projects/{PID}/safety` | Safety dashboard | Office |
| 15 | `15-progress-pva.png` | `/projects/{PID}/progress?tab=planned` | Planned vs Actual | Office |
| 16 | `16-cost-monitoring.png` | `/projects/{PID}/cost?tab=monitoring` | BOQ monitoring | Office |
| 17 | `17-cost-cashflow.png` | `/projects/{PID}/cost?tab=cashflow` | Cashflow chart | Office |
| 18 | `18-finance-cop.png` | `/projects/{PID}/finance?tab=cop` | COP register | Office |
| 19 | `19-finance-invoice.png` | `/projects/{PID}/finance?tab=invoices` | Material invoices | Office |
| 20 | `20-comms-matrix.png` | `/projects/{PID}/comms?tab=matrix` | Communication matrix | Office |
| 21 | `21-comms-meeting.png` | `/projects/{PID}/comms?tab=meetings` | Meeting + MoM | Office |
| 22 | `22-dpr-maker.png` | `/projects/{PID}/dpr-maker` | DPR Maker CIVIL + auto-fill | Office |
| 23 | `23-dpr-publish.png` | DPR Maker | Published success / download | Office |
| 24 | `24-wpr-maker.png` | `/projects/{PID}/wpr-maker` | WPR pack | Office |
| 25 | `25-audit-kpi.png` | `/projects/{PID}/audit-kpi` | Audit dashboard | Office |
| 26 | `26-closure-snag.png` | `/projects/{PID}/closure?sheet=snaglist` | Snaglist | Office |
| 27 | `27-closure-lessons.png` | `/projects/{PID}/closure?sheet=lessons` | Lessons learnt | Office |
| 28 | `28-hrm-desk.png` | `/hrm` | HRMS hub | Office |
| 29 | `29-hrm-recruitment.png` | `/hrm/recruitment` | Recruitment pipeline | Office |
| 30 | `30-attendance.png` | `/attendance` | Site attendance punch | **Site mobile** |
| 31 | `31-field-diary.png` | `/projects/{PID}/diary` | Day log | Site |
| 32 | `32-field-photos.png` | `/projects/{PID}/photos` | Site photos | Site |
| 33 | `33-checklist-fill.png` | Checklist fill link | Branded checklist fill | Site |
| 34 | `34-client-drawings.png` | `/login/client` → drawings | Read-only published GFC | Client |
| 35 | `35-client-dpr.png` | Client → Reports | DPR PDF view | Client |

---

## CRM screenshots (important for this release)

| Shot | Steps |
|------|-------|
| **Register** | `/crm` → Leads board → **Register (all rows)** → show filters + row count 530+ |
| **Detail panel** | Click any Under Construction project → detail panel with description |
| **Convert** | Click **Convert to SPDC project** → modal with client card pre-filled |
| **Market view** | Toggle **By market status** → columns Under Construction / Pre-Construction / On Hold |
| **Import** | Reference toolbar → show upload hint for Data - July 2026 |

---

## DPR discipline screenshots (7 packages)

Capture DPR Maker once per discipline (can be thumbnails in one doc):

| File | Discipline |
|------|------------|
| `dpr-civil.png` | CIVIL |
| `dpr-electrical.png` | ELECTRICAL |
| `dpr-fire.png` | FIRE |
| `dpr-mechanical.png` | MECHANICAL |
| `dpr-peb-erection.png` | PEB_ERECTION |
| `dpr-peb-supply.png` | PEB_SUPPLY |
| `dpr-plumbing.png` | PLUMBING |

---

## Send to client for UAT

1. Upload screenshot folder to **Google Drive**
2. Link in [12-Live-Client-UAT-Workbook.md](./12-Live-Client-UAT-Workbook.md) Section 1
3. Share with SPDC → **Viewer** for sign-off comments, **Editor** for PM team
4. Pair with live portal access: https://portal.spdc.in/login/office

---

## Sign-off table (paste in UAT doc)

| Module | Screenshot | Client Pass | Date |
|--------|:----------:|:-----------:|------|
| CRM register + convert | 05–06 | ☐ | |
| Drawings | 08–09 | ☐ | |
| DPR (7 disciplines) | 22–23 + dpr-* | ☐ | |
| Site mobile | 30–33 | ☐ | |
| … | … | ☐ | |
