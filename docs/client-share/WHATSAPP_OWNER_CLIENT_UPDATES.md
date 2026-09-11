# WhatsApp updates — owner & client only (no broadcast)

**Prepared for:** SPDC / Sharnam PMC leadership & IT  
**Portal:** https://portal.spdc.in  
**Date:** September 2026  
**Audience:** Non-technical — what to do, why, and cost  

---

## 1. What you asked for

| Requirement | How the portal handles it |
|-------------|---------------------------|
| Updates on **WhatsApp** (not email only) | Built — sends when key events happen |
| **Owner + client** mobiles only | You list named numbers per project — no vendor lists |
| **No broadcast** to contractors / public | We use **Utility** (transactional) messages only — not Marketing campaigns |
| Backend **ready today** | Code is live; you only need **MSG91 + Meta template approval** on your account |

**We do not send:** bulk marketing, vendor bid blasts, site-wide announcements, or messages to numbers not saved in project settings.

---

## 2. Three options (pick one path)

### Option A — Automatic API alerts **(recommended · go-live path)**

**What it is:** When someone raises an RFI, schedules a meeting, or updates NCR/CAR in the portal, WhatsApp goes automatically to the numbers you configured.

**Backend status:** **Ready now** — no new development required for go-live.

**What triggers WhatsApp today:**

| Event | Who gets it |
|-------|-------------|
| Meeting scheduled | Numbers in project WhatsApp settings |
| RFI raised | Same |
| RFI closed | Same |
| Quality NCR / CAR created, updated, or closed | Same |
| Safety NCR (where enabled) | Same |

**Where to configure:** Project → **Comms** → **Email & WhatsApp** → *WhatsApp numbers* (comma-separated 10-digit Indian mobiles).

**Example (owner + client on one project):**

```text
8160757201,9106945294,9876543210
```

- First numbers = PMC owner / operations  
- Last numbers = client PM / client director (your choice of order — document it internally)

**If API is not configured yet:** Portal falls back to **wa.me** links — staff tap “Open WhatsApp” and send manually (Option C). No automatic delivery until MSG91 is live.

**Yearly cost (India, MSG91, 1 business number, normal project activity):**

| Component | Approx. yearly (incl. 18% GST) |
|-----------|--------------------------------|
| MSG91 platform (1 WhatsApp Business number) | **₹7,000–7,100** (first year may be ~₹5,900 if 2-month waiver applies) |
| Meta message fees (Utility alerts, low volume) | **₹200–800** |
| **Total** | **~₹7,500–8,000 / year** |

*Not included: portal software licence / hosting — separate from WhatsApp.*

---

### Option B — Daily morning summary on WhatsApp **(optional · after Option A)**

**What it is:** One short “what changed yesterday” message each morning — same idea as the existing **email** digest, but on WhatsApp.

**Backend status:** Email digest exists; **WhatsApp digest is a small add-on** (estimated 1–2 dev days after Option A is proven).

**Cost impact:** ~₹150–400/year extra (365 days × 2–3 recipients × Utility rate).

**Recommendation:** Turn on **Option A first**. Add Option B only if owners want a daily rollup without opening email.

---

### Option C — Manual wa.me only **(zero MSG91 cost · not automatic)**

**What it is:** Portal builds a pre-filled WhatsApp message; user taps a link and sends from their personal phone.

**Backend status:** Ready now.

**Limitation:** Not hands-free — someone must tap Send. Fine for UAT/demo; not ideal for production owner updates.

**Cost:** ₹0 (uses personal WhatsApp).

---

## 3. Recommended decision for SPDC

```text
Today / this week  →  Option A (MSG91 signup + templates + server .env)
UAT                →  Option C fallback OK until templates approved
After 2–4 weeks    →  Consider Option B if owners want daily digest
Never              →  Marketing broadcast to vendors / client mailing lists
```

---

## 4. What SPDC must do — and **why**

Each step exists because **Meta (WhatsApp)** requires verified business messaging. The Sharnam portal cannot send on your behalf until your WhatsApp Business account and templates are approved.

### Step 1 — Choose the sending number

| Do | Why |
|----|-----|
| Pick **one dedicated mobile** for WhatsApp Business API (e.g. operations desk SIM) | Meta registers this as your official business sender |
| **Do not** use a number already on the normal WhatsApp app on a phone | API number must be exclusive — Meta will disconnect app WhatsApp on that SIM |
| Keep the SIM active for OTP / verification | Meta and MSG91 verify ownership by SMS/call |

