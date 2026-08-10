# Logins and access

**Demo:** https://sharnam-portal.onrender.com  
**Demo password:** `Demo@1234`

---

## Portal URLs

| Role | URL | Demo email | Lands on |
|------|-----|------------|----------|
| **Hub** (choose portal) | `/login` | — | Portal tiles |
| **Office / PMC** | `/login/office` | `office@sharnam.demo` | Project dashboard |
| **Site / field** | `/login/site` | `site@sharnam.demo` | **Attendance** |
| **Contractor** | `/login/vendor` | `vendor@sharnam.demo` | Workspace / assigned desk |
| **Client** | `/login/client` | `client@sharnam.demo` | Dashboard (read-first) |
| **Employee** | `/login/employee` | `employee@sharnam.demo` | Self-service / workspace |
| **HR admin** | `/login/hr` | `office@sharnam.demo` | HRMS desk (`/hrm`) |

After production cutover, replace the domain with SPDC’s own (e.g. `portal.spdc.in`).

---

## What each role sees

| Portal | Primary work | Upload files | View documents | Attendance |
|--------|--------------|:------------:|:--------------:|:----------:|
| **Office** | Full project control — all modules, master setup, reports | Yes | Full ISO tree (DMS) | HR roster + override |
| **Site** | Attendance punch, day log, photos, checklist fills | Yes | Assigned folders | **Selfie + GPS (IST)** |
| **Contractor** | Assigned packages, inspection fills, evidence | Yes | Shared / assigned | If site-assigned |
| **Client** | Published drawings, progress packs, concerns | No (default) | Shared / published only | No |
| **Employee** | Leave, diary, payslips, training | Limited | Per assignment | If site-assigned |

---

## Document access (Communication Matrix)

The **Communication Matrix** (under Comms) lists who is on the project for meetings and document circulation.

| Rule | Meaning |
|------|---------|
| **SharePoint is the store** | Files uploaded through the portal are saved in SharePoint first |
| **DMS is the viewer** | Documents tool browses the same SharePoint folders |
| **Matrix = named parties** | People on the matrix should receive access to the folders their role is granted |
| **In-app preview** | PDFs and images open inside the portal — not download-only |

Office configures which folders each role can open. Client and contractor see **published / shared** folders only.

---

## Site attendance (mobile)

1. Open `/login/site` on phone  
2. Sign in → lands on **Attendance**  
3. Allow **Camera** and **Location**  
4. Take selfie → **Check in** or **Check out**  
5. Confirm time shows **IST** and **SharePoint** on success  

Out-of-geofence punches are rejected unless HR overrides (audited).

---

## Production accounts

On SPDC’s server, demo `@sharnam.demo` accounts are replaced with real Microsoft 365 or local accounts assigned in **Master → Directory** and **HRMS → Employees**.

---

*Full detail: [../CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md) §1A · Brand: [05-Brand-and-Logo.md](./05-Brand-and-Logo.md)*
