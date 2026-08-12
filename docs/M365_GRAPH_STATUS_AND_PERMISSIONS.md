# Sharnam Portal — Microsoft Graph permissions & live test report

**Prepared for:** SPDC Microsoft 365 / Entra administrator  
**Portal:** https://sharnam-portal.onrender.com  
**Report date:** 12 August 2026  
**Document:** SPDC-M365-GRAPH-STATUS-01

---

## 1. Purpose

The **Sharnam PMC Portal** connects to your Microsoft 365 tenant to:

1. Store and sync project documents on **SharePoint**
2. Send project notifications by **Outlook** (RFIs, drawing publish, custom notices)
3. Create **Microsoft Teams** meeting links and calendar invites (next phase)

This document lists the Entra app in use, **live permission test results**, what is still required, and how IT can verify after changes.

---

## 2. App registration details

| Item | Value |
|------|--------|
| **App name** | Sharnam Portal |
| **Application (client) ID** | `2fd78789-594e-4af6-b43d-cb82f59df39c` |
| **Directory (tenant) ID** | On file with portal operator (starts `8c7b7f64…`) |
| **Auth method** | OAuth 2.0 **client credentials** (application-only; no user Microsoft login in the portal) |
| **Graph scope** | `https://graph.microsoft.com/.default` |

### Related Microsoft 365 resources

| Resource | Value |
|----------|--------|
| **SharePoint site** | https://spdcsmb.sharepoint.com/sites/SharnamProjects |
| **Document library** | Documents → `Sharnam Portal / {ProjectCode} / …` |
| **Shared mailbox (send-from)** | `pmc-portal@spdc.in` |

---

## 3. Live test results (12 Aug 2026)

Tests were run against the production tenant using the portal’s configured Entra credentials.

| Permission / capability | Result | Notes |
|-------------------------|--------|--------|
| OAuth token acquisition | ✅ **Pass** | App can authenticate to Graph |
| **Sites.ReadWrite.All** | ✅ **Pass** | SharePoint site *Sharnam Projects* resolved |
| **Files.ReadWrite.All** | ✅ **Pass** | Document library listed; uploads working |
| **Mail.Send** | ✅ **Pass** | Real test email sent from `pmc-portal@spdc.in` |
| **Mail.ReadWrite** | ✅ **Pass** | Mailbox messages endpoint accessible |
| **Calendars.ReadWrite** | ✅ **Pass** | Calendar events endpoint accessible |
| **User.Read.All** | ❌ **Fail** | `GET /users/pmc-portal@spdc.in` → *Insufficient privileges* |
| **OnlineMeetings.ReadWrite.All** | ❌ **Fail** | Teams online meeting creation blocked |

### Real email send — confirmed

A live test message was successfully sent via Microsoft Graph:

- **From:** `pmc-portal@spdc.in`
- **API:** `POST /users/pmc-portal@spdc.in/sendMail`
- **Result:** Success (production portal `POST /api/graph/test-mail` returned `ok: true, sent: true`)

Please check the **`pmc-portal@spdc.in`** inbox for a message with subject **“Sharnam Portal — Graph mail test”**.

---

## 4. Summary for IT

### Already granted (thank you — working)

These **Application permissions** appear to be in place with **admin consent**:

- `Files.ReadWrite.All`
- `Sites.ReadWrite.All`
- `Mail.Send`
- `Mail.ReadWrite` (or equivalent mail read access)
- `Calendars.ReadWrite`

### Still required (please add + grant admin consent)

Open **Microsoft Entra admin center** → **App registrations** → **Sharnam Portal** → **API permissions** → **Microsoft Graph** → **Application permissions**:

| Permission | Type | Why the portal needs it |
|------------|------|-------------------------|
| **User.Read.All** | Application | Resolve shared mailbox in health checks (`GET /users/{mailbox}`). *Not blocking send today, but recommended.* |
| **OnlineMeetings.ReadWrite.All** | Application | Create **real Microsoft Teams join links** on calendar events (Comms meetings, HR interviews). *Currently stub links only.* |

After adding, click **Grant admin consent for [organization]** so both rows show a green checkmark.

### Optional (only if you use Microsoft Project for schedule / S-curve)

| Permission | Type | Why |
|------------|------|-----|
| `Project.Read.All` | Application | Read task % complete from Project Online |
| `Tasks.Read.All` | Application | Fallback if using Planner-linked tasks |

---

