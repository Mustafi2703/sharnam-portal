# MODULE — Cost (engineering measurement)

**Prompt:** `module_prompts/Cost_Module.md`  
**SRS:** [CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md) §4.9  
**Separate from:** [MODULE_FINANCE.md](./MODULE_FINANCE.md)

---

## 1. Purpose

Engineering cost control: BOQ monitoring, MB, BBS, budget WBS, cashflow, rate variance.  
**Not** commercial invoice/PO/RA/COP (those are Finance).

---

## 2. Tools

| Tool | Source sheet | Status |
|------|--------------|--------|
| Monitoring / BOQ | Monitoring * packages + Cashflow Monitoring | Built |
| MB sheets | Dormitory, Electric, Plumbing, UGWT, … | Built |
| BBS | Dormitory / Compound Wall / Septic / Road / UGWT | Built |
| Budget WBS | SPDC_Budget + Cashflow Budget | Built |
| Cashflow chart | Cashflow Dashboard — Chart INR | Built |
| Cashflow forecast | Cash Flow - Forecast | Built |
| Tracking | Cashflow Tracking | Built |
| Rate difference | Steel / Cement / Tiles | Built |
| Structure upload | Multi-BOQ import | Built |
| Vendor bills (legacy in cost) | Payment Summary seed | Prefer Finance COP going forward |

---

## 3. Package filter

Multiple BOQs/structures per project → each **package** is a tool chip / filter on registers.

---

## 4. Monitoring / BOQ line fields

| Field | Type | Required | Notes / review |
|-------|------|----------|----------------|
| package | text | Y | |
| srNo / itemCode | text | N | |
| description | text | Y | |
| unit | text | Y | |
| boqQty | number | N | |
| gfcQty | number | N | Fill on monitoring |
| rate | money | N | |
| amount | money | N | |
| excess / saving | number | N | Computed vs BOQ |

---

## 5. MB line

| Field | Notes |
|-------|-------|
| package, item, description, unit | |
| previous / this period / cumulative qty | |
| location / remarks | |

---

## 6. BBS line

| Field | Notes |
|-------|-------|
| package, bar mark, diameter, shape | |
| length, nos, weight | |
| location | |

---

## 7. Budget line

| Field | Notes |
|-------|-------|
| wbsCode, description | |
| budgetAmount, committed, spent | |
| package | |

---

## 8. Cashflow period

| Field | Notes |
|-------|-------|
| period (month) | |
| plannedInflow / plannedOutflow | |
| actualInflow / actualOutflow | |
| forecast | |

---

## 9. Rate difference

| Field | Notes |
|-------|-------|
| material (Steel / Cement / Tiles) | |
| baseRate / currentRate | |
| variance | |

---

## 10. Downloads

CSV per register:

`/api/cost/:projectId/download/{boq|mb|bbs|budget|cashflow|rates}.csv?package=`

---

## 11. Rules

1. Cost ≠ Finance.  
2. Fill GFC qty on monitoring; excess/saving computes.  
3. Client cannot edit commercial/cost numbers unless permitted.  
4. Seed loads sheet data on deploy for pilot.

---

## 12. Review checklist

- [ ] Confirm package list for pilot project  
- [ ] Confirm which Payment Summary rows stay in Cost vs move to Finance  
- [ ] Confirm CSV column order for client Excel  
