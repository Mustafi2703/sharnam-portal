# शरणम् Construction Portal

Procore-inspired PMC portal for **Sharnam Project Development Consultants & Co.**

New React + Node stack (not PHP). Mock OneDrive DMS until Azure credentials exist. BOQ import patterns adapted from [parikh-procurement](https://github.com/Mustafi2703/parikh-procurement).

## Demo credentials

| Portal | Email | Password |
|--------|-------|----------|
| Admin | `admin@sharnam.demo` | `Demo@1234` |
| Office | `office@sharnam.demo` | `Demo@1234` |
| Site employee | `site@sharnam.demo` | `Demo@1234` |
| Client | `client@sharnam.demo` | `Demo@1234` |
| Employee | `employee@sharnam.demo` | `Demo@1234` |

## Local setup

```bash
cd sharnam-portal
npm install
npm run db:setup
npm run dev
```

- Web: http://localhost:5173  
- API: http://localhost:4000/api/health  

Optional: set `SHARNAM_EXCEL_ROOT` to the folder containing `Final Index.xlsx` and `Drwing check master checklist.xlt.xls` before seeding.

## Modules (demo-ready)

- Auth + editable roles / portals
- Projects, Drawings (publish gate for checklists)
- Mock OneDrive DMS (sync / browse / upload)
- Checklist forms from Excel masters
- Daily diary (manpower, equipment, notes)
- Communications matrix, log, meetings + carry-over
- Cost tracking (budget / monitoring / cashflow / BOQ import)
- Daily & weekly reports + audit trail
- CRM & HRM shells

## Render deploy

See `render.yaml`. Create a PostgreSQL database, set `DATABASE_URL`, `JWT_SECRET`, `WEB_ORIGIN`, then:

```bash
# on API service build
npm install
npx prisma db push
npm run db:seed
npm run build -w @sharnam/api
npm run start -w @sharnam/api
```

For SQLite demo on a single dyno, keep `DATABASE_URL=file:./dev.db` (ephemeral on free tier — prefer Postgres on Render).

## Client walkthrough

1. Login as **office** → open Demo project → confirm published drawing A-101  
2. Login as **site** → Daily Diary + submit a checklist  
3. Login as **office** → approve checklist → Cost → BOQ import  
4. Login as **client** → view reports / approved work  
5. Login as **admin** → Roles matrix + Audit  

## Out of scope (later)

- Real Microsoft Graph / Azure AD  
- Full RFI / drawing OCR compare  
- Live PHP data migration  
