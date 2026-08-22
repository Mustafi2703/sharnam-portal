# MODULE — Field (Day log · Photos · Field requests)

**Prompt:** (covered under Field in IA / diary routes; related to DPR)  
**SRS:** [CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md) §4.7

---

## 1. Purpose

Site daily log for manpower, equipment, notes, photos, and field operational requests.  
**Not** HRMS personal diary (employee-owned, separate module).

---

## 2. Tools

| Tool | Status | Notes |
|------|--------|-------|
| Day log | Built | `DailyLog` + manpower / equipment / notes / photos |
| Photos | Built | Project photos |
| Field requests | Built | Operational RFI kinds |

---

## 3. Daily log fields

| Field | Type | Required | Notes / review |
|-------|------|----------|----------------|
| projectId | link | Y | |
| logDate | date | Y | Unique per project day (policy) |
| weather | text | N | |
| createdBy | user | Y | |
| summary | text | N | |

### Manpower line

| Field | Notes |
|-------|-------|
| trade / category | |
| count | |
| contractor / vendor | optional |

### Equipment line

| Field | Notes |
|-------|-------|
| equipment type | |
| count / hours | |

### Note

| Field | Notes |
|-------|-------|
| body | text |
| category | optional |

### Photo

| Field | Notes |
|-------|-------|
| fileUrl | |
| caption | |
| linkedLogId | |

---

## 4. Field request

| Field | Notes |
|-------|--------|
| subject / question | |
| rfiKind | Field / Manual (explicit) |
| status / ballInCourt | |
| linkedDrawingId | optional |

---

## 5. Relation to other modules

| Module | Link |
|--------|------|
| DPR | Manpower, equipment, materials, photos, concerns from day log |
| HRMS Personal Diary | **Separate** — do not merge entities |
| Progress hindrance | May reference same events |

---

## 6. Roles

| Role | Can |
|------|-----|
| Site | Create/edit day log, photos |
| Office | View / edit / generate DPR from log |
| Client | View selected photos/docs if published |
| Contractor | Photos / fills where allowed |

---

## 7. Review checklist

- [ ] Confirm one log per project-day rule  
- [ ] Confirm weather / materials fields needed  
- [ ] Confirm Field request kinds taxonomy  
