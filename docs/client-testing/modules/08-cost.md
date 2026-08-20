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
BoqMonitoringEditor · BbsEntryTable · MbEntryTable · CostSheetUploadPanel

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
