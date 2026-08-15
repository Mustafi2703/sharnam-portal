# PMC end-of-day fill guide

**What the site team and PMC office must enter each day** so DPR / WPR stay complete.

---

## Every working day (site engineer)

| # | Task | Module | Manual? |
|---|------|--------|---------|
| 1 | Enter **today's quantity** on BOQ lines worked | DPR Maker → qty today | **Yes** |
| 2 | Weather, shift, prepared by | DPR Maker → header | **Yes** |
| 3 | Manpower actual vs planned | DPR Maker (auto from Progress if register updated) | Review |
| 4 | Material consumed today | DPR Maker → materials | **Yes** if not from BBS |
| 5 | Safety toolbox / observations | Safety module **or** DPR HSE block | **Yes** |
| 6 | Cube sets cast today | Quality → Cube register | **Yes** |
| 7 | New NCR or safety issue | Quality / Safety | **Yes** if occurred |
| 8 | Site photos + **3 signatures** | DPR Maker → Evidence | **Yes** |
| 9 | Save → Publish DPR (each discipline worked) | DPR Maker | **Yes** |

**Auto-filled (do not re-type):** BOQ scope, cumulative from MB, rebar kg from BBS, planned hints from Planned vs Actual, open hindrances, open RFIs, prior DPR cumulatives.

---

## When BOQ / MB / BBS change (weekly or after measurement)

| Task | Module |
|------|--------|
| Upload structure BOQ | Cost → BOQ tab |
| Edit GFC / achieved on monitoring | Cost → Monitoring |
| Update MB dimensions / qty | Cost → MB |
| Update BBS bar marks + shape diagrams | Cost → BBS |
| Run **Sync from sheets** | Cost → Sync (MB qty → monitoring achieved) |

---

## Planned vs Actual (weekly — planning engineer)

| Sheet in Excel | Portal action |
|----------------|---------------|
| Activity quantity register | Progress → Planned vs Actual → **Import Excel** or edit in UI |
| Weekly manpower | Same import |
| Project cashflow | Same import |

DPR uses this for **planned qty remarks** on matching BOQ descriptions.

---

## PMC office (daily close)

| # | Task |
|---|------|
| 1 | Review all disciplines **Published** for today's date |
| 2 | Download **XLSX** (client SPDC template) + **PDF** (Print from HTML) |
| 3 | Confirm signatures uploaded (Site Engineer, PMC Manager, Contractor) |
| 4 | Close or assign open NCR / hindrance rows |

---

## Friday / week end (PMC office)

| # | Task |
|---|------|
| 1 | Open **WPR Maker** → week ending date |
| 2 | Review 24 auto-seeded sections |
| 3 | **Download PPTX** (matches `WPR_50` section list) + XLSX |
| 4 | Publish to SharePoint |

---

## Pilot demo project

After deploy, run on server (once):

```bash
npm run db:seed
npm run db:seed-pilot-week
```

Project **SPDC-PILOT-02** — 7 days DPR + WPR PPTX · logins in `02-Logins-and-Access.md`.

Or in UI: **DPR Maker → Prepare demo day (all 7)** on **SPDC-DEMO-01**.
