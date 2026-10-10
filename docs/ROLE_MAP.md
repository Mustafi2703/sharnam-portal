# Role map — who is what in the portal

## The seven roles (the only ones that exist)

| Role | Portal | Who | How it is created |
|---|---|---|---|
| `admin` | admin | SPDC administrator (Nirav) | Access · Users (admin only) |
| `office` | office | SPDC project office / PMC staff | HRMS or Access · Users |
| `hr` | hr | SPDC HR | HRMS or Access · Users |
| `site_employee` | site | SPDC site engineer (Baibhab) | HRMS offer → **Create portal login**, or Access · Users |
| `employee` **+ company link** | office | **Design consultant** / PMC party | CRM directory → company with e-mail → **Activate portal** |
| `client` | client | Client representative — read-only | CRM directory → Client company → **Activate portal** |
| `vendor` | vendor | **Contractor** / supplier | CRM directory → company → **Activate portal** |

`employee` means one thing only: an **external consultant / stakeholder** (designer, partner PMC) linked to a CRM company, limited to RFIs, design coordination, drawing mark-ups and meeting actions. SPDC staff are never `employee` — they are `office`, `hr`, `site_employee` or `admin`. A job title (Site engineer, Planning engineer, Accountant…) is the **designation** field and never changes the login role. Creating a consultant from Access links (or creates) the company automatically; existing ones are sorted in **UAT data → 9. Employee Role Cleanup**.

**The company type decides the role:** Client → `client` · Consultant, Designer, PMC → `employee` (linked) · everything else (contractor, supplier) → `vendor`. A party login made by hand without the company link is the usual source of "can't see it / wrong screens".

## What each role can do

| Role | Sees | Writes |
|---|---|---|
| admin | everything | everything |
| office | all modules and projects they are on | create / edit most modules; approve |
| hr | HRMS | HR records; not project modules |
| site_employee | projects they are a member of | DPR, checklist fills with photos, observations, safety log, attendance |
| employee + company (consultant) | projects they are a member of | RFI responses, design coordination, drawing mark-ups, meeting actions only |
| client | projects they are a member of | read-only; may raise a concern, sign reports, create / respond to RFIs |
| vendor (contractor) | projects they are a member of | fill assigned checklists, safety records, RFIs, respond to NCR / safety NCR |

Every login is limited to the projects it is a **member** of; another project's URL returns "not found".

## The UAT map

| Login | Role | Company link | Projects |
|---|---|---|---|
| nirav@spdc.in | admin | — | all |
| baibhabmustafi@gmail.com | site_employee | none (clear any client link) | SPDC-VOLTAMP-01 |
| hello@twinoxis.com | client | Voltamp Transformers Ltd. (Client) | SPDC-VOLTAMP-01 |
| admin@twinoxis.com | employee | Twinoxis Design Studio (Consultant) | SPDC-VOLTAMP-01 |
| hello@qryxtech.com | vendor | Qryx Infra Pvt. Ltd. (Contractor) | SPDC-VOLTAMP-01 |

Check it any time in **UAT data → 8. Role Map**. It marks each login OK / Check with the reason and a **Fix** button (sets the role, switches the login on, links the company by its e-mail). Logins hidden from lists: **6. Find A Login**.

## Where each kind of login is managed

| Kind | Where |
|---|---|
| SPDC staff (office, hr, site) | HRMS Users / Recruitment, or Office → Access |
| Client, consultant, contractor | CRM → Directory (company) → Activate portal; they list under Office → Access, **not** on the HRMS Users page |
| Project access | the project's Setup → team / directory |