## 5. Exchange Online — shared mailbox

Please confirm the shared mailbox exists and is licensed for mail:

| Setting | Value |
|---------|--------|
| **Primary SMTP address** | `pmc-portal@spdc.in` |
| **Suggested display name** | Sharnam PMC Portal |
| **Usage** | All automated portal notifications send **from this address** |

**Optional:** Grant office staff **Send As** permission on this mailbox if they should compose mail manually from Outlook using the same address.

---

## 6. What emails the portal will send

Once fully wired, all messages use the **project notification list** configured in the portal (office, site, vendors, clients — per project).

| Event | Typical recipients | Example subject |
|-------|-------------------|-----------------|
| **New RFI raised** | Communication matrix / notification list | `[PROJECT] New RFI-001 — Subject` |
| **RFI official response** | Same list | `[PROJECT] RFI-001 answered` |
| **Drawing published (GFC)** | Same list | `[PROJECT] Drawing published — sheet ref` |
| **Checklist submitted** | Same list | `[PROJECT] Checklist submitted` |
| **Custom / manual notice** | User-entered addresses | User-defined subject |

**Teams / meeting invites** (MoM follow-ups, Comms module, HR interviews) require **OnlineMeetings.ReadWrite.All** in addition to calendar permissions.

---

## 7. How the portal sends mail (technical reference)

| Item | Detail |
|------|--------|
| Protocol | **Microsoft Graph API** (not SMTP) |
| Send endpoint | `POST https://graph.microsoft.com/v1.0/users/pmc-portal@spdc.in/sendMail` |
| Permission type | **Application** (daemon / app-only) |
| Sent items | Saved to shared mailbox Sent Items (`saveToSentItems: true`) |

There is **no** user OAuth / “Sign in with Microsoft” for portal login. Portal users sign in with portal credentials; the **app registration** sends mail on their behalf from the shared mailbox.

---

## 8. Verification steps (after IT makes changes)

### Step 1 — SharePoint (already passing)

```bash
npx tsx apps/api/scripts/test-sharepoint.ts
```

Expected: `SharePoint probe OK — token + site + drive readable`

### Step 2 — Mailbox resolve (needs User.Read.All)

```bash
npx tsx apps/api/scripts/test-mailbox.ts
```

Expected: `Mailbox OK` with mailbox id and UPN

### Step 3 — Send test email

Portal admin calls (or IT asks portal team to run):

```http
POST https://sharnam-portal.onrender.com/api/graph/test-mail
Authorization: Bearer <admin JWT>
Content-Type: application/json

{ "to": "your.name@spdc.in" }
```

Expected response:

```json
{ "ok": true, "sent": true, "from": "pmc-portal@spdc.in", "to": "your.name@spdc.in" }
```

### Step 4 — Teams meeting (after OnlineMeetings.ReadWrite.All)

Portal team will confirm real Teams join URLs appear on Comms / HR interview scheduling (replacing placeholder links).

---

## 9. Checklist for Microsoft admin

- [ ] App **Sharnam Portal** (`2fd78789-594e-4af6-b43d-cb82f59df39c`) exists in Entra ID
- [ ] Client secret is valid (not expired)
- [ ] **Application permissions** granted with **admin consent** (see §4)
- [ ] Shared mailbox **`pmc-portal@spdc.in`** exists in Exchange Online
- [ ] SharePoint site **SharnamProjects** accessible to the app
- [ ] Add **`User.Read.All`** + **`OnlineMeetings.ReadWrite.All`** (remaining items)
- [ ] Notify portal team when consent is updated so we re-run §8 tests

---

## 10. Related documents

| Document | Audience |
|----------|----------|
| [M365_SETUP.md](./M365_SETUP.md) | Step-by-step Entra + SharePoint + mailbox setup |
| [CLIENT_MICROSOFT_REQUEST.md](../CLIENT_MICROSOFT_REQUEST.md) | Short checklist of items to send back |
| [SHAREPOINT_RENDER_ENV.md](./SHAREPOINT_RENDER_ENV.md) | Server environment variables |

---

## 11. Contact

After updating permissions, please reply to the portal team with:

1. Confirmation that **admin consent** was granted for the new permissions  
2. Name of a test recipient (`@spdc.in`) for a live RFI / notification test  
3. Whether **Microsoft Project / Project Online** licenses are available (optional S-curve feature)

---

*Sharnam Portal · SPDC PMC · Microsoft Graph integration status report*
