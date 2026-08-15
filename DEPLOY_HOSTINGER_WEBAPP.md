# Deploy on Hostinger Web App (Cloud plan — no VPS)

Use your **existing Cloud Startup** plan for `spdc.in`.  
Deploy Sharnam on **`portal.spdc.in`** — completely **independent** of **`app.spdc.in`**.

> **DNS:** Use the IP/CNAME shown in **hPanel** for the portal web app — Hostinger CDN (hCDN) uses **anycast IPs** (e.g. `147.79.69.x`, `93.127.173.x`), not a single fixed address.  
> If WiFi fails but mobile data works, see [docs/WIFI_HOSTINGER_TROUBLESHOOTING.md](docs/WIFI_HOSTINGER_TROUBLESHOOTING.md).

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
| **Database** | Its DB | **Hostinger MySQL** (connected in hPanel — Sharnam only) |
| **Uploads** | Its files | **`./data/uploads`** (Sharnam only) |
| **Process** | Its Node/PHP process | **`server.mjs`** → Sharnam only |
| **Env vars** | Its hPanel env | **New env block** for portal web app only |

### DO

- Add a **new** website for **`portal.spdc.in`**
- Connect GitHub repo **`sharnam-portal`** only to that new site
- Add DNS record **`portal`** → value from hPanel (new A or CNAME)
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
| **A** or **CNAME** | **portal** | **hPanel value** for this web app (do not guess an old IP) |

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
| **Build command** | `npm run hostinger:build` |
| **Entry file** | **`server.mjs`** |
| **Start command** | `npm start` (runs `node server.mjs`) |
| **Output directory** | leave empty (Express serves `apps/web/dist`) |

---

## Step 4 — MySQL database (required for production)

SQLite is **not** used in production — many users need a real database.

1. hPanel → **Databases** → **MySQL Databases** → **Create**
   - Database name e.g. `u252873650_sharnam` (Hostinger prefixes your user id)
   - Create a DB user + strong password
2. Open **portal.spdc.in** web app dashboard → **Connect a database** → select the MySQL DB you created  
   Hostinger injects **`DATABASE_URL`** automatically (starts with `mysql://`).
3. If you add env vars manually instead, use the exact string from hPanel:

```env
DATABASE_URL=mysql://USER:PASSWORD@localhost:3306/DATABASE_NAME
```

> Do **not** connect this DB to **app.spdc.in** — keep databases separate.

---

## Step 5 — Environment variables

Add in hPanel → Web App → **Environment variables** (skip `DATABASE_URL` if you used **Connect a database**):

```env
NODE_ENV=production
UPLOAD_DIR=./data/uploads
JWT_SECRET=<generate-a-long-random-string>
WEB_ORIGIN=https://portal.spdc.in
SEED_PASSWORD=Demo@1234

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
> **Seed** runs during **build** when `RUN_SEED=1` (`hostinger:build` → `prisma db push` + full `seed/seed.ts`).  
> One run loads: users, sheets, **SPDC-DEMO-01**, DPR day, quality/safety, finance RA/COP, quotation, bid compare, **SPDC-PILOT-02** week.  
> Remove `RUN_SEED=1` after first deploy — redeploys would reset demo data.

---

## Step 6 — Deploy

Click **Deploy**. Wait for build (~3–5 min).

Then verify:

- https://portal.spdc.in/login — portal picker
- https://portal.spdc.in/api/health — `"ok": true`
- https://app.spdc.in — **must still work**

**Demo logins:** `office@sharnam.demo` / `site@sharnam.demo` / `Demo@1234`

---

## Step 7 — After first successful deploy

1. Remove **`DATABASE_URL=file:./data/prod.db`** if still set — must be `mysql://...` only
2. Remove **`RUN_SEED=1`** — seed already ran at build time; redeploys would reset demo data otherwise
3. Check **Runtime logs** — you should see `शरणम् API listening on http://0.0.0.0:...` and memory **> 50 MB**

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
| Build fails on Prisma | `DATABASE_URL` must start with `mysql://`; connect MySQL in hPanel first |
| 503 / memory ~7 MB | App crashed at startup — **Runtime logs**; ensure latest deploy (compiled API via `server.mjs`) |
| 503 / JWT or Azure | Set `JWT_SECRET` and Azure vars in env |
| Blank page | Build must run `npm run hostinger:build` so `apps/web/dist` + `apps/api/dist` exist |
| CORS errors | `WEB_ORIGIN` must be exactly `https://portal.spdc.in` |
| DB reset on redeploy | Remove `RUN_SEED=1`; MySQL data persists in Hostinger MySQL (not SQLite file) |
| Broke app.spdc.in | You edited wrong site — restore from Hostinger backup |

---

## Alternative (no Hostinger Node setup)

Point **`portal.spdc.in`** CNAME → **`sharnam-portal.onrender.com`** (already live on Render). Zero server work; SSL via Hostinger or Render.

---

## Related

- [DEPLOY_HOSTINGER.md](./DEPLOY_HOSTINGER.md) — VPS path (if you upgrade later)
- [M365_GRAPH_STATUS_AND_PERMISSIONS.md](./docs/M365_GRAPH_STATUS_AND_PERMISSIONS.md) — mail permissions
