# Module 00 — Home, Directory & Vendors

**Test order:** #1 (before any field module)  
**Roles:** Office creates; Site/Client view assigned parties

---

## Page: Project home

| | |
|--|--|
| **Route** | `/projects/:id` |
| **Purpose** | Project desk — KPIs and module shortcut cards (role-filtered). |
| **Tool nav** | Hidden on home (use sidebar or module hubs). |

### Forms
None.

### Modals
None.

### Key actions
- Open module hubs (Drawings, Quality, …)
- Links to DPR/WPR maker

### Changes during testing
| Date | Raised by | Change requested | Decision | Status |
|------|-----------|------------------|----------|--------|
| | | | | Open |

### Client sign-off
- [ ] Page approved for UAT

---

## Page: Company vendor directory (global)

| | |
|--|--|
| **Route** | `/master/vendors` |
| **Purpose** | **Company-level** vendor/contractor/client/consultant records (Procore-style). Created once; assigned per project. |
| **Roles** | `admin`, `office` |

### Vendor type (`partyType`)
| Value | Use for |
|-------|---------|
| Contractor | Main / sub contractors |
| Vendor | Suppliers, specialists |
| Client | Owner / client org (company row) |
| Consultant | Design / PMC consultants |
| PMC | Sharnam / PMC entity rows if needed |

### Form: Add / edit company
| Field | Required | Notes |
|-------|----------|-------|
| name | Y | Company legal / trading name |
| partyType | Y | See table above |
| trade | | Primary trade / discipline |
| primaryContactName | | |
| businessPhone | | |
| email | | |
| website | | |
| address | | Street address |
| city | | |
| state | | |
| country | | Default India |
| gstNumber | | GSTIN |
| licenseNumber | | Contractor license |
| isPrequalified | | Checkbox |
| insuranceVerified | | Checkbox |
| isUnionMember | | Optional flag |
| isMinorityOwned | | Optional flag |
| isWomenOwned | | Optional flag |
| notes | | Free text |

**API:** `POST /api/vendors` · `PATCH /api/vendors/:id` · `GET /api/vendors?partyType=`

### Modals
None (inline edit panel).

### Key actions
- Filter by vendor type
- Edit existing company
- Deactivate (set `isActive` false via PATCH)

### Changes during testing
| Date | Raised by | Change requested | Decision | Status |
|------|-----------|------------------|----------|--------|
| | | Add/remove vendor fields | | Open |
| | | Vendor type list | | Open |

### Client sign-off
- [ ] Page approved for UAT

---

## Page: Project directory (four user kinds)

| | |
|--|--|
| **Route** | `/projects/:id/directory?party=PMC\|Site\|Client\|Contractor` |
| **Purpose** | Assign **people** (logins) and **parties** to project by Office / Site / Client / Contractor tabs. |
| **Tool nav** | Project home → Directory · Office / Site / Client / Contractor |

### Form: Add party to project
| Field | API |
|-------|-----|
| partyType | `POST /api/vendors` |
| name | |
| trade | |
| primaryContactName | |
| email | |
| businessPhone | |
| → then | `POST /api/vendors/project/:id/assign` |

### Form: Assign login user
| Field | API |
|-------|-----|
| userId | `POST /api/projects/:id/members` |
| role | member / project_manager / site_engineer / viewer |

### Form: Link existing company
| Field | API |
|-------|-----|
| vendorId | `POST /api/vendors/project/:id/assign` |
| trade | trade on this project |

### Modals
None.

### Changes during testing
| Date | Raised by | Change requested | Decision | Status |
|------|-----------|------------------|----------|--------|
| | | Align party tabs with org chart | | Open |
| | | Extra fields on add party | | Open |

### Client sign-off
- [ ] Page approved for UAT

---

## Page: Project vendors (assign from company directory)

| | |
|--|--|
| **Route** | `/projects/:id/vendors` |
| **Purpose** | View vendors on project; create company + assign; pick from global directory. |
| **Tool nav** | Project home → Vendors |

### Form: Create & assign
Same fields as global vendor form (subset on project page — link to `/master/vendors` for full profile).

| Field | Notes |
|-------|-------|
| name, trade, contacts, city, state, GST, license | |
| isPrequalified, insuranceVerified | |

**API:** `POST /api/vendors` + `POST /api/vendors/project/:id/assign`

### Modals
None.

### Changes during testing
| Date | Raised by | Change requested | Decision | Status |
|------|-----------|------------------|----------|--------|
| | | Require partyType on project create | | Open |

### Client sign-off
- [ ] Page approved for UAT

---

## Cross-links

- Comms matrix uses directory contacts → [07-comms](./07-comms.md)
- RFIs assign to vendor → [01-drawings](./01-drawings.md) / Quality / Safety RFIs
- Finance PO/COP vendor names → [09-finance](./09-finance.md)
