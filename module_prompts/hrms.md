# HRMS (office) — build prompt

**SRS:** `docs/CLIENT_REQUIREMENTS.md` §4.14  
**Fields:** `docs/modules/MODULE_HRMS.md`  
**LLD:** `docs/system-design/02-LLD-HRMS.md`

## Tools

Dashboard · Employees · Recruitment · Pre-join/Onboarding · Attendance (geo+selfie) · Leave (+ types/holidays) · Personal Diary · Compensation/Payslips · Training & KRA · Masters

## Rules

- Feed project **Directory** via assign  
- Geo punch must pass geofence or HR override (audited)  
- Personal diary ≠ Field day log  
- Payslip v1 = PDF + compensation master (no full payroll engine)  
- Interviews = **Teams only**

## Exists today (extend)

Employees, assign, attendance upsert, leave request/approve — `/hrm`, `/api/hrm`
