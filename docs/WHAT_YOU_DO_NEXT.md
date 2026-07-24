# What you need to do next

## 1. Push + review on Render

```bash
cd /Users/baibhabmustafi/workspace/sharnam-portal
git push origin main
```

(Use a GitHub **Personal Access Token** as the password — see earlier note.)

Then: https://sharnam-portal.onrender.com/login → `office@sharnam.demo` / `Demo@1234`

---

## 2. Ask Sharnam for M365 (OneDrive + Outlook + Project)

Send them **[docs/M365_SETUP.md](M365_SETUP.md)** (or short list **[CLIENT_MICROSOFT_REQUEST.md](../CLIENT_MICROSOFT_REQUEST.md)**).

They return:

1. Tenant ID, Client ID, Client secret  
2. SharePoint site URL (**OneDrive files**)  
3. Shared mailbox `pmc-portal@…` (**Outlook mail APIs**)  
4. Whether they have **Microsoft Project** licenses + Project ID / PWA URL (**S-curve**)

You paste into **Render → Environment** (full list in M365_SETUP section E) and redeploy.

| Connection | Without their reply | With their reply |
|------------|---------------------|------------------|
| Files | Mock OneDrive | Live SharePoint |
| Mail | Outbox queue | Graph `Mail.Send` |
| S-curve | Progress manual / Excel | MS Project sync if licensed |

---

## 3. Order

A. You push → review UI  
B. They finish Entra app + consent + SharePoint + mailbox  
C. You set env on Render  
D. Test Documents upload, then mail, then Project/S-curve (or Excel % if no Project)
