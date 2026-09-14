# Sharnam — CRM, HRMS & Custom Sheets UAT Plan

Use this checklist **tomorrow morning** before client demo. Sign in as **admin** (`baibhabmustafi@gmail.com`) unless a step says otherwise. Use **Sign in as** on Office → Access or HRMS → Users to walk each desk.

**Do not re-run seed scripts** on production — data is already live.

---

## 0. Setup (5 min)

| Step | Action | Pass? |
|------|--------|-------|
| 0.1 | Office login → `/dashboard` loads | ☐ |
| 0.2 | HR login → `/hrm` loads (Anushka: `/login/hr`) | ☐ |
| 0.3 | **Test mode** bar appears when using Sign in as; **Back to …** returns to admin | ☐ |
| 0.4 | HRMS → Users → **Clear seeded assignments** once if everyone still shows on every project | ☐ |

---

## 1. CRM desk (45 min)

### 1.1 Leads → Proposal → Award → Project

| # | Steps | Expected |
|---|--------|----------|
| 1 | CRM → Leads → pick a lead → **Convert to proposal** | Opens proposal maker; SharePoint file created |
| 2 | Proposal → add revision (R1) | New revision on register |
| 3 | Proposals → **Award → projects register** | Project lands as **Planning** |
| 4 | Projects → **Edit card & team** | Full form: client, consultants, vendors, SPDC staff |
| 5 | Save → assign 2 staff + 1 vendor | Saved without auto-assigning whole team |
| 6 | Continue setup → matrix → **Complete setup** | Status **In Progress** |
| 7 | In Progress project → **Edit card & team** again | Add another consultant + employee mid-job |

### 1.2 Directories & bids

| # | Steps | Expected |
|---|--------|----------|
| 8 | CRM → Clients / Consultants / Vendors — add one row each | Login path shown; no duplicate email |
| 9 | CRM → **Bid management** → pick project → add vendor → upload BOQ | Vendor sees bid at `/login/vendor` |
| 10 | Open vendor desk (Sign in as vendor) | Bid list scoped to their packages only |

### 1.3 Impersonation matrix (CRM)

| Role | Login | Must see | Must NOT see |
|------|-------|----------|--------------|
| Office | `/login/office` | CRM, projects register, Access | HR-only if not HR role |
| Client | `/login/client` | Their project card / desk | CRM write, other projects |
| Vendor | `/login/vendor` | Bids + assigned project | HRMS, office CRM |

---

## 2. HRMS desk (60 min) — Nirav checklist

### 2.1 Masters & users (first)

| # | Steps | Expected |
|---|--------|----------|
| 1 | HRMS → **Masters** → add departments (Site, HR, Planning) | Appears in list |
| 2 | HRMS → **Users** → Edit staff → **Payroll · CTC block** | CTC annual + basic + HRA saved |
| 3 | Assign 2 site staff to **one project only** (× removes wrong assignments) | Projects column correct |

### 2.2 Recruitment (tabs 1–5)

| Tab | Test | Expected |
|-----|------|----------|
| **1 Requisition** | Submit req → HR **Approve** | Status Approved |
| **2 Postings** | Publish from approved req; note channels | Logged in Activity; applicant count 0 |
| **3 Candidates** | Add candidate + resume upload; shortlist | In resume DB; stage changes |
| **4 Interviews** | Schedule meeting; scorecard Advance/Hold/Reject | Panel + interviewee on record |
| **5 Offers** | CTC compute → draft offer → Sent → **Accepted** | Offer row updates |

### 2.3 Onboarding (pre-join + Day 1)

| # | Steps | Expected |
|---|--------|----------|
| 1 | Onboarding → open accepted offer | Checklist visible |
| 2 | Generate **appointment letter** (SPDC template) | Letter on Drive |
| 3 | Pre-join fields + HR policy acknowledgement | Saved |
| 4 | Mark onboarding items complete | Status progresses |

Reference docs: `module_prompts/Sharnam_modules_docs 2/SPDC_Letter_of_Appointment.docx`

### 2.4 Time & pay

| Module | Test | Expected |
|--------|------|----------|
| **Attendance** | Site employee check-in (Sign in as site) | Punch saved |
| **Leave** | Employee submit → HR approve | Balance updates |
| **Vouchers** | Submit → HR approve | Status Approved |
| **Payroll** | Set CTC on 3 staff → Generate all for current month | Slips in table; **View slip** opens HTML |
| **Payroll edit** | Edit basic/HRA on one slip → Save → regenerate file | Net pay updates |

Reference: `KGDPL_JUN_2026_9210100157_Payslip.pdf`, `SPDC_CTC_Structure_Calculator.xlsx`

### 2.5 Documents

| # | Steps | Expected |
|---|--------|----------|
| 1 | Letters → generate appointment / relieving | Filed on Drive |
| 2 | Employee files → upload PAN for one user | Multi-file on profile |

### 2.6 HR impersonation

| Sign in as | Desk | Key check |
|------------|------|-----------|
| Anushka (HR) | `/hrm` only | Cannot open office CRM |
| Site engineer | `/attendance` | Cannot approve own leave as admin |
| Office | `/dashboard` + `/hrm` | Full CRM + HR write |

---

## 3. Custom Sheet Maker (20 min)

Path: Office → **Custom sheets** (`/custom-sheets`)

| # | Steps | Expected |
|---|--------|----------|
| 1 | Create blank sheet OR upload `.xlsx` | Preview tabs; import rows |
| 2 | Edit cells + formula (`=SUM(A1:A5)`) | Preview recalculates |
| 3 | Save → Export to SharePoint | Download link works |
| 4 | Link sheet to a **project** (filter dropdown) | Scoped list |

---

## 4. Known gaps (do not block demo — note if seen)

| Area | Gap | Workaround |
|------|-----|------------|
| Posting publish | LinkedIn/Naukri API not wired | Log in Sharnam + post manually; channels field is audit trail |
| Department master | Needs `npx prisma migrate deploy` once on server | GET still lists departments from existing employee/requisition text |
| Payslip PDF | HTML on Drive (not PDF binary) | Print to PDF from browser if client needs PDF |
| Project module | Full site modules — test after CRM/HRMS sign-off | Use Open desk on one In Progress job only |

---

## 5. Sign-off

| Module | Tester | Date | Pass / Fail | Notes |
|--------|--------|------|-------------|-------|
| CRM pipeline | | | | |
| CRM bids | | | | |
| HRMS recruitment | | | | |
| HRMS onboarding | | | | |
| HRMS payroll | | | | |
| Custom sheets | | | | |

---

## Quick commands (server — no seed)

```bash
# After deploy only — creates HrmDepartment table
npx prisma migrate deploy

# Rebuild
npm run build
```

**Never run:** `npm run db:seed*` on production unless explicitly resetting demo data.
