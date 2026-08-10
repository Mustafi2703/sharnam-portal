# Logins and access

**Demo:** https://sharnam-portal.onrender.com  
**Demo password:** `Demo@1234`

---

## Portal URLs

| Role | URL | Demo email |
|------|-----|------------|
| **Hub** (choose portal) | `/login` | — |
| **Office / PMC** | `/login/office` | `office@sharnam.demo` |
| **Site / field** | `/login/site` | `site@sharnam.demo` |
| **Contractor** | `/login/vendor` | `vendor@sharnam.demo` |
| **Client** | `/login/client` | `client@sharnam.demo` |

After production cutover, replace the domain with SPDC’s own (e.g. `portal.spdc.in`).

---

## What each role sees

| Portal | Primary work |
|--------|----------------|
| Office | Full project control — all modules, master setup, reports |
| Site | Attendance punch, day log, photos, checklist fills |
| Contractor | Assigned packages, inspection fills, evidence upload |
| Client | Published drawings, progress packs, concerns (read-only) |

---

## Site attendance (mobile)

1. Open `/login/site` on phone  
2. Sign in → lands on **Attendance**  
3. Allow **Camera** and **Location**  
4. Take selfie → **Check in**  
5. Confirm time shows **IST** and **SharePoint** on success  

---

## Production accounts

On SPDC’s server, demo `@sharnam.demo` accounts are replaced with real Microsoft 365 or local accounts assigned in **Master → Directory**.

---

*Brand reference: [05-Brand-and-Logo.md](./05-Brand-and-Logo.md)*
