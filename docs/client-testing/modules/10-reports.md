# Module 10 — Reports

**Test order:** #10  
**Hub:** `/projects/:id/hub/reports`

---

## Tool nav tabs

DPR maker · WPR maker · DPR dashboard · WPR dashboard

---

## Page: DPR maker

| | |
|--|--|
| **Route** | `/projects/:id/dpr-maker` |

Multi-section SPDC INPUT editor (header, qty, manpower, equipment, materials, quality, HSE, delays, drawings/RFI, issues, highlights, next-day plan, evidence, signatures).

**API:** `POST /api/dpr-maker/:projectId/save` (draft / publish to SharePoint)

### Changes during testing
| Date | Raised by | Change requested | Decision | Status |
|------|-----------|------------------|----------|--------|
| | | Section list vs client DPR template | | Open |

### Client sign-off
- [ ] Page approved for UAT

---

## Page: WPR maker

| | |
|--|--|
| **Route** | `/projects/:id/wpr-maker` |

24-section weekly pack with photos and sign-off.

### Changes during testing
| Date | Raised by | Change requested | Decision | Status |
|------|-----------|------------------|----------|--------|
| | | | | Open |

---

## Page: DPR / WPR dashboard

| | |
|--|--|
| **Route** | `/projects/:id/reports?kind=dpr\|wpr` |

Live KPIs + ReportExportButtons (Excel/HTML PDF). No forms.

### Modals
None.

### Changes during testing
| Date | Raised by | Change requested | Decision | Status |
|------|-----------|------------------|----------|--------|
| | | | | Open |
