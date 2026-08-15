# Quality & Safety checklists — DPR / WPR guide

**For PMC site team + client walkthrough · August 2026**

## What feeds DPR and WPR

| Source | Portal path | DPR (daily) | WPR (weekly) |
|--------|-------------|-------------|--------------|
| **QI checklist fill** | Checklists → Quality inspection | Quality block — checklist count | WPR quality section |
| **Safety checklist fill** | Checklists → Safety | HSE statistics | WPR safety slide |
| **Safety observations / TBT** | Safety module | HSE block (toolbox, near miss, obs) | WPR safety |
| **Quality NCR** | Quality → NCR / CAR | Open NCR count + issues | WPR quality list |
| **CAR** | Same register (`CAR-` number) | Corrective actions in issues | WPR quality |
| **Cube register** | Quality → Cube | Cubes cast today | WPR quality |
| **QAP** | Quality → QAP tab | — | WPR QAP sign-off rows |

**Convention:** QAP = planned weekly sign-off. NCR = defect. CAR = corrective action record. Safety observations stay in **Safety**, not Quality NCR.

---

## Daily workflow (site QC / HSE)

### Morning

1. **Safety** → log **Toolbox Talk** (or confirm seeded demo row for the day).
2. **Checklists** → open assigned **Safety** checklist → fill all lines + **3 photos** + signature → Submit.
3. **Quality** → fill **QI checklist** for today’s pour / hold-point (same: photos + signature).

### During day

4. Raise **NCR** or **CAR** if defect found: **Quality → NCR / CAR** tab → *Raise NCR* or *Raise CAR*.
5. Log **Safety observation** or **Near miss**: **Safety** module → *Log record*.
6. Register **cube cast**: **Quality → Cube** (or import from SPDC Cube Register Excel on seed).

### End of day

7. **DPR Maker** → pick date + discipline → auto-fill shows HSE + quality from steps above → enter today’s qty → Publish / download.

### Weekly (office)

8. Update **QAP** sign-off (Contractor / PMC / Client flags).
9. Close NCR/CAR with actual closure date.
10. **WPR Maker** → week ending → Download PPTX (quality + safety sections auto-seed).

---

## Can you create new checklist line items?

**Yes.** Office / site roles:

1. **Quality checklists:** Project → **Checklist master** (`?family=QualityInspection`) → pick template → **Add line item** (description, section, QA instruction, photo required).
2. **Safety checklists:** Same with `?family=Safety`.
3. **Assign to project:** Checklist master → assign template to project (done automatically on `db:seed` for demo).
4. **Fill:** Project → Checklists → open assignment → mobile-friendly fill with photos.

You can also **import CSV** from Checklist master (headers in portal sample download).

---

## Can you create new NCR / CAR rows?

**Yes — two ways:**

| Method | Who | Steps |
|--------|-----|-------|
| **Portal** | Site QC / office | Quality → **NCR / CAR** tab → form → *Raise NCR* or *Raise CAR* |
| **Excel import** | Office on seed refresh | Place `NCR 01 .xlsx` in `Sharnam_modules_docs/` → `npm run db:seed` |

CAR uses the same register with number prefix **`CAR-`**. NCR uses **`NCR-`**.

Office can **close** rows via API (status patch) — UI close button can be added; for demo, seed includes open + closed examples.

---

## Demo seed commands (realistic fills)

After `npm run db:seed`:

```bash
# NCR/CAR, cubes, QAP, toolbox talks, QI + Safety checklist fills
npm run db:seed-quality-safety-demo

# Or full DPR demo day (includes quality/safety seed + 7 disciplines)
DPR_DEMO_DATE=2026-08-14 npm run db:seed-dpr-demo

# Pilot week project
npm run db:seed-pilot-week
```

Demo data includes:

- 3 open NCR/CAR + 2 closed
- Cube cast on demo date
- 7 days toolbox talks (when `weekDays: 7`)
- QAP rows for demo week
- Approved QI checklist + submitted Safety checklist on demo date

---

## Where logs are maintained

| Log | Portal |
|-----|--------|
| Checklist fill history | Project → **Checklist logs** (`/checklist-logs?family=QualityInspection` or `Safety`) |
| Safety register | **Safety** module (filter Open / Closed / type) |
| NCR / CAR | **Quality → NCR / CAR** tab |
| DPR published | **DPR Maker** + files under `07.02_Daily_Site_Records` |
| WPR published | **WPR Maker** + `07.08/.../WPR` |

Branded **HTML export** from checklist fill → Print → PDF for archive.

---

## Verify DPR picked up quality / safety

1. Login `office@sharnam.demo` / `Demo@1234`
2. **SPDC-DEMO-01 → DPR Maker → 2026-08-14 → CIVIL**
3. Check **Quality control** rows: cubes, NCR count, QI/Safety checklist count
4. Check **HSE** block: toolbox talks, observations, safe man-hours
5. **WPR Maker** → same week → quality + safety slides populated

See also [07-Connection-Diagram-Index.md](./07-Connection-Diagram-Index.md) diagram **02-quality-qap-dpr-wpr.png**.
