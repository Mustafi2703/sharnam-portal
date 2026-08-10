# SharePoint and file uploads

**Site:** https://spdcsmb.sharepoint.com/sites/SharnamProjects

---

## SharePoint = source document store

| Principle | Detail |
|-----------|--------|
| **Single store** | SharePoint holds all project files for production |
| **Portal uploads → SharePoint** | Every module upload uses the same bridge (`MOCK_ONEDRIVE=false`) |
| **Portal DMS → browse SharePoint** | Folder tree mirrors ISO Rev 02 structure under each project |
| **No duplicate store** | Portal is the window; SharePoint is the system of record |

Whoever uploads through the portal (Office, Site, Contractor) writes to SharePoint. HR attendance selfies, drawing PDFs, DMS contracts, and report exports all land in the same site library.

---

## What uploads to SharePoint

| Action | Folder pattern |
|--------|----------------|
| Site attendance selfie | `PortalSandbox/{PROJECT}/…/Attendance/` |
| DMS document upload | ISO folder tree under project library |
| Drawing sheet upload | Design & engineering folders |
| Quality / Safety evidence | HSE / quality folders |
| DPR / WPR exports | Reports folders |
| CRM quotation PDF | CRM / commercial folders |

---

## Document viewer (in-app)

| Capability | Requirement |
|------------|-------------|
| Browse folders | ISO tree per project; sync from SharePoint |
| Preview PDF | In-browser viewer |
| Preview image | Thumbnail + full view |
| Download | Where view is allowed |
| Matrix access | Parties on Communication Matrix open folders granted to their role |

Three surfaces — do not confuse:

| Surface | Purpose |
|---------|---------|
| **Documents (DMS)** | All project files — contracts, HSE, daily records |
| **GFC register** | Drawing revision workflow R0–R5 |
| **Drawing file library** | Sheet PDFs/DWG browse |

---

## How to know it worked

After **Check in** on site attendance, the success message should include **SharePoint**.

If it says the file was saved on the server only, IT should verify environment variables — see [../SHAREPOINT_RENDER_ENV.md](../SHAREPOINT_RENDER_ENV.md).

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

*Folder map: [../PMC_DMS_HANDOVER.md](../PMC_DMS_HANDOVER.md) · Requirements: [../CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md) §3C*
