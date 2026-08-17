# Module 04 — Safety

**Test order:** #5  
**Hub:** `/projects/:id/hub/safety`

---

## Tool nav tabs

Dashboard · Site Instruction · Unsafe Act Summary · NCR Summary · NCR Form · Observation · HIRA · Safety Hours · Safety checklist master · Safety fill log · Safety checklist RFI

---

## Page: Safety register (all sheets)

| | |
|--|--|
| **Route** | `/projects/:id/safety?sheet=` |
| **Sheets** | ``, `site-instruction`, `unsafe-act-summary`, `ncr-summary`, `ncr-form`, `observation`, `hira`, `safety-hours` |

### Form: Create safety record
| Field group | Examples |
|-------------|----------|
| Core | recordType, severity, title, description, location, category, status |
| NCR | ncrNumber, activityTask, issuedTo, responsibleParty, correctiveAction, dates, impacts |
| Observation | source, unsafe act fields |

**API:** `POST /api/safety/project/:id` · `PATCH /api/safety/:id`

### Modals
None.

### In-page filters (not module nav)
All / Open / Closed / record types — list filter only.

### Meeting changes (log in session → dev builds → re-test)

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |
| 2 | | | | Open | ☐ |
| 3 | | | | Open | ☐ |


### Client sign-off
- [ ] Page approved for UAT

---

## Related pages

- Safety checklist master → `/safety/checklist-master`
- Safety fill log → `/safety/checklist-logs`
- Safety RFI → `/rfis?kind=SafetyChecklist`
