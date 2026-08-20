# MODULE — Safety

**Prompt:** `module_prompts/safety.md`  
**SRS:** [CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md) §4.5 · §3B  
**Hub:** `/projects/:id/hub/safety`

---

## 1. Purpose

Safety dashboard, **Safety NCR** as its own tool, Excel checklists, and **Request for Inspection**.

---

## 2. Tools (sheet → hub card)

| Tool | Hub / route | Status | Source sheet |
|------|-------------|--------|--------------|
| Safety dashboard | `/safety` | Built | Observations / incidents |
| **Safety NCR** | `/safety?view=ncr` | Built | `Safety NCR.xlsx` |
| Safety checklists | `/checklist-master?family=Safety` | Built | Excel safety templates |
| Safety fill log | `/checklist-logs?family=Safety` | Built | Fill audit · branded SPDC HSE Excel |
| Request for Inspection | `/rfis?kind=SafetyChecklist` | Built | Inspection fill |

### Awaiting next sheets

| Tool | Status | Notes |
|------|--------|-------|
| Extra HSE packs / toolbox libraries | Ready | Upload via Checklist master; promote to hub card if standalone register |

---

## 3. Safety record fields

| Field | Type | Required | Notes / review |
|-------|------|----------|----------------|
| title / description | text | Y | |
| recordType | enum | Y | Observation / Incident / **NCR** / Toolbox / JHA / … |
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

- Safety Dashboard sheet (`HIRA` tab — all risk IDs A1–O5)
- `Safety NCR.xlsx`

---

## 7. Roles

Same pattern as Quality: Office/Site create; Contractor fills assigned; Client per permission.

---

## 8. Review checklist

- [ ] Confirm severity taxonomy  
- [ ] Confirm incident escalation path  
- [ ] Confirm Inspection label in UI  
- [ ] Confirm NCR columns vs latest Safety NCR sheet  
