# Module 08 — Cost

**Test order:** #9  
**Hub:** `/projects/:id/hub/cost`

---

## Tool nav tabs

BOQ / Monitoring · MB sheets · BBS · Budget WBS · Cash Flow Chart · Cash Flow Forecast · Cashflow Tracking · Rate difference · COP / Bills · Structure upload

Query: `?tab=` · `?pkg=` (package filter on monitoring/MB/BBS) · `?cf=` (chart/forecast/tracking) · cashflow **Day / Week / Month** grain chips (COP actuals)

> **COP:** Finance → COP (Certified/Approved/Paid) writes Cost cashflow actual. **MB → Monitoring achieved** via sync. **Not** Progress Planned vs Actual (weekly qty).

---

## Page: Cost (all tabs)

| | |
|--|--|
| **Route** | `/projects/:id/cost?tab=` |

### Form: MB line
packageName, srNo, description, nos1, nos2, length, width, height, unit

### Form: Vendor bill
vendorId, billNo, amount, gstAmount, copNo, description, pmcPartyId, status

### Form: Budget / cashflow / BOQ structure import
File upload to respective import endpoints

### Inline editors
BoqMonitoringEditor (full SPDC Monitoring columns) · BudgetWbsRegister · BbsEntryTable · MbEntryTable · CostSheetUploadPanel

### Load template
**Load budget template** on Budget or Monitoring → `POST /api/cost/:id/sync-template` pulls `SPDC_Budget_Arvind 49.xls` (Budget + all Monitoring + MB + BBS + rates), same idea as QAP / Cube sync.

### Modals
None (upload panels inline).

### Meeting changes (log in session → dev builds → re-test)

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |
| 2 | | | | Open | ☐ |
| 3 | | | | Open | ☐ |


### Client sign-off
- [ ] Page approved for UAT
