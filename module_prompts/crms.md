# CRM (office) — build prompt

**SRS:** `docs/CLIENT_REQUIREMENTS.md` §4.13  
**Fields:** `docs/modules/MODULE_CRM.md`  
**LLD:** `docs/system-design/03-LLD-CRM.md`

## Tools

Pipeline · Organisations (linked search) · Lead detail (Quotations · Bid & Compare · Docs) · Convert wizard

## Rules

- Pre-project commercial only; Office confidential for quotes/comparatives  
- Quotation from SPDC proposal format → editable → DOCX/PDF  
- Comparative multi-vendor BOQ (Comparative Statement R2 pattern)  
- Convert → Project + client card + optional awarded vendors

## Exists today (extend)

Leads, deals, convert → project — `/crm`, `/api/crm`
