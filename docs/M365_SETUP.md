# Microsoft 365 setup — OneDrive + Outlook mail + MS Project (S-curve)

For **Sharnam Project Development Consultants** on a normal **Microsoft 365 Business** subscription (no IT team). One admin user can do this.

The portal already has:

| Capability | Today (demo) | After you finish this guide |
|------------|--------------|-------------------------------|
| **OneDrive / SharePoint** | Mock folders on Render | Live drawings & DMS |
| **Outlook mail** | Email outbox (queued, not sent) | Real send: RFI, drawing publish, meeting invites |
| **S-curve** | Progress → Planned vs Actual (manual / Excel seed) | From **MS Project** % complete / baseline (if licensed) |

Demo keeps working with mocks until env vars are set: https://sharnam-portal.onrender.com

---

## Who must do the clicks?

Someone who can open https://admin.microsoft.com as **Global admin** (or Application admin).  
Usually the person who bought Microsoft 365, or their Microsoft partner.

---

# A — One-time: register “Sharnam Portal” app

Do this **once**. Same app serves OneDrive + Mail (+ Project if licensed).

1. Open https://entra.microsoft.com (or https://portal.azure.com → **Microsoft Entra ID**).
2. **Applications** → **App registrations** → **New registration**.
3. Name: `Sharnam Portal`  
   Accounts: **This organizational directory only** → **Register**.
4. On **Overview**, copy:
   - **Application (client) ID**
   - **Directory (tenant) ID**
5. **Certificates & secrets** → **New client secret** → copy the **Value** immediately + note expiry.
6. **API permissions** → **Add a permission** → **Microsoft Graph** → **Application permissions** → add **all** of these:

### Files (OneDrive / SharePoint)

| Permission | Why |
|------------|-----|
| `Files.ReadWrite.All` | Upload / sync drawings & documents |
| `Sites.ReadWrite.All` | SharePoint project libraries |

### Mail (Outlook)

| Permission | Why |
|------------|-----|
| `Mail.Send` | Send as the shared mailbox (RFI, MoM, publish notices) |
| `Mail.ReadWrite` | Optional: read sent items / sync status (recommended) |

### Calendar (meetings — recommended with mail)

| Permission | Why |
|------------|-----|
| `Calendars.ReadWrite` | Create meeting invites from Comms |

### MS Project / schedule (only if they have Project Online / Project for the web)

| Permission | Why |
|------------|-----|
| `Project.Read.All` | Read tasks / % complete for S-curve *(Graph / Project Online)* |
| `Tasks.Read.All` | Fallback task progress if using Planner-linked work |

7. Click **Grant admin consent for \<company\>** → **Yes**. All rows must show green checks.

**Send the developer (securely):**

| Item | Value |
|------|--------|
| Tenant ID | |
| Client ID | |
| Client secret + expiry | |
| SharePoint site URL | (section B) |
| Shared mailbox address | (section C) |
| Project Online / Project for the web URL or Project ID | (section D — if licensed) |

---

# B — OneDrive / SharePoint (drawings & DMS)

**Use SharePoint** (not one person’s OneDrive) so files stay with the company.

1. https://www.office.com → **SharePoint** → **Create site** → Team site  
   Name: **Sharnam Projects**
2. Open **Documents**. Later create one folder per project code (`SPDC-DEMO-01`, …).
3. Copy browser URL, e.g. `https://yourcompany.sharepoint.com/sites/SharnamProjects`

**Render env (developer):**

```
AZURE_TENANT_ID=…
AZURE_CLIENT_ID=…
AZURE_CLIENT_SECRET=…
SHAREPOINT_SITE_URL=https://….sharepoint.com/sites/SharnamProjects
MOCK_ONEDRIVE=false
```

**Test:** Office login → project → Documents → open Drawings → upload a revision → file appears in SharePoint.

---

# C — Outlook mail APIs (RFI / meetings / publish)

They do **not** need a new personal inbox. Create a **shared mailbox**.

1. https://admin.microsoft.com → **Teams & groups** → **Shared mailboxes** → **Add**  
   Display name: `Sharnam Portal`  
   Email: e.g. `pmc-portal@yourcompany.com`
2. Optional: give Office users **Send as** on that mailbox so humans can reply from Outlook too.
3. Send `pmc-portal@yourcompany.com` to the developer.

