# OneDrive setup — Microsoft 365 Business (no IT team)

Sharnam only needs a normal **Microsoft 365 Business** subscription (the one they already use for Outlook / OneDrive / Teams). No extra Azure “enterprise IT” product is required. The person who pays for M365 (or who can sign in as an **admin**) can do these steps in about 20–30 minutes.

Until this is done, the portal still works on Render with **mock folders** (`MOCK_ONEDRIVE=true`). Connect live OneDrive when ready.

---

## Who should do this?

Whoever can open:

- https://admin.microsoft.com  
  **or**
- https://portal.azure.com  

with an account that is a **Global admin** or **Application admin**.  
If nobody has admin: in Microsoft 365 admin center → **Users** → find who is marked Admin, or contact whoever bought the subscription (Microsoft partner / reseller).

---

## Part 1 — Create a folder home for projects (OneDrive or SharePoint)

**Easiest for a small firm: SharePoint site**

1. Go to https://www.office.com and sign in.
2. Open **SharePoint** (or create a team site from Microsoft 365 admin → **Show all** → **SharePoint** → **Active sites** → **Create**).
3. Create a site named e.g. **Sharnam Projects**.
4. Open **Documents** and create a folder per project code later (e.g. `SPDC-DEMO-01`). You can start with one folder `Portal`.
5. Copy the site URL from the browser, e.g.  
   `https://yourcompany.sharepoint.com/sites/SharnamProjects`  
   → send this URL to the portal developer.

**Alternative:** use one user’s **OneDrive for Business** and create a folder `SharnamPortal`. Then send that user’s work email (the OneDrive owner). Prefer SharePoint so it is not tied to one person leaving.

---

## Part 2 — Register the portal app (copy-paste clicks)

1. Open https://portal.azure.com → search **App registrations** → **New registration**.
2. **Name:** `Sharnam Portal`
3. **Supported account types:** *Accounts in this organizational directory only*
4. **Redirect URI:** leave blank for now → **Register**
5. On the app **Overview** page, copy and save:
   - **Application (client) ID**
   - **Directory (tenant) ID**
6. Left menu → **Certificates & secrets** → **New client secret**  
   - Description: `portal`  
   - Expiry: 12 or 24 months  
   - **Copy the Value immediately** (you only see it once). That is the **Client secret**.
7. Left menu → **API permissions** → **Add a permission** → **Microsoft Graph** → **Application permissions** → add:
   - `Files.ReadWrite.All`
   - `Sites.ReadWrite.All`
8. Click **Grant admin consent for \<your company\>** → confirm **Yes**.  
   Status column should show green checkmarks.

Send the developer this secure note (email / password manager — not a public chat forever):

| Item | Value |
|------|--------|
| Tenant ID | (from Overview) |
| Client ID | (from Overview) |
| Client secret | (the Value you copied) + expiry date |
| SharePoint site URL | (from Part 1) |

---

## Part 3 — Optional: mailbox for RFI / meeting emails later

If they want the portal to send mail (not required for OneDrive files):

1. Microsoft 365 admin → **Teams & groups** → **Shared mailboxes** → **Add**  
   e.g. `pmc-portal@yourcompany.com`
2. Send that address to the developer.

---

## Part 4 — What the developer does on Render (after you send the numbers)

In Render Dashboard → `sharnam-portal` → **Environment**:

```
AZURE_TENANT_ID=…
AZURE_CLIENT_ID=…
AZURE_CLIENT_SECRET=…
SHAREPOINT_SITE_URL=https://….sharepoint.com/sites/SharnamProjects
MOCK_ONEDRIVE=false
```

Redeploy → test: Office login → project → Documents → open a folder → upload a drawing.

---

## If Azure Portal says “you need a subscription”

App registrations for Graph usually work with **Microsoft Entra ID** that comes with M365 Business — you do **not** need to buy Azure Virtual Machines.  
If prompted for a paid Azure subscription:

1. Try https://entra.microsoft.com → **Applications** → **App registrations** (same steps).
2. Or start a free Azure trial linked to the same work account (credit card for verification only; app registration itself is free).

---

## Checklist to send the developer

- [ ] Tenant ID  
- [ ] Client ID  
- [ ] Client secret + expiry  
- [ ] SharePoint site URL (or OneDrive owner email)  
- [ ] Optional: shared mailbox `pmc-portal@…`  
- [ ] Confirmed **Grant admin consent** was clicked  

Demo portal works **without** this list: https://sharnam-portal.onrender.com — password `Demo@1234`.
