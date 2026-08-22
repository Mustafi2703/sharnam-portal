# 02 — LLD: HRMS

**Version:** 0.1 · 2026-08-03  
**Status:** Partial exists (employees, attendance upsert, leave approve) · remainder **Design / Build next**  
**UI entry:** `/hrm` · Office Master link  
**API prefix:** `/api/hrm`

---

## 1. Scope

HRMS covers the employee lifecycle for Sharnam office and site staff, and feeds **project Directory**.

| Sub-module | Status |
|------------|--------|
| Employee directory / DOJ / assign to project | **Partial** |
| Attendance (basic check-in) | **Partial** |
| Leave request / approve | **Partial** |
| Recruitment & interview | **Design** |
| Pre-joining | **Design** |
| Onboarding | **Design** |
| Geofence + geotag + selfie attendance | **Design** |
| Leave types + holiday masters | **Design** |
| Personal diary | **Design** (Field day log **Exists** — link, do not replace) |
| Compensation + payslip PDF | **Design** (v1: no full statutory engine) |
| Training + Employee KPI/KRA | **Design** |
| HRMS admin masters | **Design** |

**Payroll v1 default:** compensation structure records + payslip PDF upload/generate. Full PF/ESIC auto-calc = future.

**Meetings for HR interviews:** Microsoft Teams only (see Graph LLD).

---

## 2. Roles

| Role | Capabilities |
|------|----------------|
| HR / Office / Admin | Full HRMS, masters, approvals, offers, payslips |
| Reporting manager | Interview feedback, leave recommend/approve (policy), team diary view (if allowed) |
| Employee | Self profile (limited), punch, leave request, personal diary, view payslips, training, policy ack |
| Site employee | Same as employee + geo punch at assigned sites |
| Candidate | No portal login until joining (email links optional later) |

---

## 3. Recruitment & Interview Management

### 3.1 Flow

Manpower Requisition → HR Approval → Job Posting (metadata) → Resume Database → Screening → Shortlist → Interview line-up → Schedule (Teams) → Feedback → Scorecard → Selection → Salary discussion → Offer Approval → Offer Letter → Acceptance → Joining Confirmation → Pre-joining.

### 3.2 Entities & fields

#### ManpowerRequisition

| Field | Type | Notes |
|-------|------|-------|
| id | cuid | |
| department | string | |
| designation | string | |
| headcount | int | |
| employmentType | enum | Permanent / Contract / Intern |
| requiredByDate | date | |
| justification | text | |
| status | enum | Draft / PendingHR / Approved / Rejected / Closed / Filled |
| requestedById | userId | |
| approvedById | userId? | |
| projectId | string? | Optional link to project need |

#### Candidate

| Field | Type | Notes |
|-------|------|-------|
| id | cuid | |
| fullName | string | |
| email | string | |
| phone | string | |
| source | string | LinkedIn / Naukri / Website / Referral / Other |
| resumeUrl | string | |
| currentCompany | string? | |
| experienceYears | float? | |
| expectedCtc | float? | |
| noticePeriodDays | int? | |
| status | enum | New / Screening / Shortlisted / Interview / Selected / Offered / Accepted / Joined / Rejected / OnHold |
| requisitionId | string? | |
| tagsJson | string? | |

#### Interview

| Field | Type | Notes |
|-------|------|-------|
| id | cuid | |
| candidateId | cuid | |
| roundType | enum | Technical / HR / Management |
| scheduledAt | datetime | |
| panelUserIdsJson | string | |
| teamsMeetingUrl | string? | From Graph |
| location | string? | Default Teams |
| status | enum | Scheduled / Completed / NoShow / Cancelled |
| feedbackJson | string? | Structured scores + comments |
| scorecardScore | float? | |
| recommendation | enum? | Hire / Reject / Hold / NextRound |

#### Offer

| Field | Type | Notes |
|-------|------|-------|
| id | cuid | |
| candidateId | cuid | |
| proposedCtc | float | |
| designation | string | |
| joinDate | date | |
| status | enum | Draft / PendingApproval / Approved / Sent / Accepted / Declined / Expired |
| offerLetterUrl | string? | Generated DOCX/PDF |
| approvedById | userId? | |
| acceptedAt | datetime? | |

