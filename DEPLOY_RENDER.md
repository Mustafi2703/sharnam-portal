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
| 1 | Open `/login` | Portal logins (Graphite Procore chrome) |
| 2 | Login `office@sharnam.demo` / `Demo@1234` | Master, CRM, HRM, project tools |
| 3 | Master → module toggles | Modules show/hide on project top bar |
| 4 | Project → Drawings | GFC table + revision panel |
| 5 | Project → Progress | Milestones / hindrance / risk seeded |
| 6 | Project → Cost | Measurement + MB + BBS + cashflow |
| 7 | Project → Reports | Download DPR / WPR HTML |
| 8 | Login `site@sharnam.demo` | Day log / checklists |
| 9 | `/api/health` | `ok: true`, `ui: "ui-2 Graphite Procore"` |

## After smoke

Share the Render URL with the client and send [docs/M365_SETUP.md](docs/M365_SETUP.md) when ready for Graph.
