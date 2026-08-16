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

### Changes during testing
| Date | Raised by | Change requested | Decision | Status |
|------|-----------|------------------|----------|--------|
| | | NCR form fields vs Safety NCR.xlsx | | Open |
| | | Separate from Quality NCR | | Open |

### Client sign-off
- [ ] Page approved for UAT

---

## Related pages

- Safety checklist master → `/safety/checklist-master`
- Safety fill log → `/safety/checklist-logs`
- Safety RFI → `/rfis?kind=SafetyChecklist`
