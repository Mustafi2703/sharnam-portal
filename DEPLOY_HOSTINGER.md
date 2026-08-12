# Deploy on Hostinger VPS — client demo checklist

Deploy the Sharnam portal on a **Hostinger VPS** (KVM), not shared web hosting. The app is a **Node.js 22** service (Express + React + SQLite).

**Time needed:** ~45–60 minutes first time.

---

## What works live after deploy

| Module | Demo path | Notes |
|--------|-----------|--------|
| **Login hub** | `/login` | Office / Site / Vendor / Client portals |
| **Master + projects** | `/master` | Module toggles, demo project `SPDC-DEMO-01` |
| **Drawings (GFC)** | Project → Drawings | Upload → SharePoint when `MOCK_ONEDRIVE=false` |
| **RFIs** | Project → RFIs | Create RFI → **live email** when Graph mail configured |
| **Checklists / Quality** | Project → Quality | Submit → email notification |
| **SharePoint DMS** | Documents / Upload lab | Live tenant folder tree |
| **Site punch + photos** | `/login/site` → Attendance | Selfie → SharePoint + local proxy |
| **Reports (DPR/WPR)** | Project → Reports | HTML download |
| **CRM bid compare** | CRM → Comparative | R2 discipline BOQs |
| **Email outbox** | Project → Email settings | Manual send + history |

**Demo logins** (after seed): `office@sharnam.demo` / `site@sharnam.demo` / `Demo@1234`

---

## Requirements

| Item | Minimum |
|------|---------|
| Hostinger plan | **VPS** (2 GB RAM+, Ubuntu 22/24) |
| Domain | e.g. `portal.spdc.in` → VPS IP (A record) |
| Microsoft 365 | Already configured (SharePoint + `pmc-portal@spdc.in`) |
| SSH access | Root or sudo user |

> Shared Hostinger web hosting **cannot** run this app reliably. Use **VPS**.

---

## Step 1 — VPS bootstrap (once)

SSH into the VPS as root:

```bash
curl -fsSL https://raw.githubusercontent.com/Mustafi2703/sharnam-portal/main/scripts/hostinger-vps-bootstrap.sh | bash
```

Or clone first and run `sudo bash scripts/hostinger-vps-bootstrap.sh`.

---

## Step 2 — Deploy app (as `sharnam` user)

```bash
sudo su - sharnam
cd /var/www
git clone https://github.com/Mustafi2703/sharnam-portal.git
cd sharnam-portal

cp .env.hostinger.example .env
nano .env   # fill JWT_SECRET + Azure creds (see below)
```

### Required `.env` values

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=file:./data/prod.db
UPLOAD_DIR=./data/uploads
JWT_SECRET=<long-random-string>
WEB_ORIGIN=https://portal.yourdomain.com
SKIP_SEED=0

MOCK_ONEDRIVE=false
AZURE_TENANT_ID=<tenant>
AZURE_CLIENT_ID=2fd78789-594e-4af6-b43d-cb82f59df39c
AZURE_CLIENT_SECRET=<secret>
SHAREPOINT_SITE_URL=https://spdcsmb.sharepoint.com/sites/SharnamProjects
GRAPH_MAIL_FROM=pmc-portal@spdc.in
GRAPH_MAIL_ENABLED=true
SEED_PASSWORD=Demo@1234
```

```bash
mkdir -p data uploads
npm install
npm run build

# First deploy — load demo data
RUN_SEED=1 bash scripts/start-production.sh
# Ctrl+C after "Listening on…" confirms OK, then:
```

---

## Step 3 — Run with PM2 (keeps app alive)

```bash
# In .env set SKIP_SEED=1 for all future restarts
echo "SKIP_SEED=1" >> .env

pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # follow printed command (sudo)
```

---

## Step 4 — Nginx + SSL

```bash
sudo cp deploy/nginx-sharnam.conf /etc/nginx/sites-available/sharnam-portal
sudo nano /etc/nginx/sites-available/sharnam-portal   # set server_name
sudo ln -sf /etc/nginx/sites-available/sharnam-portal /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d portal.yourdomain.com
```

Update `.env` → `WEB_ORIGIN=https://portal.yourdomain.com` and restart:

```bash
pm2 restart sharnam-portal
```

---

## Step 5 — Smoke test (before client demo)

| # | Test | Expect |
|---|------|--------|
| 1 | `curl https://portal.yourdomain.com/api/health` | `"ok": true`, `"mockOneDrive": false` |
| 2 | `curl https://portal.yourdomain.com/api/health/sharepoint` | `"tokenOk": true`, `"siteOk": true` |
| 3 | Open `/login` | Portal picker, no errors |
| 4 | Login `office@sharnam.demo` | Dashboard + project tools |
| 5 | Project → Drawings → upload | File appears in SharePoint |
| 6 | Project → RFIs → create | Email to notification list from `pmc-portal@spdc.in` |
| 7 | `/login/site` → punch in | Selfie saves (SharePoint + display) |

---

## Tomorrow’s demo script (30 min)

1. **Login hub** — show Office / Site / Client portals (text + block layout)
2. **Office** — open `SPDC-DEMO-01`, show module bar (Drawings, RFIs, Quality, Cost, Reports)
3. **Drawings** — publish a sheet → SharePoint path + optional email
4. **RFI** — raise design coordination RFI → live email to stakeholder list
5. **Site portal** — punch in with photo on phone
6. **Reports** — download DPR / WPR
7. **CRM** — bid compare (R2 template) if time

---

## Updates after first deploy

```bash
cd /var/www/sharnam-portal
git pull
npm install
npm run build
pm2 restart sharnam-portal
```

To re-seed demo data (wipes custom rows): `RUN_SEED=1 pm2 restart sharnam-portal` (temporarily set in ecosystem env).

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| 502 Bad Gateway | `pm2 logs sharnam-portal` — check Node running on 4000 |
| SharePoint fails | Verify Azure creds; `npx tsx apps/api/scripts/test-sharepoint.ts` |
| Mail not sending | `GRAPH_MAIL_ENABLED=true`; test with admin `POST /api/graph/test-mail` |
| DB empty after reboot | Use `file:./data/prod.db` (persistent path), not `/tmp` |
| CORS errors | `WEB_ORIGIN` must match public URL exactly |

---

## Related docs

- [M365_GRAPH_STATUS_AND_PERMISSIONS.md](docs/M365_GRAPH_STATUS_AND_PERMISSIONS.md) — Graph permission status
- [M365_SETUP.md](docs/M365_SETUP.md) — Entra app setup
- [DEPLOY_RENDER.md](DEPLOY_RENDER.md) — alternative Render deploy
