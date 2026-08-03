# MODULE — Communications

**Prompt:** `module_prompts/communication.md`  
**SRS:** [CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md) §4.8  
**Related:** [MODULE_SHEET_MAKER.md](./MODULE_SHEET_MAKER.md) · [system-design/07-LLD-Microsoft-Graph.md](../system-design/07-LLD-Microsoft-Graph.md)

---

## 1. Purpose

Communication matrix, meetings (Agenda → MoM), Teams links, Ask (Request for Information), email outbox, generated docs to client civil.

---

## 2. Tools

| Tool | Status | Notes |
|------|--------|-------|
| Matrix | Built | Meeting + request parties |
| Meetings | Partial | Create → Agenda → MoM → Follow-up |
| Teams integration | Design | **Teams only** via Graph |
| Sheet Maker bind | Design | Published template on meeting |
| Ask | Built | Request for Information (PMC) |
| Email / Outlook | Partial | Outbox; Graph when live |
| Generated docs → Client | Partial | MoM/agenda PDFs |

---

## 3. Communication matrix fields

| Field | Type | Notes |
|-------|------|-------|
| projectId | link | |
| role / partyType | text | Client / PMC / Consultant / Contractor |
| contactName, email, phone | | |
| meetingRow / rfiRow | bool | Which rows apply |
| org | text | |

---

## 4. Meeting fields

| Field | Type | Required | Notes / review |
|-------|------|----------|----------------|
| title | text | Y | |
| meetingNo | text | N | Auto |
| scheduledStart / end | datetime | Y | |
| location | text | N | Default Teams |
| teamsMeetingUrl / teamsMeetingId | url | N | From Graph |
| sheetTemplateId | link | N | Sheet Maker |
| sheetInstanceId | link | N | Filled sheet |
| agenda | rich text | N | |
| mom | rich text | N | |
| attendees | users/contacts | N | |
| status | enum | Y | Draft / Scheduled / Completed |
| followUps[] | | | action, owner, due, status |

### Meeting item (follow-up)

| Field | Notes |
|-------|-------|
| description | |
| owner | |
| dueDate | |
| status | Open / Closed |

---

## 5. Ask (PMC) — Request for Information

| Field | Notes |
|-------|--------|
| rfiKind | `RequestForInformation` |
| UI label | Request for Information |
| matrix distribution | |
| ball in court | |

Coordination issues may escalate from Drawings into Ask.

---

## 6. Email outbox

| Field | Notes |
|-------|-------|
| to, subject, body | |
| status | Queued / Sent / Failed |
| relatedEntity | Meeting / RFI / Publish |
| Graph send when configured | |

---

## 7. Rules

1. Meetings = **Microsoft Teams only** (no Zoom/Meet as first-class).  
2. Sheet Maker templates optional but preferred for custom meeting sheets.  
3. Generated MoM/agenda visible on **client civil**.  
4. Matrix parties gate RFI respond/close.

---

## 8. Review checklist

- [ ] Confirm default matrix roles for SPDC projects  
- [ ] Confirm MoM PDF auto-publish to Client  
- [ ] Confirm Teams app permission path with client IT  
