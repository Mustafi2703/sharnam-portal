# Module 12 — Global office (Master, HRMS, CRM)

**Test order:** #0 or parallel with Module 00  
**Not under project tool strip** — sidebar / top bar entry

---

## Page: Master module

| | |
|--|--|
| **Route** | `/master` |
| **Tabs** | Projects · Directory (4 users) · PMC roster · Module toggles · Global masters · CRM · HRM · Docs |

### Form: Create project
code, name, clientName, location

### Form: Assign member / vendor to project
userId + role · vendorId + tradeRole

### Meeting changes (log in session → dev builds → re-test)

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |
| 2 | | | | Open | ☐ |
| 3 | | | | Open | ☐ |


---

## Page: Company vendor directory

See [00-home-directory-vendors](./00-home-directory-vendors.md) — `/master/vendors`

---

## Page: Global checklist master

| | |
|--|--|
| **Route** | `/master/checklists` |

Same as project checklist master but org-wide templates.

---

## HRMS (`/hrm/*`)

| Route | Purpose |
|-------|---------|
| `/hrm` | Employee hub |
| `/hrm/recruitment` | Jobs, candidates |
| `/hrm/onboarding` | Offer → onboarding |
| `/hrm/payroll` | Payslips, hikes |
| `/hrm/attendance` | Roster |
| `/hrm/leave` | Leave types & requests |
| `/hrm/masters` | Geofence, shifts |

### Meeting changes (log in session → dev builds → re-test)

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |
| 2 | | | | Open | ☐ |
| 3 | | | | Open | ☐ |


---

## CRM (`/crm/*`)

Leads · wizard · convert to project · vendor bids · bid compare

### Meeting changes (log in session → dev builds → re-test)

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |
| 2 | | | | Open | ☐ |
| 3 | | | | Open | ☐ |


---

## Page: Roles & audit

| Route | Purpose |
|-------|---------|
| `/roles` | Portal role permissions |
| `/audit` | System audit log |

### Client sign-off (office modules)
- [ ] Master approved
- [ ] HRMS approved
- [ ] CRM approved
