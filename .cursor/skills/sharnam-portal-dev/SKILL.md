---
name: sharnam-portal-dev
description: >-
  Develops the Sharnam PMC / construction management portal with backend,
  senior frontend, and QA roles. Enforces project-scoped data integrity,
  idempotent APIs, Procore-parity module setups, upload modals, and UI theme
  selection. Use when building features, reviewing integrity, integrating
  Procore-like modules, choosing UI directions, or when the user mentions
  Sharnam portal, GFC, checklists, cashflow, workspaces, or construction ERP.
---

# Sharnam Portal Development

Multi-role skill for the **शरणम्** PMC portal (Vite React + Express + Prisma).

## When this skill applies

- Implementing or refactoring any portal module
- Upload / drawing / checklist / cost / RFI / diary / meetings work
- Data integrity, idempotency, or multi-tenant project scoping
- Procore-parity UX (tools, modals, registers)
- Picking or applying one of the **5 UI directions**

## Role routing

| Ask / task type | Read first | Act as |
|-----------------|------------|--------|
| API, Prisma, seed, auth, CSV, email outbox | [backend.md](backend.md) | Backend developer |
| UI, modals, workspaces, theme, forms | [frontend.md](frontend.md) | Senior frontend |
| Test plans, gates, regressions, smoke | [qa.md](qa.md) | QA tester |
| Module parity, Procore setups | [procore-parity.md](procore-parity.md) | Product/architect |
| Visual system / color options | [ui-directions.md](ui-directions.md) | Design lead |

For cross-cutting features, run **Backend → Frontend → QA** in that order.

## Non-negotiables (all roles)

1. **Project scope**: every query filters by `projectId` (or membership). Never leak cross-project rows.
2. **Idempotency**: upserts / unique keys for assign, publish, submit where retries happen; no duplicate revisions on double-click.
3. **Drawing gate**: checklist submit + QI create require ≥1 published drawing with file.
4. **Client role**: view / raise concerns only — no drawing upload.
5. **Audit**: who / when / which drawing / which revision on fills and uploads.
6. **Upload UX**: open a dedicated **modal** (not bare file input alone) for Procore-like uploads.
7. **UI**: apply the **selected** direction from [ui-directions.md](ui-directions.md); do not invent a 6th palette unless asked.

## Module map (integrate these)

Drawings/GFC · Final Index checklists · Quality Inspections · QAP · Safety · RFIs · Day log · Photos · Meetings/Comms matrix · Design coordination · Submittals · DMS · Cost (measurement/cashflow/budget) · Reports/DPR · Email settings · Directory/Vendors · CRM/HRM (office)

## Workflow for a feature

```
1. Confirm workspace + roles affected
2. Backend: schema + routes + idempotent write path + audit
3. Frontend: modal/form + project-scoped lists + scrollable panels
4. QA: happy path + gate locked + double-submit + client denied
5. Seed/demo data if needed; build api + web
```

## Pending system design

When the user sends a full system-design prompt, append decisions to `procore-parity.md` and do not contradict project-scoped integrity rules above.
