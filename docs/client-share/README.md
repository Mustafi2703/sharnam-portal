# Sharnam Portal — Client share pack

**Prepared for:** SPDC / Sharnam PMC  
**Date:** 10 August 2026  
**Demo:** https://sharnam-portal.onrender.com  

Share this folder with client stakeholders, IT, and module owners. Plain language — no engineering jargon.

---

## Contents

| # | Document | Who reads it |
|---|----------|--------------|
| 1 | [01-Whats-New.md](./01-Whats-New.md) | Everyone — what was delivered |
| 2 | [02-Logins-and-Access.md](./02-Logins-and-Access.md) | All users — how to sign in |
| 3 | [03-Module-Test-Plan.md](./03-Module-Test-Plan.md) | SPDC leads — test each module on your server |
| 4 | [04-SharePoint-and-Files.md](./04-SharePoint-and-Files.md) | IT — photos & documents to SharePoint |
| 5 | [05-Brand-and-Logo.md](./05-Brand-and-Logo.md) | Marketing / reports — logo & colours |
| **12** | **[12-Live-Client-UAT-Workbook.md](./12-Live-Client-UAT-Workbook.md)** | **Everyone — upload to Google Docs; edit live during UAT** |

---

## Live client testing (Google Docs)

1. Upload **[12-Live-Client-UAT-Workbook.md](./12-Live-Client-UAT-Workbook.md)** to Google Drive → open as Google Doc (or paste into a new Doc).
2. Share with SPDC leads as **Editor**.
3. During each module session: walk **features + test steps**; add rows only under **Meeting changes** on each page; tick **sign-off** when page passes.
4. Dev team marks **Dev status** on page stakes after deploy; client re-tests and ticks **Re-test**.

**Dev team (repo):** Keep module routes and UAT rows in sync with the app using [../client-testing/HOW-TO-MAINTAIN.md](../client-testing/HOW-TO-MAINTAIN.md) and [../client-testing/00-MASTER-INDEX.md](../client-testing/00-MASTER-INDEX.md). When Quality, Drawings, or Safety change, update **03-quality**, **01-drawings**, **04-safety** and the matching rows in doc **12** above.

---

## Next step: your server

After sign-off on the demo, we deploy to **SPDC’s server** (Hostinger / Azure / on-prem). Then run **03-Module-Test-Plan.md** — one module per session with office + site users.

Technical requirements baseline: [../CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md)

---

*SPDC-CLIENT-SHARE · Rev 02 · aligns with CLIENT_REQUIREMENTS v2.1*
