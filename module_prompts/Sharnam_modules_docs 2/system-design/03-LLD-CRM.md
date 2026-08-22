# 03 — LLD: CRM / Bid Management

**Version:** 0.1 · 2026-08-03  
**Status:** Partial (leads board, deals, convert → project) · quotation / compare / linked search **Design**  
**UI entry:** `/crm`  
**API prefix:** `/api/crm`

**Reference assets:**
- Quotation format: SPDC PMC Proposal DOCX (e.g. Arvind proposal — confidential commercial template)
- Vendor compare: `Comparative Statement - R2.xlsx` (summary + multi-vendor BOQ rates)
- Bid UX patterns: team-shared bid-management / doc-upload videos (behavioral reference, not vendor lock-in)

---

## 1. Scope

CRM is **pre-project commercial** work for Sharnam office — not project delivery.

| Capability | Status |
|------------|--------|
| Lead pipeline | **Partial** |
| Convert lead → Project + client card | **Partial** |
| Deals | **Partial** |
| Client / org linked search | **Design** |
| Full client info card | **Partial** (on Project) |
| Quotation generator (editable → DOCX/PDF) | **Design** |
| Vendor & contacts for bid | **Partial** (Vendor model exists) |
| Comparative statement (multi-vendor BOQ) | **Design** |
| Bid / tender package docs | **Design** |

---

## 2. Roles

| Role | Access |
|------|--------|
| Office / Admin | Full CRM |
| Other portals | No commercial CRM by default |

---

## 3. Lead management

### 3.1 Stages (keep + extend)

`New → Qualified → Proposal → Negotiation → Converted → Lost`

Optional insert: `BidSubmitted` between Proposal and Negotiation when comparative / tender is active.

### 3.2 Lead fields (**Exists** + extend)

| Field | Status | Notes |
|-------|--------|-------|
| title | Exists | Opportunity name |
| contactName, email, phone | Exists | Primary contact |
| stage, value, ownerId | Exists | |
| projectId | Exists | Set on convert |
| organisationId | **Design** | FK to ClientOrganisation |
| address, city, state | **Design** | |
| gstNumber | **Design** | |
| sector / facilityType | **Design** | e.g. Manufacturing |
| source | **Design** | Referral / Website / … |
| inquiryRef | **Design** | e.g. SPDC/26-27/INQ/78 |
| notes | **Design** | |
| lostReason | **Design** | |

### 3.3 ClientOrganisation (linked search)

| Field | Type |
|-------|------|
| id, legalName, tradeName, gstNumber, pan, address, city, state, website |
| primaryContactName, email, phone |
| designConsultantDefault, notes |

**Linked search UX:** type-ahead on GST / name → reuse organisation; avoid duplicate client cards.

### 3.4 APIs

| Method | Path | Status |
|--------|------|--------|
| GET/POST | `/api/crm/leads` | **Exists** |
| PATCH | `/api/crm/leads/:id` | **Exists** |
| POST | `/api/crm/leads/:id/convert` | **Exists** |
| GET/POST | `/api/crm/organisations` | **Design** |
| GET | `/api/crm/organisations/search?q=` | **Design** |

---

## 4. Quotation generation

### 4.1 Goal

From a lead, generate an **editable** PMC proposal / quotation matching SPDC proposal structure (director letter, TOC, scope stages, commercial annexure), then export DOCX/PDF. Mark outputs **Confidential**.

### 4.2 Quotation entity

| Field | Type | Notes |
|-------|------|-------|
| id | cuid | |
| leadId | cuid | |
| number | string | e.g. SPDC/26-27/INQ/78 |
| revision | string | R0, R1, … |
| status | enum | Draft / InReview / Sent / Accepted / Superseded / Withdrawn |
| preparedFor | string | Client legal name |
| attentionOf | string | |
| projectTitle | string | |
| projectLocation | string | |
| referenceDate | date | |
| preparedByUserId | cuid | |
| approvedByUserId | cuid? | |
| sectionsJson | text | Ordered sections / rich content blocks |
| commercialJson | text | Fee table, manpower, payment terms |
| docxUrl / pdfUrl | string? | Generated files |
| sentAt | datetime? | |