### 3.3 APIs (proposed)

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/hrm/requisitions` | List / create |
| PATCH | `/api/hrm/requisitions/:id` | Approve / reject / update |
| GET/POST | `/api/hrm/candidates` | Resume DB |
| PATCH | `/api/hrm/candidates/:id` | Stage moves |
| POST | `/api/hrm/candidates/:id/interviews` | Schedule (+ Teams) |
| PATCH | `/api/hrm/interviews/:id` | Feedback / scorecard |
| POST | `/api/hrm/candidates/:id/offers` | Create offer |
| POST | `/api/hrm/offers/:id/generate-letter` | Doc generation |
| POST | `/api/hrm/offers/:id/send` | Outbox / Graph mail |

---

## 4. Pre-Joining Process

Triggered when offer **Accepted**.

| Checklist item | Field / entity | Owner |
|----------------|----------------|-------|
| Document collection | `PreJoinTask` type `Document` | HR + Candidate |
| Background verification | status + vendor ref | HR |
| Medical fitness | optional flag + file | HR |
| Employee code generation | `EmployeeProfile.empCode` | System / HR |
| Appointment letter | file URL | HR |
| IT asset allocation request | task + notes | IT / Office |
| Email ID creation | task + resulting email | IT |
| ID card request | task | Admin |
| Welcome kit | task | HR |

#### PreJoinTask

| Field | Type |
|-------|------|
| id, candidateId / userId, type, status (Pending/Done/Blocked), dueDate, completedAt, fileUrl, notes, assigneeId |

**API:** `GET/POST /api/hrm/prejoin/:candidateId/tasks`, `PATCH .../tasks/:id`

---

## 5. Employee Onboarding

On **Joining Confirmation**, create/link `User` + `EmployeeProfile` and run onboarding form.

| Section | Fields |
|---------|--------|
| Joining formalities | joinDate, workLocation, employmentType |
| Personal | fullName, dob, gender, maritalStatus, address, emergencyContact |
| Bank | bankName, accountNo (masked), ifsc |
| KYC | pan, aadhaar (masked), uploads |
| Statutory | pfUan, esicNo |
| Nominee | nomineeName, relation, share% |
| Org | department, designation, reportingManagerId, projectIds[] |
| Orientation | orientationCompletedAt |
| Policy ack | policyVersion, acknowledgedAt |

**Document verification** status: Pending / Verified / Rejected per doc.

**API:**  
`POST /api/hrm/employees` (**Exists** — extend body)  
`GET/PATCH /api/hrm/employees/:id/onboarding`  
`POST /api/hrm/employees/:id/policy-ack`

---

## 6. Employee management & Directory

### 6.1 EmployeeProfile (**Exists** — extend)

| Field | Status |
|-------|--------|
| userId, empCode, department, designation, joinDate | **Exists** |
| status (Active/Inactive/Exited) | **Design** |
| reportingManagerId | **Design** |
| workEmail, phone | via User / **Design** |
| defaultProjectId | **Design** |
| personalDefaultsJson | **Design** (UI prefs) |

### 6.2 Project assign (**Exists**)

`POST /api/hrm/assign` → `ProjectMember` + Directory visibility.

### 6.3 Directory

Four party tools remain Master/Directory; HRMS is the **people pool** for Office/Site employees.

---

## 7. Attendance — geofence, geotag, selfie

### 7.1 Concept

Only employees **assigned** to a project/site with an active **Geofence** may mark present when:
1. Device GPS is inside geofence radius (or polygon), and  
2. Selfie is captured, and  
3. Photo metadata / client-sent lat-lng match (geotag), within tolerance.

### 7.2 GeofenceSite

| Field | Type | Notes |
|-------|------|-------|
| id | cuid | |
| projectId | cuid | |
| name | string | e.g. Main gate |
| lat | float | Center |
| lng | float | |
| radiusMeters | int | Default 150–300 |
| polygonJson | string? | Optional richer boundary |
| isActive | bool | |

### 7.3 AttendancePunch (extends Attendance)

| Field | Type | Notes |
|-------|------|-------|
| attendanceId / userId+date | | Link to `Attendance` |
| punchType | enum | CheckIn / CheckOut |
| punchedAt | datetime | |
| lat, lng | float | Client GPS |
| accuracyMeters | float? | |
| selfieUrl | string | Auth-gated |
| geofenceSiteId | cuid | |
| distanceMeters | float | Server-computed |
| verificationStatus | enum | Verified / OutOfFence / ManualOverride / Failed |
| deviceInfo | string? | |

### 7.4 Attendance (**Exists** — extend)

Keep `status`, `checkIn`, `checkOut`; add `source` = Geo / Manual / Import.

**Office override:** HR may mark attendance without geo (audited).

### 7.5 APIs

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/hrm/geofences` | Master by project |
| POST | `/api/hrm/attendance/punch` | Geo punch + selfie multipart |
| GET/POST | `/api/hrm/attendance` | **Exists** list / upsert |
| POST | `/api/hrm/attendance/override` | HR manual |

**Idempotency:** one CheckIn per user/date unless CheckOut; reject duplicate CheckIn with `409`.

---

## 8. Leave & Holiday masters

### 8.1 LeaveType (master)

