# MODULE — Master & Home (project setup)

**Prompt:** `module_prompts/Project_Sharnam_portal.md`  
**SRS:** [CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md) §4.1–4.2  
**IA:** [PRODUCT_IA.md](../../PRODUCT_IA.md)

---

## 1. Purpose

Office creates projects, enables modules, seeds directory/vendors/packages. Home is the project landing hub.

---

## 2. Master tools (office)

| Tool | Requirement | Fields / notes |
|------|-------------|----------------|
| Projects | Create / edit | name, code, client card, location, packages |
| Packages | Civil / PEB / work categories | Enable cost/progress filters |
| Module toggles | On/off per project | Drawings, Quality, Safety, Progress, Field, Comms, Cost, Finance, Reports, … |
| PMC roster | People from HRMS | Assign → Directory |
| Directory | 4 party tools | Office · Site · Client · Contractor |
| Vendors | Company assign | See Vendor model |
| Docs | Master / project links | DMS entry |
| Matrix seed | Meeting + request parties | Communication Matrix |
| Audit trail | Who / when / what | Export per module |
| Roles / Access | Permission matrix | `/roles` |
| **Global masters** | Reusable templates | `/master` → Global masters: checklists, custom sheet registers, links to cost MB/BBS |

Also linked: **CRM**, **HRMS**, **Sheet Maker** (upload Excel registers reusable across projects), **Site Audit**, **KPI** (office apps).

---

## 2b. Global masters tab

| Link | Purpose |
|------|---------|
| Global checklist master | Drawing check · Site · Quality · Safety templates |
| Sheet item templates (`/custom-sheets`) | Upload MB/BBS/monitoring Excel once — clone to new projects |
| GFC register | Per-project drawing types |
| Cost / MB / BBS | Budget sheet packages from `SPDC_Budget_Arvind 49.xls` |
| DMS | ISO folder tree · SharePoint sync |

---

## 3. Home tools (project)

| Tool | Purpose |
|------|---------|
| Overview | Ops signals, open requests, alerts |
| Directory | Live roster by party type |
| Vendors | Assigned vendors |
| Documents (DMS) | Project folders (mock → SharePoint) |

---

## 4. Project create fields (baseline)

| Field | Required | Notes |
|-------|----------|-------|
| name / code | Y | |
| clientContactName, email, phone | N | From CRM convert |
| address, GST | N | |
| designConsultant, contractor | N | |
| location / site details | N | |
| packages[] | N | |
| enabledModules[] | Y | |

---

## 5. Rules

1. Project-scoped data isolation.  
2. Module hub: `/projects/:id/hub/{module}`.  
3. UI: hub → sub-tool chips → Actions (no left rail).  
4. Directory fed by HRMS assign + vendor assign.

---

## 6. Review checklist

- [ ] Confirm default enabled modules for new projects  
- [ ] Confirm package taxonomy (Civil / PEB / …)  
- [ ] Confirm audit export format  
