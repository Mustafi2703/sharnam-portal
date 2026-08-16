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

### Changes during testing
| Date | Raised by | Change requested | Decision | Status |
|------|-----------|------------------|----------|--------|
| | | BPCL matrix seed vs live org | | Open |
| | | Outlook integration | | Open |

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

### Changes during testing
| Date | Raised by | Change requested | Decision | Status |
|------|-----------|------------------|----------|--------|
| | | Label: RFI vs RFI | | Open |

---

## Page: Email settings

| | |
|--|--|
| **Route** | `/projects/:id/email` |

notificationEmails, outlookMailbox, send test email.
