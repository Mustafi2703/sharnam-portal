# Module 05 — Progress

**Test order:** #6  
**Hub:** `/projects/:id/hub/progress`

---

## Tool nav tabs

Overview · Milestones · Planned vs Actual · Monthly progress · Hindrance · Risk · Legal approvals · S-curve *(ready)* · Summary schedule *(ready)* · MS Project *(ready)* · Procurement *(ready)*

Query param: `?tab=overview|milestones|planned|monthly|hindrance|risk|legal|scurve|schedule|msproject|procurement`

---

## Page: Progress (all tabs)

| | |
|--|--|
| **Route** | `/projects/:id/progress?tab=` |

### Form: Milestone
code, category, activity, baselineDate, forecastDate, actualDate, days, weightage, pctComplete, status

### Form: Hindrance
description, location, activity, category, type, occurredAt, daysImpacted, delayType, accountable, status

### Form: Risk
code, name, category, opportunityThreat, probability, consequence, costImpact, description, status

### Form: Legal approval
approvalId, category, authority, description, packageName, status, responsible

### Form: Planned vs actual import
Excel file → `POST .../planned-actual/import`

### Modals
None.

### Meeting changes (log in session → dev builds → re-test)

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |
| 2 | | | | Open | ☐ |
| 3 | | | | Open | ☐ |


### Client sign-off
- [ ] Page approved for UAT
