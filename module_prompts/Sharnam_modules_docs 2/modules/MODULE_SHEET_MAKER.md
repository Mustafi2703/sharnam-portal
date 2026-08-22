# MODULE — Sheet Maker (fields)

**Status:** Refine → then build  
**SRS:** [CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md) §4.16  
**LLD:** [system-design/06-LLD-Sheet-Maker.md](../system-design/06-LLD-Sheet-Maker.md)  
**Consumers:** Comms meetings (primary), optional HR / CRM / Audit registers

---

## 1. Purpose

Office designs **reusable sheet templates** (not one fixed form): sections, columns, party blocks → fill instances in meetings and export Excel/PDF.

---

## 2. Template fields

| Field | Type | Required | Notes / review |
|-------|------|----------|----------------|
| name | text | Y | |
| code | text | Y | Unique |
| category | enum | Y | Meeting / HR / CRM / Audit / Custom |
| scope | enum | Y | Global / Project |
| projectId | link | N | If project clone |
| schema | json | Y | Sections + columns |
| version | number | Y | +1 on publish |
| status | enum | Y | Draft / Published / Archived |
| createdBy | user | Y | |

---

## 3. Schema building blocks

### Section types

| Type | Purpose |
|------|---------|
| header | Title fields (meeting no, date, project) |
| partyBlock | PMC / Client / Contractor / Consultant slots |
| table | Tabular rows (agenda, actions, attendees) |
| richText | Free notes block |
| signature | Name / date sign-off |

### Column / field types

`text`, `textarea`, `number`, `date`, `select`, `user`, `party`, `checkbox`, `file`, `signature`

### Example table columns (meeting actions)

| key | label | type |
|-----|-------|------|
| item | Item | text |
| owner | Owner | user |
| due | Due | date |
| status | Status | select Open/Closed |

---

## 4. Instance (filled sheet)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| templateId | link | Y | |
| templateVersion | number | Y | Frozen |
| projectId | link | N | |
| contextType | enum | Y | Meeting / Standalone / Bid / HR |
| contextId | link | N | e.g. meetingId |
| data | json | Y | Values |
| status | enum | Y | Draft / Final / Locked |
| pdfUrl / xlsxUrl | file | N | Export |

---

## 5. Meeting integration

| Meeting field | Notes |
|---------------|-------|
| sheetTemplateId | Published template |
| sheetInstanceId | Created on schedule |
| teamsMeetingUrl | Graph Teams link |
| agenda / MoM | May map from sheet table sections |

---

## 6. Import / export

| Action | Behaviour |
|--------|-----------|
| Import Excel | Infer columns from header row → draft template |
| Export blank | Download empty template XLSX |
| Export filled | Instance → XLSX / PDF |

---

## 7. Roles

| Action | Role |
|--------|------|
| Create / publish global templates | Admin / Office |
| Clone to project | Office |
| Fill instance | Matrix parties / Office / Site per context |
| Lock final | Meeting owner / Office |

---

## 8. Review checklist

- [ ] Confirm default meeting sheet sections for SPDC  
- [ ] Confirm party list matches Communication Matrix roles  
- [ ] Confirm whether HR/Audit templates are v1 or later  
- [ ] Confirm Excel import expectations  
