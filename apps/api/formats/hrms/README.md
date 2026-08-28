# HRMS letter format files

The HR team can drop their real letterhead HTML (or plain-text .txt) file here to
override the built-in templates. On the next `POST /api/hrm/hrms-documents/:id/generate`
the system will pick it up automatically and use it instead of the fallback body.

## File naming

One file per document kind. Match the `kind` field exactly:

- `Appointment.html`  ← SPDC_Letter_of_Appointment.docx → convert to HTML
- `Offer.html`
- `Relieving.html`
- `Exit.html`
- `AssetReturn.html`
- `Confirmation.html`
- `Warning.html`
- `Experience.html`

## Placeholders

Use `{{placeholder}}` syntax anywhere in the file. These names are auto-filled from the
document record and the JSON blob supplied on create:

- `{{employeeName}}`, `{{designation}}`, `{{department}}`, `{{candidateEmail}}`
- `{{refNo}}`, `{{issueDate}}`, `{{effectiveDate}}`
- `{{ctcAnnual}}` (Appointment / Offer)
- `{{location}}` (Appointment / Offer)
- `{{assets}}`, `{{serials}}`, `{{condition}}`, `{{notes}}` (AssetReturn)
- `{{reason}}` (Exit / Warning)
- Any other key in the `data` JSON on create is available with the same name.

## Letterhead

You do NOT need to add the Sharnam logo — the framework wraps every generated
letter with the branded letterhead automatically (`letterhead()` in
`apps/api/src/services/hrmsLetter.ts`). Keep the template focused on the body.

If you want a completely custom letterhead, ship a full HTML page with your own
`<style>` and it will be used as-is.
