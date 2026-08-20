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

**Auto-fill:** `buildDprAutoFill` on new date/discipline — see [DPR_DATA_CONNECTION_MAP.md](../../DPR_DATA_CONNECTION_MAP.md). Quality block pulls SOR, cubes (cast/test date = report day), test agency, NCR/CAR, checklist counts.

**Manual:** Enter **qtyToday** on each progress line before publish.

**API:** `POST /api/dpr-maker/:projectId/save` (draft / publish to SharePoint)

### Meeting changes (log in session → dev builds → re-test)

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |
| 2 | | | | Open | ☐ |
| 3 | | | | Open | ☐ |


### Client sign-off
- [ ] Page approved for UAT

---

## Page: WPR maker

| | |
|--|--|
| **Route** | `/projects/:id/wpr-maker` |

24-section weekly pack with photos and sign-off.

### Meeting changes (log in session → dev builds → re-test)

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |
| 2 | | | | Open | ☐ |
| 3 | | | | Open | ☐ |


---

## Page: DPR / WPR dashboard

| | |
|--|--|
| **Route** | `/projects/:id/reports?kind=dpr\|wpr` |

Live KPIs + ReportExportButtons (Excel/HTML PDF). No forms.

### Modals
None.

### Meeting changes (log in session → dev builds → re-test)

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |
| 2 | | | | Open | ☐ |
| 3 | | | | Open | ☐ |

