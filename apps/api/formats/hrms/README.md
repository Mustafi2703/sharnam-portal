# HRMS letter format files

Official SPDC Word templates live here. On `POST /api/hrm/hrms-documents/:id/generate`
the system fills `{{TOKEN}}` placeholders from the form and writes editable `.docx`
plus print-ready HTML to SharePoint under `_HR/06_HR_AND_ADMIN/`.

Master templates are also synced to `_HR/06_HR_AND_ADMIN/06.04_Letter_Templates/` via `npm run hrms:sync-formats`.

## Word templates (`.docx`)

| File | Document kind |
|------|----------------|
| `Offer.docx` | Offer letter |
| `Appointment.docx` | Letter of appointment |
| `Confirmation.docx` | Confirmation after probation |
| `AssetReturn.docx` | Asset submission / return |
| `Relieving.docx` | Relieving letter |
| `Exit.docx` | Exit letter |
| `Promotion.docx` | Letter of promotion |
| `Warning.docx` | Warning / concern letter |
| `Experience.docx` | Experience certificate |
| `NdaJoining.docx` | NDA at joining |
| `NdaPostEmployment.docx` | NDA post-employment |

Reference: `00_SPDC_HR_Letters_Usage_Guide.docx` lists every token.

## Optional HTML overrides (`.html` / `.txt`)

One file per kind for the print preview body only (letterhead added automatically):

- `Appointment.html`, `Offer.html`, `Promotion.html`, …

Use `{{employeeName}}`, `{{designation}}`, etc. — see `hrmsLetter.ts`.

## Updating templates

1. Edit the `.docx` in Word and keep `{{TOKEN}}` names unchanged.
2. Drop the updated file here (same filename).
3. Redeploy or restart API, then click **Regenerate** on an existing row.

Extra tokens can be passed in the `data` JSON on create — any key matching a
template token (e.g. `FOCUS_AREA_1`, `PROJECT_NAME`, `PAN`) is merged in.

## CTC / Annexure I

Offer, Appointment, and Promotion letters still emit Annexure I `.xlsx` when
fixed CTC is on the form (`SPDC_CTC_Structure_Calculator` logic in `ctcAnnexure.ts`).