**Owner action:** Confirm which SIM SPDC will dedicate (10-digit Indian mobile).

---

### Step 2 — MSG91 account & Titan WhatsApp plan

| Do | Why |
|----|-----|
| Sign up at [msg91.com](https://msg91.com) with SPDC billing details | Indian INR wallet, local support, portal already integrated with MSG91 |
| Subscribe **Titan WhatsApp** (~₹500/month + GST per business number) | Platform fee for API access; one number covers **all projects** in the portal |
| Add wallet balance for Meta pass-through (~₹500–1,000 to start) | Meta charges per Utility message (~₹0.14 incl. GST); wallet must be funded |

**Owner action:** Create MSG91 account; pay Titan plan; note **Auth Key** from dashboard.

---

### Step 3 — Meta Business Manager + WhatsApp Business Account

| Do | Why |
|----|-----|
| Use (or create) **Meta Business Manager** for SPDC | Meta owns WhatsApp policy — every API sender must link to a verified business |
| Complete **business verification** (GST, company name, address) | Without this, templates stay pending or get rejected |
| Connect WhatsApp Business Account (WABA) inside MSG91 onboarding wizard | Links your MSG91 number to Meta’s messaging network |

**Owner action:** Assign one person with access to SPDC GST certificate and Meta Business admin rights (often IT or director).

**Typical time:** Same day if documents ready; verification can take **24–72 hours** in busy periods.

---

### Step 4 — Approve message templates (Utility, not Marketing)

Meta **blocks** free-form first messages. Every alert must use an **approved template**.

| Template purpose | Category | Example name |
|------------------|----------|--------------|
| Generic portal alert | **Utility** | `sharnam_portal_update` |
| RFI action | **Utility** | `sharnam_rfi_alert` |
| NCR / CAR update | **Utility** | `sharnam_ncr_update` |
| Meeting invite | **Utility** | `sharnam_meeting_invite` |

**Sample template body** (one variable `{{1}}` for the portal message text):

```text
Sharnam Portal update for your project:

{{1}}

Reply STOP to opt out. For support contact your PMC office.
```

| Do | Why |
|----|-----|
| Submit templates as **Utility** | Correct pricing (~₹0.115/msg) and policy for transactional alerts |
| **Do not** submit as Marketing | ~7× more expensive; meant for promotions |
| Use **English** (`en`) unless you need Hindi separately | Portal messages are English today |

**Owner action:** Submit 1–4 templates in MSG91 → WhatsApp → Templates; wait for Meta **Approved** status.

**Typical time:** **2–24 hours** for Utility templates when business is verified (sometimes same day).

---

### Step 5 — Share credentials with Sharnam (secure channel)

Send these to your portal host / dev team **once** (not by public email if possible):

| Item | Where in MSG91 |
|------|----------------|
| `MSG91_AUTH_KEY` | Dashboard → API |
| `MSG91_WHATSAPP_SENDER` / integrated number | WhatsApp → Numbers |
| `MSG91_INTEGRATED_NUMBER` | Same (if different from sender) |
| `MSG91_WHATSAPP_TEMPLATE_ID` | Approved template **name** (e.g. `sharnam_portal_update`) |

Sharnam sets on the server:

```env
WHATSAPP_PROVIDER=msg91
MSG91_AUTH_KEY=your_key
MSG91_WHATSAPP_SENDER=91XXXXXXXXXX
MSG91_INTEGRATED_NUMBER=91XXXXXXXXXX
MSG91_WHATSAPP_TEMPLATE_ID=sharnam_portal_update
```

Then restart the API. **No portal code deploy needed** — integration already exists.

---

### Step 6 — Configure recipients in the portal

| Do | Why |
|----|-----|
| Open **Project → Comms → Email & WhatsApp** | Per-project owner/client list |
| Enter **owner mobiles first**, then **client mobiles** | Same field today; order is for your internal clarity |
| Tick **WhatsApp enabled** | Master switch per project |
| Click **Send test WhatsApp** | Confirms API + templates + numbers |

**Owner action:** PMO maintains the list when client contacts change — like updating an email distribution list.

---

### Step 7 — Opt-in & privacy (good practice)

| Do | Why |
|----|-----|
| Tell each owner/client mobile holder they will receive **project alerts** on WhatsApp | Meta expects consented business messaging |
| Keep list to **named stakeholders only** | Matches “no broadcast” requirement |
| Remove numbers when someone leaves the project | Avoids stray alerts |

---

## 5. MSG91 — “get it ready today” checklist

Print this and tick off with MSG91 support on a call if needed.

| # | Action | Owner | Done? |
|---|--------|-------|-------|
| 1 | Dedicated SIM chosen; removed from personal WhatsApp app | SPDC ops | ☐ |
| 2 | MSG91 account created; Titan WhatsApp plan active | SPDC finance/IT | ☐ |
| 3 | Wallet topped up (₹500–1,000+) | SPDC finance | ☐ |
| 4 | Meta Business Manager — SPDC business added | SPDC IT | ☐ |
| 5 | Business verification documents uploaded | SPDC IT | ☐ |
| 6 | WABA connected via MSG91 wizard | SPDC IT + MSG91 | ☐ |
| 7 | Phone number verified on WABA | SPDC ops | ☐ |
| 8 | Utility template `sharnam_portal_update` submitted | SPDC IT | ☐ |
| 9 | Template status = **Approved** | Meta (via MSG91) | ☐ |
| 10 | Auth key + template name sent to Sharnam host | SPDC IT | ☐ |
| 11 | Server `.env` updated + API restarted | Sharnam dev | ☐ |
| 12 | Portal test send to owner + client numbers | SPDC PMO | ☐ |
| 13 | Live test: schedule meeting → WhatsApp received | SPDC PMO | ☐ |

**What “ready today” realistically means:**

- **Same day:** Steps 1–8, manual wa.me fallback works immediately for demos.  
- **Same day or next:** Step 9–13 once Meta approves templates (often hours for Utility).  
- **If business verification is pending:** Automatic API may take **1–3 business days** — use Option C until then.

---

## 6. What to email / WhatsApp MSG91 support today

Copy-paste this to MSG91 chat or `support@msg91.com`:

```text
Subject: Enable WhatsApp Business API for Sharnam / SPDC — transactional Utility only

Hello,

We need WhatsApp Business API for our construction PMC portal (Sharnam).
Use case: transactional alerts only to 2–5 named mobiles per project
(RFI, NCR, meeting invites). No marketing broadcast.

Please help us today with:
1. Titan WhatsApp plan on our account
2. WABA onboarding with Meta Business Manager
3. Approval of Utility template: sharnam_portal_update
   Body: "Sharnam Portal update for your project: {{1}}"
4. Confirm integrated number and auth key for API v5 whatsapp-outbound-message

Dedicated sender number: [YOUR 10-DIGIT MOBILE]
Company: Sharnam Project Development Consultants / SPDC
GST: [YOUR GSTIN]

Technical integration is already built (MSG91 v5). We need template
approval and credentials to go live.

Contact: [NAME, MOBILE, EMAIL]
```

---

## 7. What Sharnam dev team does (already built)

| Component | Status |
|-----------|--------|
| MSG91 + Twilio send service | Live |
| Per-project WhatsApp numbers + enable flag | Live |
| Triggers: meeting, RFI, NCR/CAR | Live |
| Test send + API status badge in UI | Live |
| wa.me fallback when API missing | Live |
| Email daily digest | Live (email only) |
| WhatsApp daily digest | Not built — Option B |
| Separate “owner” vs “client” fields | Not built — use comma list in one field for now |

**After you share MSG91 credentials:** we update production `.env`, restart API, run one test send — **~15 minutes**.

Optional later (if you want):

- Split **Owner WhatsApp** and **Client WhatsApp** fields in project settings  
- Add WhatsApp to daily digest (Option B)  
- Add alerts for drawing publish, WPR, bid award (same Utility pattern)

---

## 8. Quick reference — portal paths

| Task | Path |
|------|------|
| Set owner + client numbers | Project → Comms → **Email & WhatsApp** |
| Check API status | Same page — badge shows `API · msg91` or `Manual / wa.me` |
| Send test | Same page → **Send test WhatsApp** |
| Demo script (sample summary text) | Dev: `npm run` / `npx tsx apps/api/scripts/send-spdc-whatsapp-summary.ts` |

**Demo logins:** see [02-Logins-and-Access.md](./02-Logins-and-Access.md) · password `Demo@1234`

---

## 9. One paragraph for leadership

> WhatsApp project alerts are **already built** in the Sharnam portal. SPDC only needs **one MSG91 WhatsApp Business number** (~₹7,000–8,000/year total), **Meta business verification**, and **Utility template approval** — then owners and client contacts receive automatic messages when RFIs, NCRs, and meetings change. **No broadcast** to vendors; only mobiles you list per project. Manual fallback works today via wa.me until MSG91 is live.

---

*SPDC-CLIENT-SHARE · WhatsApp owner/client updates · Rev 01 · September 2026*
