# 06 — LLD: Custom Sheet Maker

**Version:** 0.1 · 2026-08-03  
**Status:** **Design** (required in CLIENT_REQUIREMENTS for meeting sheets; expand to reusable registers)  
**Consumers:** Comms meetings, HRMS custom registers, CRM bid forms (optional), Quality checklist-like sheets (optional)

---

## 1. Purpose

Allow Office users to **design reusable sheet templates** (columns, sections, party blocks) instead of a single fixed form — then fill instances in meetings and other modules. Import/export Excel for familiarity.

This is the product answer to “custom meeting sheet maker” and a general **register template builder**.

---

## 2. Concepts

| Concept | Meaning |
|---------|---------|
| **SheetTemplate** | Definition: layout schema + metadata |
| **SheetInstance** | Filled sheet bound to a context (meetingId, projectId, …) |
| **Section** | Titled block (header, attendees, agenda rows, action table) |
| **Column** | Field definition inside a tabular section |
| **Party block** | Named party slots aligned to Communication Matrix roles |

---

## 3. Data model

### SheetTemplate

| Field | Type | Notes |
|-------|------|-------|
| id | cuid | |
| name | string | |
| code | string | Unique |
| category | enum | Meeting / HR / CRM / Audit / Custom |
| scope | enum | Global / Project |
| projectId | string? | If project-scoped clone |
| schemaJson | text | Sections + columns AST |
| version | int | Increment on publish |
| status | enum | Draft / Published / Archived |
| createdById | userId | |
| updatedAt | datetime | |

### schemaJson shape (sketch)

```json
{
  "sections": [
    {
      "id": "hdr",
      "type": "header",
      "title": "Meeting Sheet",
      "fields": [
        { "key": "meetingNo", "label": "No", "type": "text" },
        { "key": "date", "label": "Date", "type": "date" }
      ]
    },
    {
      "id": "parties",
      "type": "partyBlock",
      "parties": ["PMC", "Client", "Contractor", "Consultant"]
    },
    {
      "id": "actions",
      "type": "table",
      "columns": [
        { "key": "item", "label": "Item", "type": "text", "width": 40 },
        { "key": "owner", "label": "Owner", "type": "user", "width": 20 },
        { "key": "due", "label": "Due", "type": "date", "width": 15 },
        { "key": "status", "label": "Status", "type": "select", "options": ["Open", "Closed"] }
      ]
    }
  ]
}
```

### Supported field types

`text`, `textarea`, `number`, `date`, `select`, `user`, `party`, `checkbox`, `file`, `signature` (simple name/date)

### SheetInstance

| Field | Type | Notes |
|-------|------|-------|
| id | cuid | |
| templateId | cuid | |
| templateVersion | int | Frozen at create |
| projectId | string? | |
| contextType | enum | Meeting / Standalone / Bid / HR |
| contextId | string? | e.g. meetingId |
| dataJson | text | Values matching schema |
| status | enum | Draft / Final / Locked |
| pdfUrl / xlsxUrl | string? | Export |

---

## 4. APIs

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/sheet-templates` | List / create |
| GET/PATCH | `/api/sheet-templates/:id` | Edit schema |
| POST | `/api/sheet-templates/:id/publish` | Version++ |
| POST | `/api/sheet-templates/:id/clone` | Project clone |
| POST | `/api/sheet-templates/import-excel` | Infer columns from Excel header row |
| GET | `/api/sheet-templates/:id/export-excel` | Blank template download |
| GET/POST | `/api/sheet-instances` | Create fill from template |
| PATCH | `/api/sheet-instances/:id` | Save dataJson |
| POST | `/api/sheet-instances/:id/export` | PDF / XLSX |

---

## 5. Integration points

| Module | Integration |
|--------|-------------|
| Comms → Meeting | `Meeting.sheetTemplateId` + instance on schedule; Agenda/MoM can map from table sections |
| HRMS | Custom HR registers (training attendance sheet, induction form) |
| CRM | Optional bid clarification sheet |
| Site Audit | Could host DC_INTERVIEW / SITE_WALK as templates seeded from pack |
| Checklist module | Remains specialized; Sheet Maker does **not** replace Drawing/QI checklist engine in v1 |

---

## 6. UI

```
/sheet-maker (Office) or Master → Sheet Maker
  Templates list
  Template designer
    Left: section list
    Center: canvas
    Right: field inspector
  Preview + Export blank Excel
```

Instance fill: used inside Meeting detail and standalone “Fill sheet” pages — scrollable panels, save draft, lock final.

Upload of filled Excel → map columns back to instance (**Build next** after designer MVP).

---

## 7. Permissions

| Action | Role |
|--------|------|
| Create / publish global templates | Admin / Office |
| Clone to project | Office |
| Fill instance | Matrix parties / Office / Site per context |
| Lock final | Meeting owner / Office |

---

## 8. Audit events

`sheet_template.publish`, `sheet_instance.create`, `sheet_instance.lock`, `sheet_template.import`

Next: [07-LLD-Microsoft-Graph.md](./07-LLD-Microsoft-Graph.md).
