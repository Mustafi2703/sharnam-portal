# Sharnam Portal — System Design Pack (HLD & LLD)

**Product:** Sharnam PMC Portal (शरणम्)  
**Audience:** Product, engineering, client stakeholders  
**Status:** Design pack for review and further build  
**Stack:** Vite React + Express + Prisma · Microsoft Graph (SharePoint / Outlook / Teams)

This folder is the **single design pack** for architecture and every discussed module. Implementation should follow these docs after team sign-off.

---

## How to use

1. Start with [00-HLD.md](./00-HLD.md) for system shape and module map.
2. Read [01-LLD-Architecture.md](./01-LLD-Architecture.md) before any API or schema work.
3. Open the domain LLD for the module you are building.
4. Use [08-Data-Model.md](./08-Data-Model.md) + [09-Flows.md](./09-Flows.md) for entities and sequences.
5. Fold accepted deltas into [`../CLIENT_REQUIREMENTS.md`](../CLIENT_REQUIREMENTS.md) using [10-Client-SRS-Delta.md](./10-Client-SRS-Delta.md).

**Do not** treat this pack as live client SRS until `10-Client-SRS-Delta.md` is merged and signed off.

---

## Document index

| # | Document | Purpose |
|---|----------|---------|
| 00 | [00-HLD.md](./00-HLD.md) | High-level design: actors, context, modules, phases |
| 01 | [01-LLD-Architecture.md](./01-LLD-Architecture.md) | Stack, auth, tenancy, integrity, Graph boundary |
| 02 | [02-LLD-HRMS.md](./02-LLD-HRMS.md) | Full HRMS: recruit → onboard → attendance → payroll v1 → KPI |
| 03 | [03-LLD-CRM.md](./03-LLD-CRM.md) | Leads, quotation, vendor compare, bid → project |
| 04 | [04-LLD-Project-Modules.md](./04-LLD-Project-Modules.md) | Drawings, Quality, Safety, Progress, Field, Comms, Cost, Finance, Reports, DMS |
| 05 | [05-LLD-Audit-KPI.md](./05-LLD-Audit-KPI.md) | Site Audit pack + Master KPI / KRA |
| 06 | [06-LLD-Sheet-Maker.md](./06-LLD-Sheet-Maker.md) | Custom sheet / register template builder |
| 07 | [07-LLD-Microsoft-Graph.md](./07-LLD-Microsoft-Graph.md) | Entra app registration, SharePoint, Outlook, Teams |
| 08 | [08-Data-Model.md](./08-Data-Model.md) | Existing + proposed Prisma entities |
| 09 | [09-Flows.md](./09-Flows.md) | End-to-end mermaid flows |
| 10 | [10-Client-SRS-Delta.md](./10-Client-SRS-Delta.md) | Delta bullets to merge into client requirements |

---

## Status legend (used in all docs)

| Label | Meaning |
|-------|---------|
| **Exists** | Schema + API + UI present in monorepo (may be MVP) |
| **Partial** | Shell or subset only |
| **Design** | Specified here; not built yet |
| **Build next** | Priority after this pack is approved |

---

## Locked product defaults (this pack)

| Decision | Choice |
|----------|--------|
| Delivery order | Docs first → phased build |
| Payroll v1 | Compensation master + payslip PDF (no full statutory calc engine) |
| Meetings | Microsoft Teams only (Graph calendar + online meetings) |
| Drawings Ask | **Request for Information** |
| Quality / Safety Ask | **Request for Inspection** |
| UI direction | Locked product chrome (navy / amber Workday-style; Graphite Procore tokens per skill) |
| Data isolation | Every project row filtered by `projectId` / membership |

---

## Related repo docs

- [`../CLIENT_REQUIREMENTS.md`](../CLIENT_REQUIREMENTS.md) — live shareable SRS baseline  
- [`../../PRODUCT_IA.md`](../../PRODUCT_IA.md) — locked information architecture  
- [`../M365_SETUP.md`](../M365_SETUP.md) — Entra / Graph setup clicks  
- [`../ROADMAP_DISCUSS_LATER.md`](../ROADMAP_DISCUSS_LATER.md) — prior “discuss later” tracker  
- Source packs: `MASTER_KPI_DASHBOARD.xlsx`, `SITE_AUDIT_Pack.xlsx`

---

## Change control

| Version | Date | Notes |
|---------|------|-------|
| 0.1 | 2026-08-03 | Initial HLD/LLD pack from team discussion + existing portal |
