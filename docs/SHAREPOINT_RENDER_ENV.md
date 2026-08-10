# SharePoint on Render — environment variables & photo upload check

**Site:** https://spdcsmb.sharepoint.com/sites/SharnamProjects  
**Live portal:** https://sharnam-portal.onrender.com  
**Audience:** SPDC IT + development team

---

## 1. Required Render environment variables

Set these on the **Render web service** (Dashboard → sharnam-portal → Environment):

| Variable | Example / value | Required for SharePoint |
|----------|-----------------|-------------------------|
| `AZURE_TENANT_ID` | *(from Entra app)* | Yes |
| `AZURE_CLIENT_ID` | *(from Entra app)* | Yes |
| `AZURE_CLIENT_SECRET` | *(secret value — rotate before expiry)* | Yes |
| `SHAREPOINT_SITE_URL` | `https://spdcsmb.sharepoint.com/sites/SharnamProjects` | Yes |
| `MOCK_ONEDRIVE` | **`false`** | Yes — must be exactly `false` for live SharePoint |
| `GRAPH_MAIL_FROM` | `pmc-portal@spdc.in` | Mail only (not files) |
| `GRAPH_MAIL_ENABLED` | `true` | Mail only |
| `JWT_SECRET` | *(random string)* | App login |
| `WEB_ORIGIN` | `https://sharnam-portal.onrender.com` | CORS |

**Aliases also accepted:** `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`, `GRAPH_SHAREPOINT_SITE_URL`.

Copy template: [`.env.render.local.example`](../.env.render.local.example) (never commit real secrets).

---

## 2. Quick health check (no login)

After deploy, open in browser:

```
https://sharnam-portal.onrender.com/api/health
```

| Field | Good value | Meaning |
|-------|------------|---------|
| `mockOneDrive` | `false` | Live SharePoint mode |
| `graphConfigured` | `true` | Azure app credentials present |
| `sharePointSiteUrlSet` | `true` | Site URL env var set |
| `timezone` | `Asia/Kolkata` | Attendance times stored in IST |

**Deep SharePoint probe** (after next deploy):

```
https://sharnam-portal.onrender.com/api/health/sharepoint
```

| Field | Good value |
|-------|------------|
| `tokenOk` | `true` |
| `siteOk` | `true` |
| `driveId` | non-null GUID |
| `error` | `null` |

If `tokenOk` is false → secret expired or wrong tenant/client ID.  
If `siteOk` is false → wrong `SHAREPOINT_SITE_URL` or missing `Sites.ReadWrite.All` consent.

---

## 3. Where attendance selfies land

Site punch (`/attendance` → Check in) uploads to:

```
PortalSandbox/{PROJECT_CODE}/03_SUPPORT_AND_RESOURCES/03.02_Resources_and_Productivity/Attendance/in-{person}-{timestamp}.jpg
```

On SharePoint: **Documents** library under the sandbox folder for the selected project code (e.g. `SPDC-DEMO-01`). If no project is selected, code `OFFICE` is used.

**Success message on phone:** `Checked in at 15:42 IST · … · SharePoint`  
**Fallback message:** `Photo saved on server only — SharePoint upload failed…` → file is on Render disk only; fix env/permissions and re-punch.

---

## 4. Render logs — what to search

Render Dashboard → **Logs** → filter:

| Log text | Meaning |
|----------|---------|
| `[SharePoint] upload failed, kept local mock:` | Graph upload error; photo not in SharePoint |
| `[SharePoint] ensureProjectTree failed:` | Folder bootstrap failed |
| `Missing SHAREPOINT_SITE_URL` | Env var not set |
| `Token request failed` | Bad secret or expired client secret |
| `Could not parse SharePoint site URL` | URL must be `/sites/SiteName` form |

---

## 5. Entra app permissions (admin consent)

Microsoft Graph **Application** permissions — all must show green check after **Grant admin consent**:

- `Files.ReadWrite.All`
- `Sites.ReadWrite.All`
- `Mail.Send` (for Outlook — separate from files)

Full click-path: [M365_SETUP.md](./M365_SETUP.md)

---

## 6. Office test after env update

1. Redeploy Render service after changing env vars.  
2. Open `/api/health/sharepoint` — confirm `tokenOk` + `siteOk`.  
3. Login **Site** → `/attendance` → select project → selfie → **Check in**.  
4. Confirm message includes **SharePoint**.  
5. Open SharePoint site → Documents → `PortalSandbox` → `{project code}` → `…/Attendance/`.

---

*Ref: SPDC-SHAREPOINT-ENV-REV01 · Aug 2026*