**Important:** Application permission `Mail.Send` lets the portal send **as** that mailbox. No extra “Exchange Online plan” beyond normal M365 Business mailboxes.

**Render env (add):**

```
GRAPH_MAIL_FROM=pmc-portal@yourcompany.com
GRAPH_MAIL_ENABLED=true
```

In the portal: project → **Email / Outlook** → set notification list + mark Outlook connected.

**Test:** Raise an RFI or publish a drawing → recipient gets real mail (or check Sent Items on the shared mailbox). Until Graph is wired in code, items still land in portal **Email outbox** — same fields, live send flips on when `GRAPH_*` is set.

---

# D — MS Project connection for S-curve

### Reality check (Business M365)

| What they have | S-curve path |
|----------------|--------------|
| **M365 Business only** (Outlook, OneDrive, Teams — **no** Project app) | Use portal **Progress → Planned vs Actual** (upload % from Excel / WPR). No MS Project API until they buy a Project license. |
| **Microsoft Project Plan 1 / 3 / 5** or **Project Online** | Connect project → sync % complete / baseline → portal builds S-curve under Progress + WPR. |

Ask their admin: *“Do we have Microsoft Project or Project for the web licenses?”*  
Check: https://admin.microsoft.com → **Billing** → **Licenses** → look for **Project**.

### If they **do** have Project

1. Open https://project.microsoft.com (or Project Online PWA URL they use).
2. Create / open the live project (same as site name / code).
3. Ensure tasks have **% Complete** and baseline dates.
4. Send developer:
   - Project for the web **Project ID** (from URL), **or**
   - Project Online site: `https://yourcompany.sharepoint.com/sites/pwa` + project name/GUID
5. Confirm app permission `Project.Read.All` was consented (section A).

**Render env (add when ready):**

```
MS_PROJECT_ENABLED=true
MS_PROJECT_MODE=project_for_web
# or: project_online
MS_PROJECT_PWA_URL=https://….sharepoint.com/sites/pwa
MS_PROJECT_DEFAULT_PROJECT_ID=
```

**How S-curve works in the portal**

1. Sync pulls planned vs actual % by period (week/month).  
2. Writes into **Progress → Planned vs Actual** (and feeds WPR).  
3. Cashflow S-curve stays in **Cost → Cashflow** (money); schedule S-curve lives in **Progress**.

### If they **do not** have Project yet

**Option 1 (buy):** Add **Project Plan 1** (or higher) for 1–2 planners — then use section D above.  
**Option 2 (no buy):** Export schedule % from whatever they use (Excel / Primavera print) into Progress Planned vs Actual — same charts, manual/CSV import. Document for them: keep baseline in one Excel, update actual % weekly.

---

# E — Full env list (developer / Render)

```
# Identity (required for all three)
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=

# OneDrive / SharePoint
SHAREPOINT_SITE_URL=
MOCK_ONEDRIVE=false

# Outlook mail
GRAPH_MAIL_FROM=pmc-portal@…
GRAPH_MAIL_ENABLED=true

# MS Project / S-curve (only if licensed)
MS_PROJECT_ENABLED=false
MS_PROJECT_MODE=project_for_web
MS_PROJECT_PWA_URL=
MS_PROJECT_DEFAULT_PROJECT_ID=
```

---

# F — Same-day test plan

1. Admin finishes A + consent.  
2. B: SharePoint site created; C: shared mailbox created; D: Project license confirmed or skipped.  
3. Developer sets env on Render → redeploy.  
4. **Files:** Documents sync + drawing upload.  
5. **Mail:** Send test from project Email settings / raise RFI.  
6. **S-curve:** If Project connected → Progress Planned vs Actual updates; else upload week % manually and confirm chart/WPR.

---

# Checklist to return to the developer

- [ ] Tenant ID  
- [ ] Client ID  
- [ ] Client secret + expiry  
- [ ] Admin consent granted (Files + Sites + Mail + Calendar; Project if licensed)  
- [ ] SharePoint site URL  
- [ ] Shared mailbox `pmc-portal@…`  
- [ ] Do we have Microsoft Project licenses? **Yes / No**  
- [ ] If Yes: Project for the web ID **or** PWA URL + project name  

**You do not need:** Azure VMs, a separate “IT Azure subscription”, or a personal inbox for the portal.
