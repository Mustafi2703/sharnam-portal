# WiFi works on mobile data but not on office/home WiFi (Hostinger)

**Applies to:** `https://portal.spdc.in` (Sharnam portal) and `https://app.spdc.in` (existing PHP app)  
**Not Render** — both live sites are on Hostinger Cloud + **hCDN** (Hostinger CDN).

> **503 on app.spdc.in?** That is a **server/PHP/MySQL** issue on the old site — follow [OLD_APP_503_FIX.md](./OLD_APP_503_FIX.md), not this WiFi doc.

---

## What we verified

When WiFi fails, the browser/curl **cannot open a TCP connection** to Hostinger CDN edge IPs such as:

- `93.127.173.x`
- `147.79.69.x`

General sites (Google, hostinger.com) still work. **Mobile data** often uses a different carrier route, so both apps load fine there.

This is a **network path / ISP / router** issue — the Hostinger deployment and API health are OK when the CDN is reachable.

Quick check from any machine on the broken WiFi:

```bash
curl -4 -v --connect-timeout 8 https://portal.spdc.in/api/health
curl -4 -v --connect-timeout 8 https://app.spdc.in/
```

If you see `Failed to connect … Timeout` to `93.127.*` or `147.79.*`, use the fixes below.

---

## Fix 1 — Change WiFi DNS (try first, 2 minutes)

On the **router** or each device:

| Setting | Value |
|---------|--------|
| DNS 1 | `1.1.1.1` |
| DNS 2 | `8.8.8.8` |

Then:

- Reconnect WiFi (or reboot router)
- On Mac: `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`
- On phone: toggle airplane mode off/on

Retry `https://portal.spdc.in/login` and `https://app.spdc.in`.

---

## Fix 2 — Disable Hostinger CDN for both sites (best long-term on SPDC WiFi)

In **hPanel → Websites**:

1. Open **portal.spdc.in** web app → **Performance** / **CDN** → **disable CDN** (hCDN)
2. Open **app.spdc.in** site → same → **disable CDN**
3. Wait 5–15 minutes, flush DNS, test again

Disabling CDN serves from Hostinger origin instead of blocked edge IPs. Slightly slower globally, but reliable on networks that block CDN ranges.

---

## Fix 3 — Router / office firewall

If SPDC office WiFi uses a firewall or “safe browsing”:

- Allow outbound **HTTPS (443)** to Hostinger CDN ranges (ask Hostinger support for current list), **or**
- Allow domains: `portal.spdc.in`, `app.spdc.in`, `*.spdc.in`

Do **not** block datacenter ASNs used by Hostinger (common false positive on corporate filters).

---

## Fix 4 — DNS A record (do not use stale IP)

Hostinger Cloud uses **CDN anycast** — the server IP changes. Do **not** hard-code old IPs (e.g. `62.72.15.47`) in router DNS or hosts files.

In **hPanel → Domains → DNS** for `spdc.in`:

| Subdomain | Type | Points to |
|-----------|------|-----------|
| `portal` | A or CNAME | **Current value shown in hPanel** for the portal web app |
| `app` | *(leave unchanged)* | Existing app record only |

After any DNS edit, wait for TTL (up to 24h) or flush local cache.

---

## Fix 5 — Temporary workaround

- Use **mobile hotspot** for demos until Fix 1 or 2 is applied
- Or use a VPN on WiFi (routes around blocked CDN path)

---

## Production URLs (use these, not Render)

| App | URL |
|-----|-----|
| **Sharnam portal (new)** | https://portal.spdc.in/login |
| **Existing schedule app** | https://app.spdc.in |
| Health check | https://portal.spdc.in/api/health → `"ok": true`, `"dbOk": true` |

Demo logins (after seed): `office@sharnam.demo` / `Demo@1234`

---

## Who to contact

| Issue | Contact |
|-------|---------|
| CDN / DNS in hPanel | Hostinger support (portal + app site names) |
| Office WiFi blocks CDN IPs | SPDC IT / router admin |
| Portal app bug after site loads | Sharnam dev team |
