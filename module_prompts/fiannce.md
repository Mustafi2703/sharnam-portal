# Finance

## Tools (separate from Cost)

| Tool | Route | Notes |
|------|-------|-------|
| Overview | `/finance` | Open invoices, POs, RA bills, COPs |
| Invoice tracking | `/finance?tab=invoices` | From Payment Summary commercial side |
| PO tracking | `/finance?tab=po` | Purchase orders |
| RA bill tracking | `/finance?tab=ra` | Running account bills |
| COP tracking | `/finance?tab=cop` | Certificate of payment |

## Rules

- Engineering measurement (MB / BBS / BOQ / cashflow chart sheets) stays in **Cost**.
- Payment Summary seeds vendor bill examples into Cost COP / Bills **and** Finance commercial trackers.
- Field-level finance detail is later; shell registers are live now.
