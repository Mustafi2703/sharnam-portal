# Sharnam Portal — Client Requirements (shareable)

**Product:** Sharnam PMC Portal (शरणम्)  
**Live demo:** https://sharnam-portal.onrender.com  
**Audience:** Sharnam office, site, client, contractor  
**UI:** Modern Signal — Blue · Red · Yellow · White · Black  

This document is the **requirements baseline** for module finalization. Snag list, project closure, and extra client-facing packs will be scoped in biweekly meetings (see sprint plan).

---

## 1. Users (four kinds)

| User | Who | Primary use |
|------|-----|-------------|
| **Sharnam Office** | PMC / admin / office | Master setup, modules on/off, directory, RFIs, Comms, Cost, Reports |
| **Site** | Site engineer / site staff | Day log, photos, checklist fills, QI/Safety, Field RFIs |
| **Client** | Owner / client stakeholder | View published drawings, raise concerns, read DPR/WPR |
| **Contractor** | Main contractor / vendor | Fill assigned checklists / RFIs, photos, bills where allowed |

Directory Master lists these four as **tools** (Office · Site · Client · Contractor) and assigns them onto each project.

---

## 2. Login experience (required)

1. Sign in (module or role login).  
2. **Ops dashboard** — open RFIs, open issues / alerts, recent diary signals, Quick links to Quality / Safety **Request for Information**.  
3. **Module selection** — enter only enabled modules for that project.  
4. Inside a module: **Hub → sub-tools → page Actions** (no left tools rail).

---

## 3. Module requirements

### 3.1 Master (office)

| Tool | Requirement |
|------|-------------|
| Projects | Create / edit project, packages, enable/disable modules |
| Directory | Four party tools: Office, Site, Client, Contractor |
| PMC roster | Master people pool → assign into project |
| CRM | Leads → project / client card |
| HRM | Employees & vendors → directory |
| Docs | Master / project document links |
| Matrix seed | Meeting + RFI communication matrix |

### 3.2 Home (project)

Overview, Directory (4 types), Vendors, Documents (DMS).

### 3.3 Drawings

| Tool | Requirement |
|------|-------------|
| GFC register | Drawing log R0–R5, publish, view |
| **Checklist manager** | Create / edit Drawing Check Master templates & items |
| Upload flow | **Opens a separate window** for checklist fill (same family as QI/Safety fill UX). After complete → unlock → upload sheet / revision |
| Documents (DMS) | Folders under Drawings |
| Coordination | Design issues → escalate to Ask |
| Request checklist fill | Matrix / contractor fill RFI |
| Ask (drawing RFI) | Clarification only (information) |
| Submittals | **Out of scope for now** |

### 3.4 Quality

QI dashboard (Procore-style), Checklist master, Site checklists, Request QI fill. Checklist + RFI always visible.

### 3.5 Safety

Safety dashboard, Safety checklists, Safety RFI. Checklist + RFI always visible.

### 3.6 Progress

Separate tools: Overview, Milestones, Planned vs Actual, Monthly, Hindrance, Risk, Legal.

### 3.7 Field

Day log, Photos, Field RFIs.

### 3.8 Comms

Matrix → Meeting → Agenda → MoM → Follow-up; Ask (PMC RFI); Email / Outlook.

### 3.9 Cost

Monitoring, MB, BBS, Budget, Cashflow, Rates, COP/Bills, Structure upload.

### 3.10 Reports

DPR / WPR packs from live registers.

### 3.11 Later (discussed, not built yet)

| Module / pack | Status |
|---------------|--------|
| **Snag list** | Tab / module to be designed in biweekly finalization |
| **Project closure** | Client-facing closure pack — to be scoped |
| Extra client dashboards | To be discussed |

---

## 4. Cross-cutting rules

1. **Project isolation** — all data scoped to one project; pilot uses **client’s real data** on one project only.  
2. **Drawing Check Master** must be completed before upload / revision.  
3. **RFI notifications** — create / respond → project email outbox (+ Outlook when Graph is live).  
4. **Client** cannot upload drawings or edit cost.  
5. **Microsoft 365** — OneDrive + Outlook connection tested per `docs/M365_SETUP.md` and sprint test checklist.

---

## 5. Acceptance (module finalization)

A module is “final” when:

- Tools match this doc + `module_prompts/`  
- Biweekly review sign-off recorded  
- Pilot project flow verified with real data  
- Open critical bugs = 0 for that module  

**UAT** starts only after **one month** of build + pilot (see sprint plan).
