# Module 05 — Progress

**Test order:** #6  
**Hub:** `/projects/:id/hub/progress`  
**Source workbooks:** `Progress Overview.xlsx` · `Milestone tracking.xlsx` · `Planned Vs. Actual Dashboard.xlsx` · Monthly / Hindrance packs

---

## Tool nav tabs

Overview · Milestones · **Planned vs Actual** · Monthly progress · Hindrance · Risk · Legal approvals · S-curve · MS Project

Query: `?tab=overview|milestones|planned|monthly|hindrance|risk|legal|scurve|msproject`

> **Not Cost.** Cost cashflow is **money by month** (`/cost?tab=cashflow`). This Planned vs Actual tool is **weekly site qty + weekly manpower + RA-month billing** from `Planned Vs. Actual Dashboard.xlsx`.

---

## Page: Overview

| | |
|--|--|
| **Route** | `/projects/:id/progress` |
| **Purpose** | Progress KPIs and charts from Progress Overview pack. |

### Meeting changes

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |

### Client sign-off
- [ ] Page approved for UAT

---

## Page: Milestones

| | |
|--|--|
| **Route** | `/projects/:id/progress?tab=milestones` |
| **Purpose** | Milestone register (baseline / forecast / actual). |

### Form: Milestone
code, category, activity, plannedStart, plannedEnd, plannedDays, actualDays, weightage, pctComplete, status

### Meeting changes

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |

### Client sign-off
- [ ] Page approved for UAT

---

## Page: Planned vs Actual

| | |
|--|--|
| **Route** | `/projects/:id/progress?tab=planned` |
| **Purpose** | Weekly planned vs actual **quantities** (and this-week manpower), plus RA-month billing from the same Excel pack. |
| **Roles** | Office imports / exports. Client reads. Site does not type here today. |

### What the client Excel actually is

Workbook: `seed/data/Planned Vs. Actual Dashboard.xlsx`

| Excel sheet | What it is | Period | In portal today |
|-------------|------------|--------|-----------------|
| **Dashboard** | One-pager (timeline + top shortages + cashflow chart) | Mixed | **Not imported** — charts rebuilt from the three registers |
| **Weekly Manpower** | Required vs available **this week** by trade | **This week snapshot** | Yes — table + shortage chart |
| **Project Cashflow** | RA 01, RA 02… planned vs actual **INR** | **Month / RA bill** | Yes — table + bar chart |
| **Planned Vs Actual** | Activity qty register — title *“Previous Week to Current”* | **This week snapshot** on each activity | Yes — qty table (`Wk plan` / `Wk act`) |
| **As per drawing status** | Weekly executed plan by tower / activity (326 rows) | This week | **Not imported** |

Weekly columns on the qty sheet are **two numbers per activity** (this week’s plan and this week’s actual) — **not** a week-1 / week-2 / week-3 history.

### Features (what this page does today)

| Feature | Notes |
|---------|-------|
| Import Excel | Replaces cashflow + manpower + activity rows for the project |
| Export Excel / PDF | Same three sheets from live data |
| Cashflow table | Month · RA · Planned INR · Actual INR · % |
| Manpower table | Trade · Required · Available · Shortage · % |
| Qty register | Tower · Activity · BOQ · GFC · Executed · Balance · **Wk plan** · **Wk act** · Status |
| DPR link | Matching activity names hint DPR planned/actual qty |
| UI (Aug 2026) | Excel-style **scrollable** tables — cashflow, manpower, activity register (`sheet-register` layout) |
| Import / export | Progress → Planned vs Actual → Import Excel · Export Excel/PDF |

### What is **not** on this page (confirm tomorrow)

| Gap | Why it matters |
|-----|----------------|
| No week picker / week history | Import **overwrites** last week. Cannot open “week of 7 Apr” vs “week of 14 Apr”. |
| No inline edit of Wk plan / Wk act | Office must re-import Excel (or we add a fill form). |
| `%` columns from Excel not shown | Balance vs GFC, % of weekly plan, % of GFC. |
| **As per drawing status** sheet unused | Second weekly plan view (drawing-linked). |
| Dashboard one-pager unused | Client’s cover sheet is not a portal page. |
| Duplicate money view vs Cost | Same “planned vs actual” words as Cost cashflow — different source file. |

### Forms / API

| Action | API |
|--------|-----|
| Import | `POST /api/progress/:id/planned-actual/import` |
| Export xlsx | `GET /api/progress/:id/planned-actual/download.xlsx` |
| Export html/pdf | `GET /api/progress/:id/planned-actual/download.html` |

### Decisions to lock with client (do not pre-fill Meeting changes)

Ask these in order. Recommended default in *italics* if they have no strong view.

1. **Home of this tool** — Progress (qty + labour week) vs Cost (money). *Keep in Progress. Do not move into Cost.*
2. **Cashflow block on this page** — keep RA-month table here, or drop it and send users to Cost → Cash Flow Chart. *Keep, but label “RA billing (from PVA pack)” so it is not confused with Cost cashflow.*
3. **Weekly meaning** — overwrite this week only, **or** store every week (week ending date + history). *If they run a weekly site meeting, they will want history — that is the build.*
4. **Who types weekly actual** — office Excel import, **or** site/office fill in portal each week. *Portal fill + week ending date if they want it live.*
5. **Need “As per drawing status”** as a second tab, or merge into the qty register. *One register unless they still use both sheets.*
6. **S-curve / MS Project** — separate tool (already a Ready tab). *Do not mix with this weekly qty sheet.*

### Meeting changes (log in session → dev builds → re-test)

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |
| 2 | | | | Open | ☐ |
| 3 | | | | Open | ☐ |

### Client sign-off
- [ ] Page approved for UAT

---

## Page: Monthly / Hindrance / Risk / Legal

| | |
|--|--|
| **Route** | `/projects/:id/progress?tab=monthly\|hindrance\|risk\|legal` |

### Forms
- **Hindrance:** description, location, activity, category, type, occurredAt, daysImpacted, delayType, accountable, status
- **Risk:** code, name, category, opportunityThreat, probability, consequence, costImpact, description, status
- **Legal:** approvalId, category, authority, description, packageName, status, responsible

### Meeting changes

| # | Raised by | Change / issue | Priority | Dev status | Re-test |
|---|-----------|----------------|----------|------------|---------|
| 1 | | | P1 / P2 / P3 | Open | ☐ |

### Client sign-off
- [ ] Pages approved for UAT
