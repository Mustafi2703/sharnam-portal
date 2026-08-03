# MODULE — Communications

**Prompt:** `module_prompts/communication.md`  
**SRS:** [CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md) §4.8  
**Hub:** `/projects/:id/hub/comms`  
**Related:** [MODULE_SHEET_MAKER.md](./MODULE_SHEET_MAKER.md)

---

## 1. Purpose

Communication matrix, Agenda → MoM → Follow-up as **separate tools**, Teams links, Ask (Request for Information), email outbox.

---

## 2. Tools (sheet → hub card)

| Tool | Hub / route | Status | Source |
|------|-------------|--------|--------|
| Communication matrix | `/comms?tab=matrix` | Built | Communication Matrix_BPCL |
| Agenda | `/comms?tab=agenda` | Built | Meeting flow |
| MoM | `/comms?tab=mom` | Built | Minutes + actions |
| Follow-up | `/comms?tab=followup` | Built | Open actions |
| Ask (PMC RFI) | `/rfis?kind=RequestForInformation` | Built | Information |
| Email / Outlook | `/email` | Partial | Outbox; Graph when live |

### Awaiting next sheets

| Tool | Status | Notes |
|------|--------|-------|
| Sheet Maker bind | Ready | Published template on meeting — see MODULE_SHEET_MAKER |
| Generated docs → Client PDF | Partial | MoM/agenda packs |

---

## 3–6. Fields

Matrix, Meeting, Ask, Email — unchanged baselines in prompt.

### Meeting flow

Create → Agenda → MoM → Follow-up. Video = **Microsoft Teams only**.

---

## 7. Rules

1. Matrix / Agenda / MoM / Follow-up are **four hub tools**.  
2. Sheet Maker templates optional but preferred for custom meeting sheets.  
3. Generated MoM/agenda visible on **client civil**.  

---

## 8. Review checklist

- [ ] Confirm default matrix roles for SPDC projects  
- [ ] Confirm MoM PDF auto-publish to Client  
- [ ] Confirm Teams app permission path with client IT  
