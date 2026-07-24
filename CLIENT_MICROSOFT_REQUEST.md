# Microsoft 365 — ask Sharnam (OneDrive + Outlook + MS Project)

They only need their existing **Microsoft 365 Business** admin. No IT team required.

**Hand them the full click guide:** [docs/M365_SETUP.md](docs/M365_SETUP.md)

## What they must send back

| # | Item | Used for |
|---|------|----------|
| 1 | **Tenant ID** | All Graph APIs |
| 2 | **Application (client) ID** | All Graph APIs |
| 3 | **Client secret** + expiry | All Graph APIs |
| 4 | **SharePoint site URL** | OneDrive / drawings / DMS |
| 5 | **Shared mailbox** e.g. `pmc-portal@company.com` | Outlook: RFI, meeting, publish mail |
| 6 | **Admin consent** for Files + Sites + Mail (+ Calendar) | Required |
| 7 | **Microsoft Project?** Yes/No + Project ID or PWA URL | S-curve sync (only if licensed) |

### Graph permissions to grant (application)

- `Files.ReadWrite.All`, `Sites.ReadWrite.All` — OneDrive  
- `Mail.Send`, `Mail.ReadWrite` — Outlook  
- `Calendars.ReadWrite` — meeting invites  
- `Project.Read.All` — S-curve (**only if they have Project / Project Online**)

### If they have no MS Project license

S-curve still works via **Progress → Planned vs Actual** (Excel / manual %). Buying Project Plan is optional.

## Demo without Graph

https://sharnam-portal.onrender.com — `office@sharnam.demo` / `Demo@1234`
