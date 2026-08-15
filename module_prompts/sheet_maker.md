# Sheet Maker — build prompt

**SRS:** `docs/CLIENT_REQUIREMENTS.md` §4.16  
**Fields:** `docs/modules/MODULE_SHEET_MAKER.md`  
**LLD:** `docs/system-design/06-LLD-Sheet-Maker.md`

## Tools

Template designer (sections, columns, party blocks) · **Live at `/custom-sheets`** · Upload Excel/CSV with tab picker · Blank sheet · Clone · Formula bar · Export .xlsx · SharePoint backup

## Supported formulas (in-portal + export)

SUM · AVERAGE · MIN · MAX · COUNT · COUNTA · PRODUCT · IF · ROUND · ABS · arithmetic · cell refs (A2, B10)

## Rules

- Primary consumer: Comms meetings (custom meeting sheets)  
- **Global master:** `/custom-sheets` + Master → Global masters — upload MB/BBS/monitoring Excel templates once; reuse on new projects via Cost import  
- Optional later: HR / CRM / Audit registers  
- Does not replace Drawing/QI checklist engine in v1  
- Meetings remain **Teams only** for video links  
