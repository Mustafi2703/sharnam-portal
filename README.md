# शरणम् Construction Portal

Procore-inspired PMC portal for **Sharnam Project Development Consultants & Co.**

React (Vite) + Express + Prisma. Mock OneDrive DMS until Azure Graph credentials arrive (see [CLIENT_MICROSOFT_REQUEST.md](CLIENT_MICROSOFT_REQUEST.md)).

## Demo credentials

| Portal | Email | Password |
|--------|-------|----------|
| Admin | `admin@sharnam.demo` | `Demo@1234` |
| Office | `office@sharnam.demo` | `Demo@1234` |
| Site | `site@sharnam.demo` | `Demo@1234` |
| Vendor | `vendor@sharnam.demo` | `Demo@1234` |
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

Optional: `SHARNAM_EXCEL_ROOT` pointing at the folder with `Final Index.xlsx` (defaults to repo root).

## Live UI options (Render)

Public hub (no login): **`/`** or **`/options`** — five construction UI systems.

| Option | Route | Look |
|--------|-------|------|
| 1 Site Amber | `/ui/1` | Warm soft PMC |
| 2 Graphite Procore | `/ui/2` | Dense sharp steel |
| 3 Forest Field | `/ui/3` | Green roomy |
| 4 Blueprint Desk | `/ui/4` | Technical cyan |
| 5 Night Shift | `/ui/5` | Dark ops orange |

Same portals (Office / Site / Vendor / Client) under every option. Demo password: `Demo@1234`.

## Modules ready for client demo

- Four portals: **office / site / vendor / client** (+ employee login)
- CRM: leads board → convert to project → assign staff & vendors
- HRM: add employees, assign to projects, attendance / leave
- Drawings: GFC log register, revision audit, CSV export, publish gate
- Checklists: Final Index templates, dual-fill (office/site/vendor), gate on published drawings
- Inspections / QAP → auto RFI; client concerns as RFIs
- Daily log, meetings MoM open/close + carry-over
- Reports (printable), audit trail, cost shell (office)
- Mock OneDrive project folders for drawings/docs

## Render deploy

See [render.yaml](render.yaml). Prefer **Postgres** for production:

1. Create a Render Web Service from this repo (uses `render.yaml`)
2. Add a Render PostgreSQL database and set `DATABASE_URL` to the internal URL
3. Set `JWT_SECRET`, `WEB_ORIGIN` to the public service URL, `MOCK_ONEDRIVE=true`, `SEED_PASSWORD`
4. Deploy → open `/login` and walk the demo

```bash
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run build -w @sharnam/web
npm run start -w @sharnam/api
```

SQLite (`file:./prod.db`) works for a quick demo dyno but is ephemeral on free tier — use Postgres for anything shared with the client.

## Client walkthrough

1. **Office** → CRM leads → convert → open project → Drawings (publish)  
2. **Site** → Daily Log + Checklist fill  
3. **Vendor** → Checklist / respond to RFI  
4. **Client** → view drawings (no upload) → raise concern under RFIs  
5. **Admin** → Permissions + Audit  

## Ask the client (Microsoft Graph)

Use [CLIENT_MICROSOFT_REQUEST.md](CLIENT_MICROSOFT_REQUEST.md) when ready to connect SharePoint/OneDrive. Until then storage stays on Render (mock OneDrive).

Demo walkthrough also covers: Drawings (GFC register + revision upload), Safety log, dual checklists, vendor/client portals.
