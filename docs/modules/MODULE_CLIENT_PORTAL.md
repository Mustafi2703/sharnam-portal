# MODULE — Client portal (civil view)

**Prompt:** `module_prompts/client_view.md`  
**SRS:** [CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md) §1 · §3A

---

## 1. Purpose

Client stakeholders see civil/project progress and documents; raise concerns; do **not** upload drawings or edit Cost/Finance numbers (unless Office grants a specific permission).

---

## 2. What Client can see / do

| Area | Access |
|------|--------|
| Progress | S-curve, summary schedule, MS Project progress, procurement (read) |
| Drawings | **Published** drawings only (view) |
| Meetings / MoM | Generated docs on civil side |
| Reports | DPR / WPR packs (view / PDF) |
| DMS | Shared / published folders |
| Quality / Safety | Checklist create where enabled; view QI/Safety summaries |
| Concerns | Raise as ClientConcern / RFI |
| Cost / Finance | No edit; optional read-only summary (TBD) |

---

## 3. Explicit denials

| Action | Allowed? |
|--------|----------|
| Drawing upload / revision | **No** |
| Edit Cost quantities / rates | **No** |
| Edit Finance commercial numbers | **No** (unless permission) |
| See CRM quotations / comparatives | **No** |
| See HRMS KYC / payslips | **No** |

---

## 4. Concern (Client RFI) fields

| Field | Type | Notes |
|-------|------|-------|
| subject | text | |
| question / description | text | |
| rfiKind | `ClientConcern` | |
| status / ballInCourt | | |
| linkedDrawingId | optional | |
| attachments | files | |

---

## 5. Civil desk artifacts (minimum PDFs)

1. Project summary schedule PDF  
2. Procurement plan PDF  
3. Generated civil / meeting document PDF  

All **viewable in-app**.

---

## 6. Review checklist

- [ ] Confirm which Progress tabs are Client-visible  
- [ ] Confirm Concern SLA  
- [ ] Confirm Client home widgets beyond ops dashboard (future)  
