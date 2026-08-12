# Deploy on Hostinger Web App (Cloud plan — no VPS)

Use your **existing Cloud Startup** plan for `spdc.in` (IP **62.72.15.47**).  
Deploy Sharnam on **`portal.spdc.in`** — completely **independent** of **`app.spdc.in`**.

Hostinger supports **Express + Vite** Node.js web apps on Business/Cloud plans.

---

## Independence guarantee (read first)

Sharnam and `app.spdc.in` are **two separate websites** on the same Hostinger account. They do not share code, database, or config.

| | **app.spdc.in** (existing — do not touch) | **portal.spdc.in** (Sharnam — new) |
|--|-------------------------------------------|-------------------------------------|
| **hPanel entry** | Its own website row | **Add website** → new Node.js web app |
| **Domain** | `app.spdc.in` | **`portal.spdc.in` only** |
| **Git repo** | Its repo (schedule app) | **`Mustafi2703/sharnam-portal`** |
| **Server folder** | Its `public_html` / app path | Hostinger-managed **separate** app folder |
| **Database** | Its DB | **`./data/prod.db`** (SQLite, Sharnam only) |
| **Uploads** | Its files | **`./data/uploads`** (Sharnam only) |
| **Process** | Its Node/PHP process | **`server.mjs`** → Sharnam only |
| **Env vars** | Its hPanel env | **New env block** for portal web app only |

### DO

- Add a **new** website for **`portal.spdc.in`**
- Connect GitHub repo **`sharnam-portal`** only to that new site
- Add DNS record **`portal`** → `62.72.15.47` (new A record)
- Set `WEB_ORIGIN=https://portal.spdc.in` (not app.spdc.in)
- After deploy: test **`app.spdc.in` first** — it must behave exactly as before

### DO NOT

- Open or edit the **app.spdc.in** website in hPanel
- Upload Sharnam files into **`app.spdc.in` public_html**
- Change DNS for **`app`** subdomain
- Redeploy / rebuild the **app.spdc.in** web app
- Reuse `app.spdc.in` env vars or point Sharnam at app’s database
- Set Sharnam domain to `app.spdc.in` or root `spdc.in`

> Same server IP is fine — Hostinger routes by **domain name** to the correct app.  
> `app.spdc.in` and `portal.spdc.in` are isolated like two tenants on one machine.

---

## Step 1 — DNS subdomain

**Websites → spdc.in → Domains** (or DNS zone):

| Type | Name | Points to |
|------|------|-----------|
| **A** or **CNAME** | **portal** | `62.72.15.47` (same server) |

Leave `app` / `app.spdc.in` records unchanged.

---

## Step 2 — Add Node.js web app

1. **Websites** → **Add website**
2. Choose **Deploy Web App** / **Node.js web app**
3. Domain: **`portal.spdc.in`**
4. **Import Git repository** → connect GitHub → select **`Mustafi2703/sharnam-portal`**
5. Branch: **`main`**

---

## Step 3 — Build settings (copy exactly)

| Setting | Value |
|---------|--------|
| **Framework preset** | Express.js |
| **Node.js version** | **22.x** |
| **Root directory** | `/` (repo root) |
| **Build command** | `npm install && npm run build` |
| **Entry file** | **`server.mjs`** |
| **Start command** | `npm start` (runs `node server.mjs`) |
| **Output directory** | leave empty (Express serves `apps/web/dist`) |

---

## Step 4 — Environment variables

Add in hPanel → Web App → **Environment variables**:

```env
NODE_ENV=production
DATABASE_URL=file:./data/prod.db
UPLOAD_DIR=./data/uploads
JWT_SECRET=<generate-a-long-random-string>
WEB_ORIGIN=https://portal.spdc.in
SEED_PASSWORD=Demo@1234

# First deploy only — remove or set to 0 after success:
RUN_SEED=1

# After first successful deploy, set instead:
# SKIP_SEED=1

MOCK_ONEDRIVE=false
AZURE_TENANT_ID=<your-tenant-id>
AZURE_CLIENT_ID=2fd78789-594e-4af6-b43d-cb82f59df39c
AZURE_CLIENT_SECRET=<your-secret>
SHAREPOINT_SITE_URL=https://spdcsmb.sharepoint.com/sites/SharnamProjects
GRAPH_MAIL_FROM=pmc-portal@spdc.in
GRAPH_MAIL_ENABLED=true
SHARNAM_EXCEL_ROOT=./seed/data
```

> **PORT** — do **not** set manually; Hostinger injects it automatically.

---

## Step 5 — Deploy

Click **Deploy**. Wait for build (~3–5 min).

Then verify:

- https://portal.spdc.in/login — portal picker
- https://portal.spdc.in/api/health — `"ok": true`
- https://app.spdc.in — **must still work**

**Demo logins:** `office@sharnam.demo` / `site@sharnam.demo` / `Demo@1234`

---

## Step 6 — After first successful deploy

1. Change env: remove `RUN_SEED=1`, add **`SKIP_SEED=1`** (so redeploys don’t reset data)
2. Redeploy once

---

## Modules to demo tomorrow

| Module | URL |
|--------|-----|
| Login hub | `/login` |
| Office dashboard | login → Office |
| Drawings + SharePoint | Project → Drawings |
| RFIs + live email | Project → RFIs |
| Site punch | `/login/site` → Attendance |
| Reports | Project → Reports |
| CRM compare | `/crm` → Bid compare |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails on Prisma | Ensure build command includes `npm install` (runs `postinstall` → `prisma generate`) |
| 503 / app crash | hPanel → Logs; check `JWT_SECRET` and Azure vars are set |
| Blank page | Build must run `npm run build` so `apps/web/dist` exists |
| CORS errors | `WEB_ORIGIN` must be exactly `https://portal.spdc.in` |
| DB empty after redeploy | Set `SKIP_SEED=1`; data lives in `./data/prod.db` on server |
| Broke app.spdc.in | You edited wrong site — restore from Hostinger backup |

---

## Alternative (no Hostinger Node setup)

Point **`portal.spdc.in`** CNAME → **`sharnam-portal.onrender.com`** (already live on Render). Zero server work; SSL via Hostinger or Render.

---

## Related

- [DEPLOY_HOSTINGER.md](./DEPLOY_HOSTINGER.md) — VPS path (if you upgrade later)
- [M365_GRAPH_STATUS_AND_PERMISSIONS.md](./docs/M365_GRAPH_STATUS_AND_PERMISSIONS.md) — mail permissions
