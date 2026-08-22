# MODULE — Finance (commercial tracking)

**Prompt:** `module_prompts/fiannce.md` (points at Cost historically; Finance is separate)  
**SRS:** [CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md) §4.10  
**Also:** [../MODULE_FINANCE.md](../MODULE_FINANCE.md)  
**Separate from:** [MODULE_COST.md](./MODULE_COST.md)

---

## 1. Purpose

Track **commercial** documents: invoices, POs, RA bills, COP/payment certificates.  
Shell UI exists; field-level depth is phased.

---

## 2. Tools

| Tool | Status | Tracks |
|------|--------|--------|
| Overview | Shell | Open invoices, POs, RAs, COPs |
| Invoice tracking | Design | Invoice lifecycle |
| PO tracking | Design | PO vs delivery / billed |
| RA bill tracking | Design | Running account cycles |
| COP tracking | Design | Payment certificates |

---

## 3. Invoice fields (proposed)

| Field | Type | Required | Notes / review |
|-------|------|----------|----------------|
| invoiceNo | text | Y | |
| partyName / vendorId | text/link | Y | |
| invoiceDate | date | Y | |
| amount / gstAmount | money | Y | |
| status | enum | Y | Draft / Submitted / Under review / Certified / Paid / Rejected |
| linkedPoId / linkedRaId | link | N | |
| attachmentUrl | file | N | |
| projectId | link | Y | |

---

## 4. PO fields (proposed)

| Field | Type | Notes |
|-------|------|-------|
| poNo | text | |
| vendorId | link | |
| value | money | |
| deliveryStatus | enum | |
| billedAmount | money | |
| status | enum | |

---

## 5. RA bill fields (proposed)

| Field | Type | Notes |
|-------|------|-------|
| raNo / cycle | text | |
| periodFrom / periodTo | date | |
| amount claimed / certified | money | |
| status | enum | |
| linkedMbRefs | text | Link to Cost MB (discussion) |

---

## 6. COP fields (proposed)

| Field | Type | Notes |
|-------|------|-------|
| copNo | text | |
| certificateDate | date | |
| amount | money | |
| status | enum | |
| linkedRaId / invoiceId | link | |

---

## 7. Roles (baseline — confirm)

| Role | Access |
|------|--------|
| Office / Admin | Full |
| Site | View / attach evidence (TBD) |
| Client | Read-only summary (TBD) |
| Contractor | Submit / view own RA / invoice (TBD) |

---

## 8. Relation to Cost

- Cost = quantities, MB, BBS, budget, cashflow.  
- Finance = invoices, POs, RA, COP.  
- COP tracking moves **out of Cost** into Finance.

---

## 9. Review checklist

- [ ] Exact columns vs Payment Summary sheet  
- [ ] Who certifies RA / COP  
- [ ] Excel import mapping  
- [ ] Link to Cost MB / BOQ lines  
