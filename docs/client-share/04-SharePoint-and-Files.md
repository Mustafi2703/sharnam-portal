# SharePoint and file uploads

**Site:** https://spdcsmb.sharepoint.com/sites/SharnamProjects

---

## What uploads to SharePoint

| Action | Folder pattern |
|--------|----------------|
| Site attendance selfie | `PortalSandbox/{PROJECT}/…/Attendance/` |
| DMS document upload | ISO folder tree under project library |
| Drawing sheet upload | Design & engineering folders |
| DPR / WPR exports | Reports folders |

---

## How to know it worked

After **Check in** on site attendance, the success message should include **SharePoint**.

If it says the file was saved on the server only, IT should verify Render (or SPDC server) environment variables — see [../SHAREPOINT_RENDER_ENV.md](../SHAREPOINT_RENDER_ENV.md).

---

## IT environment variables

| Variable | Purpose |
|----------|---------|
| `AZURE_TENANT_ID` | Microsoft Entra tenant |
| `AZURE_CLIENT_ID` | App registration |
| `AZURE_CLIENT_SECRET` | App secret (rotate before expiry) |
| `SHAREPOINT_SITE_URL` | Sharnam Projects site URL |
| `MOCK_ONEDRIVE` | Must be `false` for live SharePoint |

Setup guide: [../M365_SETUP.md](../M365_SETUP.md)

---

## Health check URLs

```
https://your-portal-domain/api/health
https://your-portal-domain/api/health/sharepoint
```

Expect `mockOneDrive: false`, `tokenOk: true`, `siteOk: true`.

---

*Folder map: [../PMC_DMS_HANDOVER.md](../PMC_DMS_HANDOVER.md)*
