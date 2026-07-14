# Microsoft Graph credentials — ask the client

Share this list with **Sharnam Project Development Consultants & Co.** when they are ready to connect OneDrive / SharePoint for live drawing and document storage.

Until these arrive, the portal uses **server file storage (mock OneDrive)** on Render. UI and workflows stay the same; only the storage backend swaps later.

## What to ask for

Ask a **Microsoft 365 Business** tenant admin to create an **Azure AD / Entra ID** app registration and send:

| # | Item | Example / notes |
|---|------|-----------------|
| 1 | **Tenant ID** (Directory ID) | GUID from Entra ID → Overview |
| 2 | **Application (client) ID** | GUID of the app registration |
| 3 | **Client secret** | Secret **value** + expiry date (store securely; do not put in chat long-term) |
| 4 | **SharePoint site URL** or OneDrive drive for project folders | e.g. `https://contoso.sharepoint.com/sites/SharnamProjects` |
| 5 | Permission type | Prefer **Application** permissions for server sync. Or agree to **delegated** user login |
| 6 | API permissions to grant + admin consent | `Files.ReadWrite.All`, `Sites.ReadWrite.All`, and `User.Read` if delegated |
| 7 | Drawing storage choice | SharePoint document library **or** OneDrive for Business |
| 8 | Optional: test mailbox | For later outbound mail / meeting invites |

## How they create it (short steps)

1. [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations** → **New registration**
2. Name: e.g. `Sharnam Portal DMS`
3. Supported account types: single tenant
4. Certificates & secrets → **New client secret** → copy value immediately
5. API permissions → **Microsoft Graph** → Application (or Delegated) → add permissions above → **Grant admin consent**
6. Create / confirm SharePoint site with a Document Library for project folders

## What we will do after receiving credentials

1. Store `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `SHAREPOINT_SITE_ID` / drive ID as Render env vars
2. Set `MOCK_ONEDRIVE=false` and enable Graph upload/sync in place of local `uploads/onedrive`
3. Re-test: drawing upload → project folder → checklist gate → CSV GFC export

## Demo access (no Graph required)

Use the Render / local demo with portal logins in [README.md](README.md). Password for all demo users: `Demo@1234`.
