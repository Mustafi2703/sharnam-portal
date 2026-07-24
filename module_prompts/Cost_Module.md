# Cost module

## Tools (each Excel sheet → portal tool)

| Tool | Source sheet |
|------|----------------|
| Budget WBS | `SPDC_Budget_Arvind 49.xls` → Budget (+ Cashflow Dashboard Budget) |
| BOQ / Monitoring | Each `Monitoring *` package + Cashflow Dashboard Monitoring |
| MB sheets | Each MB / structure sheet (Dormitory, Electric, Plumbing, UGWT, …) |
| BBS | Dormitory / Compound Wall / Septic / Road / UGWT BBS |
| Cashflow Chart | `Cashflow - Dashboard.xlsx` → Cash Flow Chart - INR |
| Cashflow Forecast | same → Cash Flow - Forecast |
| Tracking | same → Tracking |
| Rate difference | Steel / Cement / Tiles |
| COP / Bills | Payment Summary |
| Structure upload | Multi-BOQ import → monitoring package |

## Downloads

Each register has **Download CSV** (open in Excel) for the active package filter:
`/api/cost/:projectId/download/{boq|mb|bbs|budget|cashflow|rates}.csv?package=`

## Rules

- Multiple BOQs/structures per project; each package is its own tool chip.
- Fill **GFC qty** on monitoring; excess / saving computes.
- Comms / Drawings / Coordination / Submittals are separate modules (later).
- Deploy (`render.yaml`) runs `prisma db push` + `seed/seed.ts` on start so sheet data is always loaded.
