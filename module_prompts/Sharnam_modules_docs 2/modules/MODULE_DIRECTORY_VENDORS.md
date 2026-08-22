# MODULE — Directory & Vendors

**Related prompts:** Master / HRMS / CRM  
**SRS:** [CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md) §1 · §4.1–4.2

---

## 1. Purpose

Project roster of four parties and vendor companies assigned to the project. Fed by HRMS assign and vendor master.

---

## 2. Directory party tools

| Party | Who | Typical sources |
|-------|-----|-----------------|
| Office | PMC staff | HRMS employees assigned |
| Site | Site engineers / staff | HRMS / site users |
| Client | Owner contacts | CRM convert / manual |
| Contractor | Main contractor people | Vendor / manual |

### Directory membership fields

| Field | Notes |
|-------|-------|
| projectId, userId | |
| partyType | Office / Site / Client / Contractor |
| role label / designation | |
| email, phone | From User / profile |
| isActive | |

---

## 3. Vendor fields

| Field | Type | Notes / review |
|-------|------|----------------|
| name | text | Y |
| partyType | enum | Contractor / Vendor / Client / Consultant / PMC |
| trade | text | |
| address / city / state / country | | |
| businessPhone / email / website | | |
| primaryContactName | | |
| licenseNumber / gstNumber | | |
| isPrequalified / insuranceVerified | bool | |
| flags | union / minority / women-owned | optional |
| notes | text | |
| isActive | bool | |

### ProjectVendor

| Field | Notes |
|-------|-------|
| projectId, vendorId | |
| assignedAt / by | |
| From CRM comparative award | optional |

---

## 4. Rules

1. Directory drives Comms matrix and meeting invites.  
2. CRM awarded vendors can seed ProjectVendor on convert.  
3. Contractor portal users map to vendor companies where applicable.

---

## 5. Review checklist

- [ ] Confirm party labels vs SPDC org chart  
- [ ] Confirm required vendor prequal flags  
