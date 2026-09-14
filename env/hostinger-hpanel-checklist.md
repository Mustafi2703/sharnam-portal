# Hostinger hPanel — env checklist for portal.spdc.in

Paste each **KEY** and **VALUE** in: **Websites → portal.spdc.in → Environment variables → Add**.

## Required (every deploy)

| KEY | VALUE |
|-----|--------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | *(openssl rand -base64 48)* |
| `WEB_ORIGIN` | `https://portal.spdc.in` |
| `UPLOAD_DIR` | `./data/uploads` |
| `MYSQL_USER` | from hPanel → Databases |
| `MYSQL_PASSWORD` | from hPanel → Databases |
| `MYSQL_DATABASE` | from hPanel → Databases |
| `MYSQL_HOST` | `127.0.0.1` |
| `SEED_PASSWORD` | `Demo@1234` |
| `SHARNAM_EXCEL_ROOT` | `./seed/data` |
| `MOCK_ONEDRIVE` | `false` |
| `AZURE_TENANT_ID` | Entra tenant ID |
| `AZURE_CLIENT_ID` | `2fd78789-594e-4af6-b43d-cb82f59df39c` |
| `AZURE_CLIENT_SECRET` | app secret (rotate if expired) |
| `SHAREPOINT_SITE_URL` | `https://spdcsmb.sharepoint.com/sites/SharnamProjects` |
| `GRAPH_MAIL_FROM` | `pmc-portal@spdc.in` |
| `GRAPH_MAIL_ENABLED` | `true` |
| `PORTAL_MAIL_LIVE` | `false` |

## Seed control

| When | Set | Do not set |
|------|-----|------------|
| **First deploy** (empty DB) | `RUN_SEED=1` | `SKIP_BUILD_SEED` |
| **Demo / all later deploys** | `SKIP_BUILD_SEED=1` | `RUN_SEED` *(delete the variable)* |

## Bulk import (recommended)

1. Edit `hostinger-env-import.env` locally (copy from `hostinger-env-import.example.env`)
2. hPanel → **portal.spdc.in** → **Settings & Redeploy** → **Environment variables**
3. Click **Import .env** → upload `hostinger-env-import.env` (or paste its contents)
4. Confirm → redeploy

Format must be `KEY=value` — **not** the `KEY:` / `VALUE:` blocks in `hostinger-env-paste.txt`.

Generate from local `.env`: `bash scripts/export-hostinger-env.sh`

## After deploy — smoke test

1. `https://portal.spdc.in/api/health` → `"ok": true`
2. `https://portal.spdc.in/api/health/sharepoint` → `"tokenOk": true`
3. Login `office@sharnam.demo` / `Demo@1234`
4. CRM: save proposal status, project card (should be fast)
5. CRM Launch step only: ISO folders (~1 minute)
6. HRMS: open recruitment desk, `riya.shah@sharnam.demo` profile

## Do not set

- `PORT` — Hostinger sets this
- `DATABASE_URL=file:...` — use MySQL only
