# शरणम् Construction Management Portal — App Overview

## What It Does (Short)

**शरणम्** is an all-in-one **PHP + MySQL construction company portal**. It lets staff and clients manage projects, people, documents, money, and site compliance from one place — with role-based access control.

Think of it as: **CRM + HR + Document Vault + Finance + Site Checklists + Employee Self-Service**, built for a construction firm.

---

## Core Modules

| Module | Folder | Purpose |
|--------|--------|---------|
| **Master Dashboard** | `dashboard.php` | Admin KPIs — active projects, employees, revenue, attendance, invoices |
| **CRM** | `crm/` | Leads, deals, contacts, clients, projects, invoices, client login credentials |
| **HRM** | `hrm/` | Employees, attendance, leave, salary slips, offer letters, negligence (NC) warnings |
| **DMS** | `dms/` | Project document folders, uploads, permissions, KRA/KPI tracking, shared links |
| **Finance** | `finance/` | Invoices, proforma, proposals, transactions, PDF generation |
| **Checklist** | `checklist/` | RFQ/site checklists, categories, photo gallery, QA/QC document tracking |
| **Employee Portal** | `employee_portal/` | Employee self-service — check-in/out, work reports, leave, negligence filing |
| **Client Portal** | `client/` | Clients view their project info after `client_login.php` |
| **Geofence** | `geofence/` | GPS-based office vs work-from-home login tracking |
| **RBAC / Admin** | `roles.php`, `user_settings.php`, `includes/` | Users, roles, page-level permissions across modules |

---

## How Users Enter the App

```
index.php  →  software_login.php  →  dashboard.php (admin/staff)
login_portal.php  →  employee / client / admin entry points
employee_login.php  →  employee_portal/
client_login.php  →  client/
```

- **Staff/Admin**: log in via `software_login.php`, land on `dashboard.php`
- **Employees**: use employee login → `employee_portal/` for attendance & self-service
- **Clients**: use `client_login.php` → `client/` portal for project visibility
- **Geofence module**: separate login with GPS location check

---

## Tech Stack

- **Backend**: PHP (procedural + some APIs), MySQL/MariaDB via MySQLi
- **Frontend**: Tailwind CSS, Font Awesome, Chart.js, SweetAlert2, GSAP
- **PDF**: TCPDF (bundled in `TCPDF-main/`, `package/`)
- **Excel**: PhpSpreadsheet (in `package/vendor/`)
- **DB config**: `db_connect.php` (root) + per-module copies in some subfolders
- **Shared layout**: `includes/layout.php`, `includes/module_layout.php`, `includes/sidebar.php`

---

## Database

- Schema dump: `Sarnam_db-4.sql`, `database_schema.sql`
- Table docs: `database_tables_documentation.md`
- Key table groups: `crm_*`, `employees`, `attendance`, `leave_requests`, `finance_*`, `checklist_*`, DMS folder/permission tables, `roles`, negligence tables

---

## Inconsistencies & Technical Debt

### 1. Multiple Duplicate Codebases (Critical)

The workspace contains **several near-identical copies** of the same app. It is unclear which is the live/canonical version:

| Copy | Notes |
|------|-------|
| **Root** (`crm/`, `hrm/`, `dms/`, etc.) | Appears to be the active codebase |
| `app1/`, `app2/`, `app3/` | Full or partial snapshots of the portal |
| `dms(1)/` … `dms(4)/` | Four variants of Document Management |
| `finance(1)/`, `finance(2)/` | Duplicate finance modules |
| `test/` | Another full copy with its own `db_connect.php` |
| `backup/` | Older finance backup |

**Risk**: Bug fixes applied in one folder may not exist in others. Developers can edit the wrong copy.

---

### 2. Broken or Mismatched Navigation Links

- Mobile nav in `includes/layout.php` links to `dms/index.php` — **no `dms/index.php` exists at root** (only `app1/dms/index.php`)
- Desktop sidebar in `includes/sidebar.php` links to `dms/user_folder_browser.php` instead
- DMS entry point is inconsistent between mobile and desktop layouts

---

### 3. Multiple Overlapping Login Systems

At least **5 separate login flows** with different session keys:

| Entry | Session keys used |
|-------|-------------------|
| `software_login.php` | `software_logged_in`, `software_username` |
| `employee_login.php` | `employee_logged_in`, `employee_emp_code` |
| `client_login.php` | `client_logged_in`, `client_id` |
| Admin handlers | `admin_id`, `admin_logged_in` |
| General layout check | `user_emp_code`, `user_role`, `role`, `is_admin` |

`includes/layout.php` accepts **any** of these sessions, but different pages check different keys — easy to get partial auth or redirect loops.

---

### 4. Database Column Naming Inconsistency

Mixed conventions across modules and docs:

