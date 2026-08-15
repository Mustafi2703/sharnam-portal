# Fix app.spdc.in — 503 Service Unavailable (old PHP site)

**Checked:** 2026-08-15  
**Status:** `https://app.spdc.in` → **503** (all pages, including `software_login.php`)  
**New portal:** `https://portal.spdc.in` → **OK** (`/api/health` → `"dbOk": true`)

---

## Root cause (confirmed from portal runtime logs)

At **17:37 IST** the **shared Hostinger MySQL** on `127.0.0.1:3306` went unreachable:

```
Can't reach database server at `127.0.0.1:3306`
```

That error was logged on **portal.spdc.in** during analytics export. The **same MySQL outage** typically kills the **old PHP app** (503) because it also uses `localhost` / `127.0.0.1` for its database.

| App | When MySQL drops | After MySQL returns |
|-----|------------------|---------------------|
| **portal.spdc.in** (Node) | Some API calls fail; process stays up | Recovers (`dbOk: true`) |
| **app.spdc.in** (PHP) | **503** immediately | Often **stays 503** until PHP workers are restarted |

So: fix **MySQL first**, then **restart the old PHP site**.

---

## Step 0 — Restart MySQL (shared server)

**Databases → MySQL Databases**

1. Confirm **both** databases exist:
   - **Portal (Node):** `u252873650_sharnam_portal` — connected on **portal.spdc.in** web app (may not appear under spdc.in → Databases)
   - **Old PHP app:** `u252873650_sharnam_new` (66 MB — live data) — listed under **spdc.in → Databases**
   - Do **not** use `u252873650_demo`, `u252873650_test`, or `u252873650_sharnam` for production unless `db_connect.php` explicitly says so
2. Open **phpMyAdmin** for each — if login fails, MySQL service is down → **Hostinger support** or hPanel **Restart** if shown.
3. If you recently hit **100% resource** warnings, use **Boost resources** or upgrade — MySQL can stop under load on Cloud Startup.

Then continue with Step 1 on the **old app site** (`plum-ostrich-597867.hostingersite.com` / `app.spdc.in`).

---

## Step 1 — Stop stuck PHP processes (old app site)

**Websites → app.spdc.in** (or `plum-ostrich-597867.hostingersite.com`) → **Hosting → Resources Usage**

Scroll to **Stop running processes** → click it → confirm.

Wait 1–2 minutes, then open:

```
https://app.spdc.in/software_login.php
```

If still 503 → Step 2.

---

## Step 2 — Read error logs

**Websites → app.spdc.in → Advanced → Error Logs** (or **Logs**)

Look for the last 20 lines. Common messages:

| Log message | Fix |
|-------------|-----|
| `Too many connections` / MySQL gone away | Step 3 — restart MySQL / fix DB |
| `Access denied for user` | Step 3 — fix `db_connect.php` password in hPanel File Manager |
| `Allowed memory size exhausted` | Step 4 — raise PHP memory limit |
| `Primary script unknown` | Step 5 — wrong document root |
| `.htaccess` / rewrite loop | Step 5 — rename `.htaccess` temporarily |

Copy the latest error line if you need dev help.

---

## Step 3 — MySQL database (old app DB)

**Databases → MySQL Databases**

1. Confirm the old app database still exists (often `u252873650_*` — **not** the Sharnam portal DB).
2. Open **phpMyAdmin** → try to connect to that database.
3. In **File Manager** for the old app (`app.spdc.in` / `plum-ostrich-597867.hostingersite.com` → `public_html/db_connect.php`), credentials must match hPanel:

| Setting | Expected value |
|---------|----------------|
| Host | `127.0.0.1` or `localhost` |
| Database | **`u252873650_sharnam_new`** |
| User | **`u252873650_sharnam_new`** (same as DB name on Hostinger) |
| Password | Reset in hPanel → Databases if unknown, then update `db_connect.php` |

Also check copies: `finance/db_connect.php`, `geofence/db_connect.php` — all must match.

**Do not** point the old app at the Sharnam portal MySQL database.

---

## Step 4 — PHP settings

**Websites → app.spdc.in → Advanced → PHP Configuration**

| Setting | Suggested |
|---------|-----------|
| PHP version | **8.2** (was working — headers showed `PHP/8.2.30`) |
| Memory limit | **512M** or **1024M** |
| Max execution time | **120** |
| `display_errors` | Off in production |

Save → test `https://app.spdc.in/` again.

Toggle PHP **8.1 → 8.2** (or 8.2 → 8.1 and back) to force a PHP restart if Hostinger offers no explicit restart.

---

## Step 5 — Document root & files

**Websites → app.spdc.in → Domains** — domain should point to **`public_html`** (or the folder that contains `index.php` and `software_login.php`).

**File Manager → public_html:**

- `index.php` exists
- `software_login.php` exists
- `.htaccess` — if broken, rename to `.htaccess.bak` and retest

---

## Step 6 — Restore from backup (if nothing else works)

**Websites → app.spdc.in → Backups**

Restore **yesterday’s** backup (files + database) for **app.spdc.in only**.

**Do not** restore portal.spdc.in or merge sites.

---

## Step 7 — Hostinger support

If 503 persists after Steps 1–4, open a ticket:

> Site **app.spdc.in** (plum-ostrich-597867.hostingersite.com) returns **503** from hCDN. Origin PHP not responding. Portal **portal.spdc.in** on same account works. Please check LiteSpeed/PHP-FPM for this website only.

---

## Keep the two sites separate

| Site | URL | Stack | hPanel site |
|------|-----|-------|-------------|
| **Old app** | app.spdc.in | PHP + MySQL | plum-ostrich… / app site |
| **New portal** | portal.spdc.in | Node + MySQL | Separate web app |

Never upload Sharnam Node files into **app.spdc.in public_html**.

---

## Quick health check (from any network)

```bash
curl -I https://app.spdc.in/
# Bad: HTTP/2 503
# Good: HTTP/2 302 → software_login.php  OR  HTTP/2 200

curl https://portal.spdc.in/api/health
# Should stay: "ok":true,"dbOk":true
```
