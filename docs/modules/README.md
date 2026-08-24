# Module field specs — all modules

Shareable definitions + field tables for **every** portal module. Mark **Keep / Change / Drop** in review, then build from [system-design/](../system-design/) LLDs and `module_prompts/`.

**Parent SRS:** [CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md)  
**IA:** [PRODUCT_IA.md](../../PRODUCT_IA.md)  
**Sheet map:** [SHEET_TO_DASHBOARD.md](../SHEET_TO_DASHBOARD.md)

**Client UAT pack (pages, forms, modals, meeting change log):** [client-testing/README.md](../client-testing/README.md)  
**Code folder layout (API + web):** [MODULE_FOLDER_STRUCTURE.md](../MODULE_FOLDER_STRUCTURE.md)

---

## Rule: sheet → separate hub tool

1. Each Excel / client pack becomes its **own hub card** (not buried inside another tool).  
2. Hub route: `/projects/:id/hub/{module}`.  
3. Deep link: `/projects/:id/{tool}?tab=…` or `?view=…` / `?cf=…`.  
4. Status **Ready** = UI shell reserved; drop the next sheet and wire fields without inventing a new IA.  
5. When sharing new sheets, update this folder + matching `module_prompts/` + hub `MODULE_TOOLS` in the same PR.

---

## Index

### Office / cross-cutting

| Doc | Module | Prompt | Hub readiness |
|-----|--------|--------|---------------|
| [MODULE_MASTER_HOME.md](./MODULE_MASTER_HOME.md) | Master + Home | `Project_Sharnam_portal.md` | Live |
| [MODULE_DIRECTORY_VENDORS.md](./MODULE_DIRECTORY_VENDORS.md) | Directory & Vendors | Master / HRMS / CRM | Live |
| [MODULE_HRMS.md](./MODULE_HRMS.md) | HRMS | `hrms.md` | Live / deepen |
| [MODULE_CRM.md](./MODULE_CRM.md) | CRM / Bid | `crms.md` | Live / deepen |
| [MODULE_SHEET_MAKER.md](./MODULE_SHEET_MAKER.md) | Sheet Maker | `sheet_maker.md` | Ready for templates |
| [MODULE_AUDIT_KPI.md](./MODULE_AUDIT_KPI.md) | Site Audit + KPI/KRA | `audit_kpi.md` | Ready for packs |

### Project delivery

| Doc | Module | Prompt | Hub readiness |
|-----|--------|--------|---------------|
| [MODULE_DRAWINGS.md](./MODULE_DRAWINGS.md) | Drawings / GFC / Information RFI | `Drawings_ChecklistsRFI.md` | Live |
| [MODULE_QUALITY.md](./MODULE_QUALITY.md) | Quality / NCR / Cube / Inspection | `Quality.md` | Live (NCR & Cube split) |
| [MODULE_SAFETY.md](./MODULE_SAFETY.md) | Safety / NCR / Inspection | `safety.md` | Live (NCR split) |
| [MODULE_PROGRESS.md](./MODULE_PROGRESS.md) | Progress + civil Ready tools | `Progress_overview.md` | Live + Ready stubs |
| [MODULE_FIELD.md](./MODULE_FIELD.md) | Field day log | (IA Field) | Live |
| [MODULE_COMMUNICATIONS.md](./MODULE_COMMUNICATIONS.md) | Comms / Teams / MoM | `communication.md` | Live (split tools) |
| [MODULE_COST.md](./MODULE_COST.md) | Cost (engineering) | `Cost_Module.md` | Live (cashflow ×3) |
| [MODULE_FINANCE.md](./MODULE_FINANCE.md) | Finance (commercial) | `fiannce.md` | Shell |
| [MODULE_REPORTS.md](./MODULE_REPORTS.md) | DPR / WPR | `dpr_generation.md`, `WPR_generation.md` | Live (split) |
| [MODULE_CLIENT_PORTAL.md](./MODULE_CLIENT_PORTAL.md) | Client civil view | `client_view.md` | Partial |

---

## Naming reminder

| Surface | Term |
|---------|------|
| Drawings / PMC Ask | Request for **Information** |
| Quality / Safety | Request for **Inspection** |

---

## How to refine before / after a new sheet

1. Open the module doc for your area.  
2. Add a row under **Tools** with Hub route + Status Ready.  
3. Mark fields Keep / Change / Drop; fill review checklists.  
4. Sync accepted changes into `CLIENT_REQUIREMENTS.md` + `module_prompts/`.  
5. Implement using matching LLD in `system-design/` — reuse hub card + register UI patterns.
