# Communications module

**SRS:** `docs/CLIENT_REQUIREMENTS.md` §4.8 · Sheet Maker: `docs/modules/MODULE_SHEET_MAKER.md`

## Tools (separate hub cards)

| Tool | Route | Notes |
|------|-------|-------|
| Communication matrix | `/comms?tab=matrix` | Org roles Client / PMC / Consultant / Contractor — `Communication Matrix_BPCL` |
| Agenda | `/comms?tab=agenda` | Create meeting → generate agenda before MoM |
| MoM | `/comms?tab=mom` | Minutes + action items |
| Follow-up | `/comms?tab=followup` | Open actions from MoM |
| Ask | `/rfis?kind=RequestForInformation` | Request for Information (PMC) |
| Email / Outlook | `/email` | Outbox + Graph when live |

## Rules

- Matrix / Agenda / MoM / Follow-up are **four tools**, not one combined “Meetings” card.
- Meetings remain **Teams only** for video links.
- Sheet Maker binds published custom meeting sheet templates to meetings.
- Generated docs (agenda / MoM) → client civil + PDF view.
- Coordination issues also appear under Drawings.
