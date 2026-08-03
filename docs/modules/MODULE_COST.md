# MODULE — Cost (engineering measurement)

**Prompt:** `module_prompts/Cost_Module.md`  
**SRS:** [CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md) §4.9  
**Hub:** `/projects/:id/hub/cost`  
**Separate from:** [MODULE_FINANCE.md](./MODULE_FINANCE.md)

---

## 1. Purpose

Engineering cost control: BOQ monitoring, MB, BBS, budget WBS, **Cashflow Chart / Forecast / Tracking** as separate tools, rate variance, COP/bills entry.  
**Not** commercial invoice/PO/RA (those are Finance).

---

## 2. Tools (sheet → hub card)

| Tool | Hub / route | Status | Source sheet |
|------|-------------|--------|--------------|
| BOQ / Monitoring | `/cost` | Built | Monitoring packages |
| MB sheets | `/cost?tab=mb` | Built | SPDC Budget · MB |
| BBS | `/cost?tab=bbs` | Built | SPDC Budget · BBS |
| Budget WBS | `/cost?tab=budget` | Built | SPDC_Budget · Budget |
| **Cash Flow Chart** | `/cost?tab=cashflow&cf=chart` | Built | Cashflow Dashboard · Chart |
| **Cash Flow Forecast** | `/cost?tab=cashflow&cf=forecast` | Built | Cashflow Dashboard · Forecast |
| **Cashflow Tracking** | `/cost?tab=cashflow&cf=tracking` | Built | Cashflow Dashboard · Tracking |
| Rate difference | `/cost?tab=rates` | Built | Steel / Cement / Tiles |
| COP / Bills | `/cost?tab=bills` | Built | Payment Summary (engineering) |
| Structure upload | `/cost?tab=boq` | Built | Multi-BOQ import |

### Awaiting next sheets

| Tool | Status | Notes |
|------|--------|-------|
| New structure / package MB·BBS | Ready | Seed package → chip inside MB/BBS/Monitoring |
| Extra rate materials | Ready | Extend rate difference register |

---

## 3. Package filter

Multiple BOQs/structures per project → each **package** is a chip / filter on registers.

---

## 4–11. Field tables

(Unchanged — monitoring, MB, BBS, budget, cashflow period, rate difference, CSV downloads.)

See prior sections in git history or expand when the next sheet arrives.

### Monitoring / BOQ line (baseline)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| package | text | Y | |
| srNo / itemCode | text | N | |
| description | text | Y | Readable wrap in UI |
| unit | text | Y | |
| boqQty / gfcQty | number | N | Trim long decimals in UI |
| rate / amount | money | N | |
| excess / saving | number | N | Computed |

### Cashflow period

| Field | Notes |
|-------|-------|
| periodLabel | Month / RA |
| packageName | Chart / Forecast / Tracking sheet tag |
| plannedAmount / actualAmount | |
| progressPct | |

---

## 12. Rules

1. Cost ≠ Finance.  
2. Cashflow Chart / Forecast / Tracking are **three hub tools**.  
3. Fill GFC qty on monitoring; excess/saving computes.  
4. Seed loads sheet data on deploy for pilot.

---

## 13. Review checklist

- [ ] Confirm package list for pilot project  
- [ ] Confirm Payment Summary rows in Cost COP vs Finance  
- [ ] Confirm CSV column order for client Excel  
