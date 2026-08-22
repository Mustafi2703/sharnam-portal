# MODULE — CRM / Bid (fields)

**Status:** Refine → then build  
**SRS:** [CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md) §4.13  
**LLD:** [system-design/03-LLD-CRM.md](../system-design/03-LLD-CRM.md)  
**UI:** `/crm` · **API:** `/api/crm`  
**Confidential:** Quotations & comparative rates — Office only

---

## 1. Tools (UI)

| Tool | Purpose |
|------|---------|
| Pipeline | Kanban / list of leads |
| Organisations | Client org master + linked search |
| Lead detail | Overview, Quotations, Bid & Compare, Documents, Activity |
| Vendors | Link to vendor master |
| Convert wizard | Lead → Project |

---

## 2. Client organisation (linked search)

| Field | Type | Required | Notes / review |
|-------|------|----------|----------------|
| legalName | text | Y | Search key |
| tradeName | text | N | |
| gstNumber | text | N | Search key |
| pan | text | N | |
| address / city / state | text | N | |
| website | url | N | |
| primaryContactName | text | N | |
| email | email | N | |
| phone | text | N | |
| designConsultantDefault | text | N | |
| notes | long text | N | |

**UX:** Type-ahead by name or GST → reuse; prevent duplicate orgs.

---

## 3. Lead

| Field | Type | Required | Notes / review |
|-------|------|----------|----------------|
| title | text | Y | Opportunity name |
| organisationId | link | Y | Linked search |
| contactName | text | Y | |
| email | email | N | |
| phone | text | N | |
| stage | enum | Y | New / Qualified / Proposal / BidSubmitted? / Negotiation / Converted / Lost |
| value | money | N | Estimated |
| ownerId | user | N | |
| address / city / state | text | N | Can inherit org |
| gstNumber | text | N | |
| sector / facilityType | text | N | e.g. Manufacturing |
| source | text | N | |
| inquiryRef | text | N | e.g. SPDC/26-27/INQ/78 |
| notes | long text | N | |
| lostReason | text | N | If Lost |
| projectId | link | N | Set on convert |

---

## 4. Quotation (SPDC proposal format)

| Field | Type | Required | Notes / review |
|-------|------|----------|----------------|
| leadId | link | Y | |
| number | text | Y | e.g. SPDC/26-27/INQ/78 |
| revision | text | Y | R0, R1, … |
| status | enum | Y | Draft / InReview / Sent / Accepted / Superseded / Withdrawn |
| preparedFor | text | Y | Client legal name |
| attentionOf | text | N | |
| projectTitle | text | Y | |
| projectLocation | text | N | |
| referenceDate | date | Y | |
| preparedBy | user | Y | |
| approvedBy | user | N | |
| sections | rich blocks | Y | Letter, TOC, scope stages, methodology, … |
| commercial | table/json | Y | Fees, manpower, payment terms |
| docxUrl / pdfUrl | file | N | Generated |
| sentAt | datetime | N | |

**Template source:** SPDC PMC Proposal DOCX (confidential).  
**Actions:** Edit → Generate DOCX/PDF → Send → Revise (new revision).

---

## 5. Bid package & documents

| Field | Type | Notes |
|-------|------|-------|
| leadId | link | |
| title | text | |
| status | enum | Open / Evaluation / Awarded / Closed |
| dueDate | date | |
| notes | text | |
| documents | files | Tender, clarifications — modal upload |

---

## 6. Comparative statement (from Comparative Statement R2)

### Header

| Field | Type | Notes |
|-------|------|-------|
| bidPackageId | link | |
| revisionLabel | text | e.g. R2 |
| vendorColumns | vendors[] ordered | e.g. Vikram, TCC, Mahavir |
| status | enum | Draft / Published / Awarded |

### Line (BOQ row)

| Field | Type | Notes |
|-------|------|-------|
| sectionCode | text | SECTION A |
| sectionTitle | text | EARTH WORK-SOLING |
| itemCode | text | A-01 |
| description | long text | |
| qty | number | |
| unit | text | CUM, SQ.M, … |
| rate per vendor | money | One column per vendor |
| amount per vendor | money | qty × rate (computed) |
| sortOrder | number | |

### Summary (computed)

| Output | Notes |
|--------|-------|
| Section total per vendor | Sum of line amounts |
| Grand total per vendor | Sum of sections |
| Award | Selected vendorId → optional ProjectVendor on convert |

**Import:** Excel BOQ / comparative upload (R2-like sheets).

---

## 7. Deal (existing)

| Field | Notes |
|-------|-------|
| name, stage, value, projectId | Align with lead on convert |

---

## 8. Convert → project (client card)

Copy / set on Project:

| Field | Notes |
|-------|-------|
| clientContactName, email, phone | |
| address, GST | |
| designConsultant, contractor | |
| location | |
| Attach accepted quotation PDF to DMS | |
| Create ProjectVendor from award | if comparative awarded |

---

## 9. Roles

| Role | Access |
|------|--------|
| Office / Admin | Full CRM |
| Other portals | No commercial CRM by default |

---

## 10. Review checklist

- [ ] Confirm lead stages (include BidSubmitted or not)  
- [ ] Confirm quotation section list vs SPDC DOCX  
- [ ] Confirm comparative import columns  
- [ ] Confirm who can approve / send quotations  
- [ ] Confirm convert always creates which default modules  
