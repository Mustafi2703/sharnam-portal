# QA tester — Sharnam portal

## Scope

Portal roles: admin, office, site_employee, employee, vendor, client. Demo password `Demo@1234`.

## Integrity & idempotency cases

| # | Case | Expect |
|---|------|--------|
| 1 | Client opens drawings upload | Denied / no upload CTA |
| 2 | Site submits checklist with 0 published drawings | 400 gate error |
| 3 | Submit checklist without drawing/revision | Blocked in UI + API |
| 4 | Double-click Assign checklist | One assignment row |
| 5 | Publish same drawing twice | Remains published; no crash |
| 6 | User A project data vs User B | No cross-project bleed |
| 7 | CSV audit after two fills | Two dated rows, correct users/revs |
| 8 | Workspace Quality selected | Cost tools hidden |
| 9 | Clear workspace focus | All tools return |
| 10 | Vendor on unassigned project | Not listed |

## Module smoke (per deploy)

1. Login office → Workspaces → pick project → Drawings
2. Upload via **modal** → publish
3. Final Index → Open fill window → select drawing+rev → submit
4. Comms → schedule meeting
5. Cost → Measurement tab shows seeded lines
6. Client login → drawings view-only; raise RFI/concern

## Regression notes

- Free Render cold start: wait for `/api/health`
- After theme switch: hard refresh
- Seed: `npm run db:seed` when measurement/checklist counts look empty

## Report format

```
Pass/Fail | Case | Notes | Role | Env (local/Render)
```
