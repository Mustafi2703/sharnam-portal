# Cost module

## Tools

| Tool | Behaviour |
|------|-----------|
| Budget WBS | Stakeholder budgeted / WO / certified / forecast / non-tendered |
| Monitoring | BOQ qty, Extra, **GFC qty** (user fills), Achieved, Excess/Saving vs BOQ |
| Measurement books (MB) | Per package (Civil dormitory, Electric, Plumbing, UGWT…). Dimensions → qty; feeds GFC/achieved |
| BBS | Bar bending schedules per package (Dormitory BBS, Compound Wall BBS…) |
| Cashflow | Monthly planned vs actual + dashboard |
| Rate difference | Steel / Cement / Tiles purchase vs basic |
| COP / Bills | Vendor bill certify flow |
| BOQ import | Upload BOQ → monitoring lines |

## Sheet sources

- `Cashflow - Dashboard.xlsx` — Dashboard, Tracking, Cash Flow, Budget, Monitoring, rate diffs  
- `SPDC_Budget_Arvind 49.xls` — Budget + Monitoring* + `* MB` + `* BBS` sheets  
- `Payment Summary - VIATRIX - Copy.xlsx` — RA / PEB / Civil bills  

**Rule:** Multiple BOQs per project; each BOQ can have an MB. Fill GFC quantity; rest computes.
