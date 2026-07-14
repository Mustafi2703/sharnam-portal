# Deploy on Render — checklist

The app is a single Node service (Express serves `apps/web/dist`). Blueprint: [render.yaml](render.yaml).

## One-time setup

1. Push this repo to GitHub (`origin` already points at `Mustafi2703/sharnam-portal`).
2. In [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint** → select the repo.
3. Confirm the web service `sharnam-portal` (Node 22). Free plan uses SQLite `file:./prod.db` (ephemeral).
4. For a durable client demo: create Render **PostgreSQL**, set `provider = "postgresql"` in `prisma/schema.prisma`, set `DATABASE_URL` from Render, redeploy.
5. After deploy, set `WEB_ORIGIN` to the public URL (e.g. `https://sharnam-portal.onrender.com`).

## Smoke test (after live URL)

| # | Step | Expect |
|---|------|--------|
| 1 | Open `/login` | Four portals: Office, Site, Vendor, Client |
| 2 | Login `office@sharnam.demo` / `Demo@1234` | CRM, HRM, project tools |
| 3 | CRM → Leads → Convert | New project with members/vendors |
| 4 | Project → Drawings | GFC table + revision panel; publish works |
| 5 | Login `site@sharnam.demo` | Checklist / Daily Log editable |
| 6 | Login `vendor@sharnam.demo` | Assigned project; checklist + RFI respond |
| 7 | Login `client@sharnam.demo` | Drawings view-only; raise concern as RFI |
| 8 | `/api/health` | `ok: true`, `mockOneDrive: true` |

## After smoke

Share the Render URL with the client and send [CLIENT_MICROSOFT_REQUEST.md](CLIENT_MICROSOFT_REQUEST.md) when ready for Graph.