| Field | Type |
|-------|------|
| id, code, name, paid (bool), maxDaysPerYear, carryForward, requiresApproval, isActive |

HR can **add/edit** leave types in HRMS admin.

### 8.2 HolidayCalendar

| Field | Type |
|-------|------|
| id, date, name, region / optional projectId, isOptional |

### 8.3 LeaveRequest (**Exists** — extend)

| Add | Type |
|-----|------|
| leaveTypeId | cuid |
| dayCount | float |
| approverId | cuid? |
| decidedAt | datetime? |

**APIs:**  
`GET/POST /api/hrm/leave-types`  
`GET/POST /api/hrm/holidays`  
`GET/POST /api/hrm/leave` (**Exists**)  
`PATCH /api/hrm/leave/:id` (**Exists** — approve/reject)

---

## 9. Personal diary

| Aspect | Design |
|--------|--------|
| Purpose | Employee daily personal work diary (HRMS) |
| Storage | `PersonalDiaryEntry` org-scoped by userId + date |
| Relation to Field day log | **Separate**: project `DailyLog` stays project Field tool; personal diary is employee-owned. Optional “promote to project day log” action later |
| Fields | date, title, body, mood/tags optional, attachmentUrls, createdAt |
| Visibility | Employee + HR (policy); manager optional |

**APIs:** `GET/POST /api/hrm/diary`, `PATCH/DELETE /api/hrm/diary/:id`

---

## 10. Compensation & payslips (v1)

### 10.1 CompensationProfile

| Field | Type |
|-------|------|
| userId | cuid |
| effectiveFrom | date |
| ctcAnnual | float |
| basicMonthly | float? |
| allowancesJson | string? |
| deductionsJson | string? (manual notes, not auto PF engine) |
| currency | INR |

### 10.2 Payslip

| Field | Type |
|-------|------|
| userId, periodYYYYMM, gross, net, fileUrl (PDF), uploadedById, notes |

**APIs:**  
`GET/PUT /api/hrm/compensation/:userId`  
`GET/POST /api/hrm/payslips`  
`GET /api/hrm/payslips/:id/file` (auth)

**Out of v1:** automated statutory payroll run, bank file export.

---

## 11. Training & Employee KPI / KRA

Aligned with [`docs/MASTER_KPI_DASHBOARD.xlsx`](../MASTER_KPI_DASHBOARD.xlsx) sheet `06_ROLE_KRA`.

### TrainingRecord

| Field | Type |
|-------|------|
| userId, title, provider, trainedOn, hours, certificateUrl, status |

### EmployeeKraCycle

| Field | Type |
|-------|------|
| userId, roleTemplate (e.g. Project Manager), periodStart, periodEnd, status |
| items: kraText, evidenceRef, selfScore, reviewerScore |

### EmployeeKpiLine

| Field | Type |
|-------|------|
| cycleId, kpiCode, target, actual, rag |

Evidence may link to project KPI subjects / audit findings (see [05-LLD-Audit-KPI.md](./05-LLD-Audit-KPI.md)).

**APIs:** `/api/hrm/training`, `/api/hrm/kra-cycles`, `/api/hrm/kra-cycles/:id/score`

---

## 12. HRMS admin masters (summary)

| Master | CRUD |
|--------|------|
| Departments / designations | Design |
| Leave types | Design |
| Holidays | Design |
| Geofences (per project) | Design |
| Policy documents + version | Design |
| Offer / appointment letter templates | Design |
| Role KRA templates (from Excel) | Design |

**UI area:** HRMS → Masters tab.

---

## 13. Existing API surface (keep & extend)

| Method | Path | Today |
|--------|------|-------|
| GET/POST | `/api/hrm/employees` | Create + profile |
| POST | `/api/hrm/assign` | Project assign |
| GET/POST | `/api/hrm/attendance` | Upsert day |
| GET/POST | `/api/hrm/leave` | Request |
| PATCH | `/api/hrm/leave/:id` | Approve |

---

## 14. UI structure (proposed)

```
/hrm
  Dashboard (headcount, pending leave, open offers, punches today)
  Employees
  Recruitment (Requisitions | Candidates | Interviews | Offers)
  Pre-join / Onboarding
  Attendance (Punches | Geofences | Overrides)
  Leave (Requests | Types | Holidays)
  Personal Diary
  Compensation & Payslips
  Training & KRA
  Masters
```

Workday-like density: filters, status chips, detail drawer — match portal chrome (navy/amber).

---

## 15. Audit events (minimum)

`hrm.employee.create`, `hrm.attendance.punch`, `hrm.attendance.override`, `hrm.leave.decide`, `hrm.offer.send`, `hrm.payslip.upload`, `hrm.policy.ack`, `hrm.kra.score`

Next: [03-LLD-CRM.md](./03-LLD-CRM.md).
