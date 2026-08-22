# MODULE — HRMS (fields)

**Status:** Refine → then build  
**SRS:** [CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md) §4.14  
**LLD:** [system-design/02-LLD-HRMS.md](../system-design/02-LLD-HRMS.md)  
**UI:** `/hrm` · **API:** `/api/hrm`

Mark columns **Keep / Change / Drop** in review meetings.

---

## 1. Tools (UI tabs)

| Tool | Purpose |
|------|---------|
| Dashboard | Headcount, pending leave, open offers, punches today |
| Employees | Directory, DOJ, assign to project |
| Recruitment | Requisitions, Candidates, Interviews, Offers |
| Pre-join / Onboarding | Checklist + joining forms |
| Attendance | Punches, geofences, HR overrides |
| Leave | Requests, Leave types, Holidays |
| Personal Diary | Employee daily diary |
| Compensation & Payslips | CTC master + PDF slips |
| Training & KRA | Training + appraisal cycles |
| Masters | Depts, policies, letter templates |

---

## 2. Manpower requisition

| Field | Type | Required | Notes / review |
|-------|------|----------|----------------|
| department | text | Y | |
| designation | text | Y | |
| headcount | number | Y | |
| employmentType | enum | Y | Permanent / Contract / Intern |
| requiredByDate | date | N | |
| justification | long text | N | |
| status | enum | Y | Draft / PendingHR / Approved / Rejected / Closed / Filled |
| requestedBy | user | Y | |
| approvedBy | user | N | |
| projectId | link | N | Optional project need |

---

## 3. Candidate (resume DB)

| Field | Type | Required | Notes / review |
|-------|------|----------|----------------|
| fullName | text | Y | |
| email | email | Y | |
| phone | text | Y | |
| source | enum/text | N | LinkedIn / Naukri / Website / Referral / Other |
| resumeUrl | file | Y | |
| currentCompany | text | N | |
| experienceYears | number | N | |
| expectedCtc | money | N | INR |
| noticePeriodDays | number | N | |
| status | enum | Y | New → … → Joined / Rejected / OnHold |
| requisitionId | link | N | |
| tags | list | N | |

---

## 4. Interview

| Field | Type | Required | Notes / review |
|-------|------|----------|----------------|
| candidateId | link | Y | |
| roundType | enum | Y | Technical / HR / Management |
| scheduledAt | datetime | Y | |
| panel | users[] | Y | |
| teamsMeetingUrl | url | N | Auto from Graph |
| location | text | N | Default Teams |
| status | enum | Y | Scheduled / Completed / NoShow / Cancelled |
| feedback | structured | N | Scores + comments |
| scorecardScore | number | N | |
| recommendation | enum | N | Hire / Reject / Hold / NextRound |

---

## 5. Offer

| Field | Type | Required | Notes / review |
|-------|------|----------|----------------|
| candidateId | link | Y | |
| proposedCtc | money | Y | |
| designation | text | Y | |
| joinDate | date | Y | |
| status | enum | Y | Draft → … → Accepted / Declined / Expired |
| offerLetterUrl | file | N | Generated |
| approvedBy | user | N | |
| acceptedAt | datetime | N | |

---

## 6. Pre-joining tasks

| Task type | Status values | Owner |
|-----------|---------------|-------|
| Document collection | Pending / Done / Blocked | HR + candidate |
| Background verification | | HR |
| Medical fitness | optional | HR |
| Employee code generation | | System / HR |
| Appointment letter | | HR |
| IT asset allocation | | IT / Office |
| Email ID creation | | IT |
| ID card request | | Admin |
| Welcome kit | | HR |

Per task: dueDate, assignee, fileUrl, notes.

---

## 7. Onboarding / employee profile

| Section | Fields |
|---------|--------|
| Joining | joinDate, workLocation, employmentType, empCode |
| Personal | fullName, dob, gender, maritalStatus, address, emergencyContact |
| Bank | bankName, accountNo (masked), ifsc |
| KYC | pan, aadhaar (masked), uploads |
| Statutory | pfUan, esicNo |
| Nominee | nomineeName, relation, share% |
| Org | department, designation, reportingManager, project assignments |
| Orientation | orientationCompletedAt |
| Policy | policyVersion, acknowledgedAt |
| Employment status | Active / Inactive / Exited |

---

## 8. Geofence & attendance

### Geofence (per project/site)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| projectId | link | Y | |
| name | text | Y | e.g. Main gate |
| lat / lng | number | Y | Center |
| radiusMeters | number | Y | Default 150–300 |
| polygonJson | json | N | Optional |
| isActive | bool | Y | |

### Punch

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| userId | link | Y | |
| date | date | Y | Unique with user |
| punchType | enum | Y | CheckIn / CheckOut |
| punchedAt | datetime | Y | |
| lat / lng | number | Y | Device GPS |
| accuracyMeters | number | N | |
| selfieUrl | file | Y | Auth-gated |
| geofenceSiteId | link | Y | |
| distanceMeters | number | Y | Server calc |
| verificationStatus | enum | Y | Verified / OutOfFence / ManualOverride / Failed |
| attendance status | enum | Y | Present / … |
| source | enum | Y | Geo / Manual / Import |

**Rule:** Out of fence → reject unless HR override (audited).

---

## 9. Leave & holidays

### Leave type master

| Field | Type | Notes |
|-------|------|-------|
| code | text | Unique |
| name | text | |
| paid | bool | |
| maxDaysPerYear | number | |
| carryForward | bool | |
| requiresApproval | bool | |
| isActive | bool | |

### Holiday

| Field | Type | Notes |
|-------|------|-------|
| date | date | |
| name | text | |
| region / projectId | optional | |

### Leave request

| Field | Type | Notes |
|-------|------|-------|
| userId | link | |
| leaveTypeId | link | |
| fromDate / toDate | date | |
| dayCount | number | |
| reason | text | |
| status | enum | Pending / Approved / Rejected |
| approverId | user | |
| decidedAt | datetime | |

---

## 10. Personal diary

| Field | Type | Notes |
|-------|------|-------|
| userId | link | Owner |
| date | date | |
| title | text | |
| body | long text | |
| tags | list | optional |
| attachments | files | optional |

**Visibility:** Employee + HR; manager optional (policy).  
**Not** the same entity as project Field day log.

---

## 11. Compensation & payslip (v1)

| Entity | Fields |
|--------|--------|
| Compensation | userId, effectiveFrom, ctcAnnual, basicMonthly, allowancesJson, deductionsJson (notes), currency INR |
| Payslip | userId, periodYYYYMM, gross, net, fileUrl (PDF), uploadedBy, notes |

**Out of v1:** automated PF/ESIC payroll run, bank file export.

---

## 12. Training & KRA

| Entity | Fields |
|--------|--------|
| Training | userId, title, provider, trainedOn, hours, certificateUrl, status |
| KRA cycle | userId, roleTemplate, periodStart/End, status |
| KRA item | kraText, evidenceRef, selfScore, reviewerScore |
| KPI line | kpiCode, target, actual, rag |

Role templates seeded from Master KPI pack (`06_ROLE_KRA`).

---

## 13. Roles (access)

| Role | Can |
|------|-----|
| HR / Office / Admin | Everything |
| Reporting manager | Feedback, leave decide (policy), limited team view |
| Employee / Site | Self punch, leave, diary, payslips, training, policy ack |

---

## 14. Review checklist

- [ ] Confirm leave type list for SPDC  
- [ ] Confirm geofence default radius  
- [ ] Confirm payslip v1 (PDF only) with client  
- [ ] Confirm Teams-only interviews  
- [ ] Confirm which KYC fields are mandatory at joining  