### 4.3 Template

- Master template stored as Sheet Maker / Doc template (`QuotationTemplate`) seeded from SPDC proposal headings.
- Editor: section list + rich text + commercial table; not a free-form blank page only.
- Generate: server fills merge fields → DOCX; optional PDF render.

### 4.4 APIs

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/crm/leads/:id/quotations` | List / create draft |
| GET/PATCH | `/api/crm/quotations/:id` | Edit sections / commercial |
| POST | `/api/crm/quotations/:id/generate` | Build DOCX/PDF |
| POST | `/api/crm/quotations/:id/send` | Email via outbox/Graph |
| POST | `/api/crm/quotations/:id/revise` | Clone as next revision |

---

## 5. Vendors, contacts & comparative statement

### 5.1 Vendor (**Exists**)

Reuse `Vendor` + contacts; link vendors to a **BidPackage** / Comparative for a lead or future project.

### 5.2 BidPackage

| Field | Type |
|-------|------|
| id, leadId, title, status (Open/Evaluation/Awarded/Closed) |
| boqSource (upload Excel / structured) |
| dueDate, notes |

### 5.3 ComparativeStatement (modelled on Comparative Statement R2)

**Summary sheet pattern:** sections with totals per vendor.

| Field | Type |
|-------|------|
| id, bidPackageId, revisionLabel (e.g. R2) |
| vendorColumnsJson | ordered vendorIds |
| status | Draft / Published / Awarded |

#### ComparativeLine

| Field | Type | Notes |
|-------|------|-------|
| comparativeId | | |
| sectionCode | e.g. SECTION A | |
| sectionTitle | EARTH WORK-SOLING | |
| itemCode | A-01 | |
| description | text | |
| qty | float? | |
| unit | string | |
| ratesJson | `{ vendorId: rate, amount? }` | |
| sortOrder | int | |

**Summary:** aggregate section totals and grand total per vendor (computed API).

**Award:** select winning vendor → optional create `ProjectVendor` on convert.

### 5.4 APIs

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/crm/bid-packages` | |
| POST | `/api/crm/bid-packages/:id/import-boq` | Excel import (R2-like) |
| GET/POST | `/api/crm/bid-packages/:id/comparatives` | |
| PATCH | `/api/crm/comparatives/:id/lines` | Bulk rate edit |
| GET | `/api/crm/comparatives/:id/summary` | Section + grand totals |
| POST | `/api/crm/comparatives/:id/award` | Winner |

### 5.5 Doc upload for bid

Upload tender docs, drawings, clarifications into BidPackage folder (DMS-like or Graph). Modal upload UX required.

---

## 6. Convert → Project

**Exists:** `POST /api/crm/leads/:id/convert` creates Project, Deal, members/vendors seeds.

**Extend on convert:**
- Copy organisation → project client card fields  
- Attach accepted quotation PDF to project DMS  
- Create ProjectVendor rows from awarded comparative (if any)  
- Enable default modules per Master package  

Client card fields on Project (already partially present):  
`clientContactName`, email, phone, address, GST, designConsultant, contractor, location.

---

## 7. Deals (**Exists**)

| Field | Notes |
|-------|-------|
| name, stage, value, projectId | Keep; align stage with lead on convert |

---

## 8. UI structure (proposed)

```
/crm
  Pipeline (kanban / list + linked org search)
  Organisations
  Lead detail
    Overview | Quotations | Bid & Compare | Documents | Activity
  Vendors (or deep-link Master vendors)
  Convert wizard (exists — enrich)
```

Quotation editor: left section nav, center editable blocks, right commercial summary + Generate / Send.

Comparative: Excel-like grid — item rows × vendor rate columns; sticky summary bar.

---

## 9. Audit events

`crm.lead.create`, `crm.lead.stage`, `crm.quotation.generate`, `crm.quotation.send`, `crm.comparative.publish`, `crm.comparative.award`, `crm.lead.convert`

---

## 10. Confidentiality

- Quotation downloads: Office role only; watermark “Confidential — Commercial”  
- Comparative rates: Office only  
- Do not expose CRM routes to Client portal  

Next: [04-LLD-Project-Modules.md](./04-LLD-Project-Modules.md).
