# MODULE — Safety

**Prompt:** `module_prompts/safety.md`  
**SRS:** [CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md) §4.5 · §3B

---

## 1. Purpose

Safety observations/incidents, Safety NCR-style register, checklists (Excel), and **Request for Inspection**.

---

## 2. Tools

| Tool | Status | Notes |
|------|--------|-------|
| Safety dashboard | Built | Open items, observations, incidents |
| Safety NCR / records | Built | From Safety NCR sheet |
| Checklist master | Built | Upload Excel; choose template |
| Site instructions | Built | Checklist-backed |
| **Request for Inspection** | Built (label) | Kind `SafetyChecklist` |

---

## 3. Safety record fields

| Field | Type | Required | Notes / review |
|-------|------|----------|----------------|
| title / description | text | Y | |
| recordType | enum | Y | Observation / Incident / NCR / … |
| severity | enum | N | |
| location | text | N | |
| status | enum | Y | Open / Closed / … |
| linkedDrawingId | link | N | |
| reportedBy / at | | Y | |
| correctiveAction | text | N | |
| closedAt | datetime | N | |
| photos | files | N | |

---

## 4. Safety checklist

| Field | Notes |
|-------|-------|
| family | Safety |
| template from Excel | |
| assignment / fill | Same pattern as Quality |
| photos | Per item policy |

---

## 5. Request for Inspection (Safety)

| Field | Notes |
|-------|--------|
| rfiKind | `SafetyChecklist` |
| UI label | **Request for Inspection** |
| linked checklist assignment | |
| notify matrix / vendor | |

**Not** labeled Request for Information.

---

## 6. Sheet sources

- Safety Dashboard sheet  
- `Safety NCR.xlsx`

---

## 7. Roles

Same pattern as Quality: Office/Site create; Contractor fills assigned; Client per permission.

---

## 8. Review checklist

- [ ] Confirm severity taxonomy  
- [ ] Confirm incident escalation path  
- [ ] Confirm Inspection label in UI  
