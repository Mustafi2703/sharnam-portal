# WPR export — template PPTX + PDF (Hostinger / portal.spdc.in)

## What works on Hostinger Cloud (no VPS)

| Output | How |
|--------|-----|
| **PPTX** | Fills `templates/SPDC_WPR_CLIENT_REFERENCE.pptx` (client layout, 61 slides) |
| **PDF** | Uploads filled PPTX to **SharePoint**, Microsoft Graph converts to PDF |

You do **not** need LibreOffice, Docker, or Gotenberg on Hostinger.

## Required hPanel env (you likely already have these)

```env
MOCK_ONEDRIVE=false
AZURE_TENANT_ID=...
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
SHAREPOINT_SITE_URL=https://spdcsmb.sharepoint.com/sites/SharnamProjects
```

Check: `https://portal.spdc.in/api/health/sharepoint` → `"tokenOk": true`

## API

| Route | Output |
|-------|--------|
| `GET /api/wpr-maker/:projectId/download.pptx?end=YYYY-MM-DD` | Client-template PPTX |
| `GET /api/wpr-maker/:projectId/download.pdf?end=YYYY-MM-DD` | PDF via SharePoint Graph |
| `GET /api/wpr-maker/:projectId/export-status` | `{ templatePptx, pdfEngine, pdfEngineKind }` |

## Optional fallbacks (not needed on Hostinger)

| Variable | When |
|----------|------|
| `CLOUDCONVERT_API_KEY` | If SharePoint convert fails |
| `GOTENBERG_URL` | VPS with Docker only |
| `LIBREOFFICE_PATH` | Local dev machine |
| `WPR_PPTX_LEGACY=1` | Force old pptxgenjs deck (not recommended) |
| `WPR_PDF_DISABLED=1` | Turn off PDF export |

## Deploy checklist

1. Push code with `templates/SPDC_WPR_CLIENT_REFERENCE.pptx` in repo
2. hPanel → **portal.spdc.in** → env: `MOCK_ONEDRIVE=false` + Azure vars
3. Redeploy (`npm run hostinger:build` runs on push)
4. WPR Maker → Download **PPTX** then **PDF**

## Local test

```bash
npm run wpr:export-test
```

PDF test locally needs SharePoint creds in `.env` or LibreOffice installed.
