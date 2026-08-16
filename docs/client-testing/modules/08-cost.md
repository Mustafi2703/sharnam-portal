# Module 08 — Cost

**Test order:** #9  
**Hub:** `/projects/:id/hub/cost`

---

## Tool nav tabs

BOQ / Monitoring · MB sheets · BBS · Budget WBS · Cash Flow Chart · Cash Flow Forecast · Cashflow Tracking · Rate difference · COP / Bills · Structure upload

Query: `?tab=` · `?pkg=` (package filter on monitoring/MB/BBS) · `?cf=` (chart/forecast/tracking on cashflow)

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

### Changes during testing
| Date | Raised by | Change requested | Decision | Status |
|------|-----------|------------------|----------|--------|
| | | Package list from SPDC budget | | Open |
| | | BBS bend diagrams | | Open |

### Client sign-off
- [ ] Page approved for UAT
