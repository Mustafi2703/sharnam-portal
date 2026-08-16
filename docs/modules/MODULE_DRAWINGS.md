# MODULE — Drawings (GFC · Register · Checklist · RFI · Coordination)

**Prompt:** `module_prompts/Drawings_ChecklistsRFI.md`  
**SRS:** [CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md) §4.3 · §3B  
**LLD:** [system-design/04-LLD-Project-Modules.md](../system-design/04-LLD-Project-Modules.md)

---

## 1. Purpose

Drawing register (master + site), GFC revision control, pre-upload checklist gate, receive/issue signatures, coordination issues, and **Request for Information** (clarification only).

---

## 2. Tools

| Tool | Status | Behaviour |
|------|--------|-----------|
| GFC register | Built | Log + revisions R0–Rn; upload + site signatures only |
| Master register | Built | Full DCI schedule; filters by package/building/discipline/critical |
| Site register | Built | R0–R6 receive/issue matrix + signature thumbnails |
| Register dashboard | Built | Week KPIs + charts |
| Checklist manager | Built | Drawing Check Master only (module-scoped route) |
| Upload / revision | Built | Modal + Drawing Check overlay; PDF/DWG + **signature pads** |
| File types | Built | PDF, DWG → SharePoint `04_DESIGN…/Drawings/{discipline}/{no}/{rev}/` |
| Branded checklist log | Built | `/drawings/checklist-logs` — DrawingCheck only |
| Coordination | Built | Design issues → escalate to Ask |
| Request checklist fill | Built | Kind `DrawingChecklist` |
| **Ask — Request for Information** | Built | Kind `RequestForInformation` |
| ~~Client register tab~~ | Removed | Columns merged into Master register |

---

## 3. GFC / Drawing fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| discipline | text | Y | Arch / Struct / MEPF / … |
| buildingArea | text | N | |
| tlNo | text | N | |
| dwgNo | text | Y | |
| title | text | Y | |
| revision | text | Y | R0–Rn (dynamic columns) |
| plannedDate / actualDate | date | N | GFC + master sync |
| status | enum | Y | Draft / Published |
| publishedAt | datetime | N | |

### Revision — receive & issue (Site register)

| Field | Notes |
|-------|-------|
| receivedDate | Date of receiving |
| copiesReceived | Total copies |
| issuedToContractorAt / issuedToClientAt | Issue dates |
| contractorSignName / contractorSignUrl | Signature pad → SharePoint |
| clientSignName / clientSignUrl | Signature pad → SharePoint |
| issueRemarks | Remarks |

Visible on: GFC upload **log** (per revision), **Site register** matrix, partial sync to **Master register** (copies, issue date).

---

## 4. Drawing Check Master

Module route: `/projects/:id/drawings/checklist-master` — **DrawingCheck only** (no Quality/Safety/Site tabs).

Global templates: `/master/checklists?family=DrawingCheck`

**Gate:** Server rejects **new** revision number without checklist unlock. Same-revision updates skip gate.

---

## 5. Sheet sources (`DRAWING REGISTER - 01.xlsx`)

| Sheet | Portal |
|-------|--------|
| Master Drawing Register | `register?sheet=master` |
| Site Drawing Register | `register?sheet=site` |
| Dashboard | `register` |
| Drawing Register - Client | **Retired** — use Master (includes Issued to, Copies, Critical) |
| Approval & GFC Drawing Log | `drawings` (GFC register) |

Also: `Drwing check master checklist.xlt.xls` → Drawing Check templates

---

## 6. Rules

1. Latest published revision is working set.  
2. Checklist unlock before **new** revision upload.  
3. Same revision number → upsert row (no duplicate R2).  
4. Signatures stored per revision under SharePoint `…/Signatures/`.  
5. Client role: view published; **no** drawing upload.  
6. Module isolation: Drawings checklist log/master exclude Quality/Safety families.

---

## 7. Review checklist

- [x] Master register columns vs client workbook (41 demo rows)  
- [x] Site register R0–R6 + signatures  
- [x] Signatures on GFC upload + visible on log  
- [ ] Client UAT sign-off on register + signatures  
