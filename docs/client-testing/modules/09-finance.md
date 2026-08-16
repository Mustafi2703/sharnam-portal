# Module 09 — Finance

**Test order:** #9 (same session as Cost)  
**Hub:** `/projects/:id/hub/finance`

---

## Tool nav tabs

Overview · Project CAPEX · Purchase Orders · RA Bill Tracker · COP · Payment Summary · Audit Sheets

Query: `?tab=overview|capex|po|ra|cop|summary|audit`

---

## Page: Finance (all tabs)

| | |
|--|--|
| **Route** | `/projects/:id/finance?tab=` |

### Form: CAPEX line
srNo, description, packageName, stakeholder, budgetedAmount, workOrderValue

### Form: Purchase order
poNumber, poDate, vendorName, workTrade, packageName, orderValue, retentionPct, advancePct, PAN, GST, payableTo

### Form: RA bill
RA/invoice fields, GST, recoveries, netAmountPayable

### Form: COP
certificate fields, WO values, amounts, PAN/GST, remarks

### Modals
None.

### Changes during testing
| Date | Raised by | Change requested | Decision | Status |
|------|-----------|------------------|----------|--------|
| | | Link COP to cost cashflow | | Open |
| | | Audit export to SharePoint | | Open |

### Client sign-off
- [ ] Page approved for UAT
