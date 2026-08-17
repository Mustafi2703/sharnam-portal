# Module 07 — Comms

**Test order:** #8  
**Hub:** `/projects/:id/hub/comms`

---

## Tool nav tabs

Communication matrix · Agenda · MoM · Follow-up · Comm log · Ask (PMC RFI) · Email / Outlook

Query: `?tab=matrix|agenda|mom|followup|log`

---

## Page: Comms / meetings

| | |
|--|--|
| **Route** | `/projects/:id/comms?tab=` |

### Form: Communication contact
orgSection, orgName, personName, designation, company, spoc, mobile, email, mailRole, officeAddress, matrixKind

### Form: Matrix routing row
communicationType, fromRole, toRole, frequency, channel

### Form: Schedule meeting
title, meetingDate, location → status Agenda

### Form: Meeting line item
description, category (Agenda / MoM / Follow-up)

### Form: Comm log entry
subject, body, toRoles, channel

### Modals
None (WorkflowStrip shows Matrix → Agenda → MoM → Follow-up).

### Meeting changes (log in session → dev builds → re-test)

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |
| 2 | | | | Open | ☐ |
| 3 | | | | Open | ☐ |


### Client sign-off
- [ ] Page approved for UAT

---

## Page: Ask RFI

| | |
|--|--|
| **Route** | `/projects/:id/rfis?kind=RequestForInformation` |

### Form: Create RFI
subject, question, rfiKind, linkedDrawingId, responsibleVendorId, assignedToId, attachmentNote, scheduleImpact, costImpact

### Form: Respond / close
responseText · status Closed

### Meeting changes (log in session → dev builds → re-test)

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |
| 2 | | | | Open | ☐ |
| 3 | | | | Open | ☐ |


---

## Page: Email settings

| | |
|--|--|
| **Route** | `/projects/:id/email` |

notificationEmails, outlookMailbox, send test email.
