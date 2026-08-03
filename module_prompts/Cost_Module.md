# Cost module

## Tools (each Excel sheet → portal hub tool)

| Tool | Route | Source sheet |
|------|-------|----------------|
| BOQ / Monitoring | `/cost` | Monitoring packages + Cashflow Dashboard Monitoring |
| MB sheets | `/cost?tab=mb` | SPDC Budget · MB structures |
| BBS | `/cost?tab=bbs` | Dormitory / Compound Wall / Septic / Road / UGWT BBS |
| Budget WBS | `/cost?tab=budget` | `SPDC_Budget_Arvind 49.xls` → Budget |
| **Cash Flow Chart** | `/cost?tab=cashflow&cf=chart` | `Cashflow - Dashboard.xlsx` → Cash Flow Chart - INR |
| **Cash Flow Forecast** | `/cost?tab=cashflow&cf=forecast` | same → Cash Flow - Forecast |
| **Cashflow Tracking** | `/cost?tab=cashflow&cf=tracking` | same → Tracking |
| Rate difference | `/cost?tab=rates` | Steel / Cement / Tiles |
| COP / Bills | `/cost?tab=bills` | Payment Summary (engineering COP entry) |
| Structure upload | `/cost?tab=boq` | Multi-BOQ import → monitoring package |

## Downloads

Each register has **Download CSV** (open in Excel) for the active package filter:
`/api/cost/:projectId/download/{boq|mb|bbs|budget|cashflow|rates}.csv?package=`

## Rules

- Cashflow Chart / Forecast / Tracking are **three separate hub tools** (not one combined Cashflow card).
- Multiple BOQs/structures per project; each package is its own chip inside Monitoring / MB / BBS.
- Commercial Invoice / PO / RA tracking lives in **Finance** (separate module).
- Deploy (`render.yaml`) runs `prisma db push` + `seed/seed.ts` on start so sheet data is always loaded.
