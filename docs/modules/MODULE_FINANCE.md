# MODULE — Finance (commercial tracking)

**Prompt:** `module_prompts/fiannce.md`  
**SRS:** [CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md) §4.10  
**Hub:** `/projects/:id/hub/finance`  
**Separate from:** [MODULE_COST.md](./MODULE_COST.md)

---

## 1. Purpose

Track **commercial** documents: invoices, POs, RA bills, COP/payment certificates.  
Shell UI + hub cards exist; deepen when Payment Summary commercial columns / new sheets arrive.

---

## 2. Tools (sheet → hub card)

| Tool | Hub / route | Status | Tracks |
|------|-------------|--------|--------|
| Overview | `/finance` | Shell | Open invoices, POs, RAs, COPs |
| Invoice tracking | `/finance?tab=invoices` | Shell | Invoice lifecycle |
| PO tracking | `/finance?tab=po` | Shell | PO vs delivery / billed |
| RA bill tracking | `/finance?tab=ra` | Shell | Running account cycles |
| COP tracking | `/finance?tab=cop` | Shell | Payment certificates |

### Awaiting next sheets

| Tool | Status | Notes |
|------|--------|-------|
| Full Payment Summary commercial map | Ready | Expand field tables from next client export |
| Vendor self-serve invoice submit | Ready | Role matrix TBD |

---

## 3–6. Field tables (proposed)

Invoice / PO / RA / COP — keep baselines; mark Keep/Change/Drop when sheet lands.

---

## 7. Relation to Cost

- Cost = quantities, MB, BBS, budget, cashflow charts.  
- Finance = invoices, POs, RA, COP.  
- Cost retains engineering COP / Bills entry; commercial COP tracking is Finance.

---

## 8. Review checklist

- [ ] Exact columns vs Payment Summary sheet  
- [ ] Who certifies RA / COP  
- [ ] Excel import mapping  
- [ ] Link to Cost MB / BOQ lines  
