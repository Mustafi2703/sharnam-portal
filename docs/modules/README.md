# Module field specs — all modules

Shareable definitions + field tables for **every** portal module. Mark **Keep / Change / Drop** in review, then build from [system-design/](../system-design/) LLDs and `module_prompts/`.

**Parent SRS:** [CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md)  
**IA:** [PRODUCT_IA.md](../../PRODUCT_IA.md)

---

## Index

### Office / cross-cutting

| Doc | Module | Prompt |
|-----|--------|--------|
| [MODULE_MASTER_HOME.md](./MODULE_MASTER_HOME.md) | Master + Home | `Project_Sharnam_portal.md` |
| [MODULE_DIRECTORY_VENDORS.md](./MODULE_DIRECTORY_VENDORS.md) | Directory & Vendors | Master / HRMS / CRM |
| [MODULE_HRMS.md](./MODULE_HRMS.md) | HRMS | `hrms.md` |
| [MODULE_CRM.md](./MODULE_CRM.md) | CRM / Bid | `crms.md` |
| [MODULE_SHEET_MAKER.md](./MODULE_SHEET_MAKER.md) | Sheet Maker | `sheet_maker.md` |
| [MODULE_AUDIT_KPI.md](./MODULE_AUDIT_KPI.md) | Site Audit + KPI/KRA | `audit_kpi.md` |

### Project delivery

| Doc | Module | Prompt |
|-----|--------|--------|
| [MODULE_DRAWINGS.md](./MODULE_DRAWINGS.md) | Drawings / GFC / Information RFI | `Drawings_ChecklistsRFI.md` |
| [MODULE_QUALITY.md](./MODULE_QUALITY.md) | Quality / Inspection | `Quality.md` |
| [MODULE_SAFETY.md](./MODULE_SAFETY.md) | Safety / Inspection | `safety.md` |
| [MODULE_PROGRESS.md](./MODULE_PROGRESS.md) | Progress | `Progress_overview.md` |
| [MODULE_FIELD.md](./MODULE_FIELD.md) | Field day log | (IA Field) |
| [MODULE_COMMUNICATIONS.md](./MODULE_COMMUNICATIONS.md) | Comms / Teams / MoM | `communication.md` |
| [MODULE_COST.md](./MODULE_COST.md) | Cost (engineering) | `Cost_Module.md` |
| [MODULE_FINANCE.md](./MODULE_FINANCE.md) | Finance (commercial) | `fiannce.md` |
| [MODULE_REPORTS.md](./MODULE_REPORTS.md) | DPR / WPR | `dpr_generation.md`, `WPR_generation.md` |
| [MODULE_CLIENT_PORTAL.md](./MODULE_CLIENT_PORTAL.md) | Client civil view | `client_view.md` |

---

## Naming reminder

| Surface | Term |
|---------|------|
| Drawings / PMC Ask | Request for **Information** |
| Quality / Safety | Request for **Inspection** |

---

## How to refine before build

1. Open the module doc for your area.  
2. Mark fields Keep / Change / Drop; fill review checklists.  
3. Sync accepted changes into `CLIENT_REQUIREMENTS.md`.  
4. Implement using matching LLD in `system-design/` + `module_prompts/`.
