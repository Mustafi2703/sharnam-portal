# EMERGENCY — get app.spdc.in up (503 fix)

**Right now:** https://app.spdc.in → **503** (PHP origin down)  
**Portal is fine:** https://portal.spdc.in — do not touch that site while fixing the old app.

You must do these in **hPanel** — dev cannot SSH into Hostinger from here.

---

## ⚡ 5-minute fix (do all 4)

### A — Stop stuck PHP (old site only)

1. **Websites** → open **`plum-ostrich-597867.hostingersite.com`** (NOT portal.spdc.in)
2. **Hosting** → **Resources Usage**
3. Click **Stop running processes** → confirm
4. Wait **2 minutes**
5. Open https://app.spdc.in/software_login.php in incognito

Still 503? → **B**

---

### B — Reset PHP (forces restart)

1. Same site → **Advanced** → **PHP Configuration**
2. Note current version (use **8.2**)
3. Change to **8.1** → Save
4. Wait 30 seconds → change back to **8.2** → Save
5. Test https://app.spdc.in/ again

Still 503? → **C**

---

### C — Fix database password (most common after outage)

Old app uses database **`u252873650_sharnam_new`** (66 MB).

1. **Websites → spdc.in → Databases**
2. Find **`u252873650_sharnam_new`** → **Change password** → set a new strong password → copy it
3. **Websites → plum-ostrich… → Files → public_html**
4. Edit **`db_connect.php`** — set:
   - `$dbname` or database = `u252873650_sharnam_new`
   - `$username` or user = `u252873650_sharnam_new`
   - `$password` = **new password from step 2**
   - host = `127.0.0.1`
5. Save file
6. If these exist, update the **same password** in:
   - `finance/db_connect.php`
   - `geofence/db_connect.php`
7. **Stop running processes** again (step A)
8. Test https://app.spdc.in/

Still 503? → **D**

---

### D — Restore yesterday’s backup (old site only)

1. **Websites → plum-ostrich-597867.hostingersite.com → Backups**
2. Restore **latest backup before today** (files only first; add DB if offered separately for `sharnam_new`)
3. After restore, redo **step C** (password may have reverted)
4. Test again

---

## Hostinger live chat (if still 503)

Paste this:

> Website **app.spdc.in** (plum-ostrich-597867.hostingersite.com) returns **503 Service Unavailable** from hCDN. Origin PHP/LiteSpeed not responding. Node site **portal.spdc.in** on same account works. MySQL database **u252873650_sharnam_new** exists (66 MB). Please restart LiteSpeed/PHP-FPM for this website only. Do not modify portal.spdc.in.

---

## Do NOT

- Edit **portal.spdc.in** web app or its env vars
- Delete any MySQL database
- Upload Sharnam Node files into old app **public_html**
- Point app.spdc.in domain to the portal site

---

## Success check

```text
https://app.spdc.in/  → 302 to software_login.php  OR  login page loads
https://app.spdc.in/software_login.php  → 200 (login form)
```

Not success: still shows **503 Service Unavailable** page from Hostinger.
