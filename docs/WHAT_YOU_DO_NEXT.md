# What you need to do (Baibhab) — review + OneDrive

## 1. Review the product on Render (after this push)

1. Wait ~5–10 min for Render to build after GitHub `main` updates.
2. Open https://sharnam-portal.onrender.com/login  
3. Login: `office@sharnam.demo` / `Demo@1234`
4. Walkthrough:
   - **Master** → module toggles on the demo project  
   - Project → **Drawings** (GFC) · **Progress** · **Cost** (MB/BBS) · **Reports** (DPR/WPR download)  
5. Also try `site@sharnam.demo` for day log.

If the site is sleeping (free plan), first load can take ~1 minute.

Health check: https://sharnam-portal.onrender.com/api/health  
Expect `"ui": "ui-2 Graphite Procore"`.

---

## 2. OneDrive — what to ask Sharnam (they have Business M365 only)

They do **not** need an IT department. One **admin** user on their Microsoft 365 Business subscription is enough.

Send them: **[docs/M365_SETUP.md](docs/M365_SETUP.md)** and ask them to return:

1. Tenant ID  
2. Client ID  
3. Client secret (+ expiry)  
4. SharePoint site URL for project folders  

You then paste those into **Render → Environment** and set `MOCK_ONEDRIVE=false` (see that doc Part 4).

Until they send this, leave mock OneDrive on — portal is fully reviewable.

---

## 3. Optional next

- Upgrade Render to a paid plan or attach Postgres if the demo must keep data between free-tier sleeps/redeploys.  
- After Graph creds: wire live upload (code path already planned; env swap first).