| Pattern A | Pattern B | Example tables |
|-----------|-----------|----------------|
| `is_deleted` | `isDeleted` | `crm_projects` vs `clients`, `employees` |
| `employee_id` | `employeeId` | `attendance` table uses `employeeId` in employee portal queries |
| `deal_stage` | varies | CRM deals table structure noted as unstable in docs |

Dashboard APIs include fallback/sample data when expected columns are missing — a sign the schema and code are out of sync.

---

### 5. Hardcoded Secrets & Environment Config

`db_connect.php` contains **live production database host, username, and password** in plain text. Same pattern may exist in `finance/db_connect.php`, `geofence/db_connect.php`, and `test/db_connect.php`.

There is no `.env` or environment-based config — local vs production is handled by commenting/uncommenting blocks.

---

### 6. Branding & Naming Chaos

The project name is spelled differently everywhere:

- **शरणम्** (Hindi branding in UI)
- `sharnam`, `Sarnam`, `sarnam` (folder/file names)
- `f_sharnam/` (referenced in README install paths)
- `g_sarnam` (commented DB name in `db_connect.php`)
- `u252873650_sharnam_new` (active DB name)

Folder names with spaces: `checklist files/`, `sharnam projects/` — problematic on servers and in URLs.

---

### 7. Duplicate Feature Files

Same functionality implemented in multiple places:

| File | Locations |
|------|-----------|
| `employee_add.php` | `hrm/` and `employee_portal/` |
| `user_folder_browser.php` | `dms/user_folder_browser.php`, `dms/user_folder_browser(2).php`, `dms(4)/user_folder_browser(1).php` |
| `db_connect.php` | 15+ copies across modules and app snapshots |
| `create_blank_template.php` | root, finance, finance(1), finance(2), backup |

---

### 8. UI / Framework Inconsistency

- Most modules: **Tailwind CSS** + shared `includes/layout.php` theme
- `sa2/index.php`: **Bootstrap 5** with a completely different purple gradient design
- `geofence/`: standalone UI, not integrated into main sidebar
- `dashboard.php`: hardcoded welcome text **"Welcome back, Nirav"** instead of session user name
- Non-admin users on dashboard see **only a logo** — no redirect to their module

---

### 9. Root-Level Clutter

The project root has **100+ loose PHP files** that are not part of the core app flow:

- `debug_*.php` — debugging scripts
- `test_*.php` / `test_*.html` — manual test pages
- `fix_*.php` / `setup_*.php` — one-off migration/setup scripts
- `assign_mehul_to_project.php` — user-specific fix script
- `excel copy.php` — duplicate with space in name

These mix production code, experiments, and one-time fixes with no clear separation.

---

### 10. Permission System Complexity

Multiple overlapping permission approaches documented in separate markdown files:

- `PERMISSION_SYSTEM_EXPLANATION.md`
- `SIMPLIFIED_PERMISSIONS_SUMMARY.md`
- `DMS_PERMISSIONS_SETUP_GUIDE.md`
- `SIDEBAR_PERMISSIONS_UPDATE_SUMMARY.md`
- `ROLE_PERMISSIONS_FIX_SUMMARY.md`

DMS has its own permission tables (`dms_permissions`, role tree, folder-level ACL) **in addition to** the global roles/pages permission system — two parallel systems.

---

### 11. README / Docs Point to Wrong Paths

Example from `checklist/README.md`:

```
http://localhost/f_sharnam/setup_checklist_categories.php
http://localhost/f_sharnam/checklist/checklist_template.php
```

Actual workspace path is `/Users/baibhab/Downloads/app/` — docs are stale from an older deployment folder name.

---

### 12. Security Headers Inconsistency

- `dashboard.php` calls `header_remove("Content-Security-Policy")` then sets its own CSP
- `includes/layout.php` sets a different CSP in a `<meta>` tag
- Policies differ on allowed CDN sources between pages

---

### 13. Uploads & Sensitive Data in Repo

- `Uploads/aadhar_images/` — employee Aadhar (national ID) images stored in the workspace
- `php_errors.log`, `error_log.txt`, `upload_errors.log` — error logs committed alongside code
- `Sarnam_db-4.sql` — full database dump in the repo

---

## Recommended Canonical Structure (If Cleaning Up)

```
app/
├── crm/
├── hrm/
├── dms/              ← pick ONE, delete dms(1-4)
├── finance/          ← pick ONE, delete finance(1-2)
├── checklist/
├── employee_portal/
├── client/
├── geofence/
├── includes/
├── assets/
├── Uploads/          ← move outside web root or to cloud storage
├── api/
├── config/           ← single db_connect.php + .env
└── archive/          ← move app1/2/3, test/, backup/, debug_* here
```

---

## One-Line Summary

> **शरणम् is a construction company ERP built in PHP** — CRM, HR, documents, finance, checklists, and portals for employees/clients — but the workspace is bloated with duplicate modules, inconsistent naming, multiple login systems, and stale copies that make maintenance risky.

---

*Generated from workspace analysis — July 2026*
