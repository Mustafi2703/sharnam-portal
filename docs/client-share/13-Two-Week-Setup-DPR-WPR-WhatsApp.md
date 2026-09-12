# Sharnam Portal — two-week setup & first real reports

**Prepared for:** SPDC / Sharnam PMC (office, site, IT)  
**Portal:** https://portal.spdc.in  
**Companion (WhatsApp detail):** [WHATSAPP_OWNER_CLIENT_UPDATES.md](./WHATSAPP_OWNER_CLIENT_UPDATES.md)  
**Companion (module UAT):** [SPDC_TWO_WEEK_UAT_PLAN.md](./SPDC_TWO_WEEK_UAT_PLAN.md) — use that for feature pass/fail. **This document is the live sit-with-them plan.**

| Field | Fill in before kick-off |
|-------|-------------------------|
| **Live project name / code** | |
| **Kick-off date (Day 1)** | Monday ____ / ____ / 2026 |
| **Week-1 Friday (first clean DPR review)** | |
| **Week-2 Friday (first proper WPR)** | |
| **Sharnam PMO lead** | |
| **Site engineer lead** | |
| **Client PM (read-only)** | |
| **Sharnam portal buddy (our team)** | |

**Suggested window if you start next working day after 13 Sep 2026:**  
**Week 1 — Mon 15 Sep – Fri 19 Sep** · **Week 2 — Mon 22 Sep – Fri 26 Sep**  
Shift the dates if kick-off moves. Do **not** skip the Friday WPR in Week 2.

---

## Why this exists

The portal can already make DPR and WPR files. Those files are only **proper** when your live project is loaded and the site team fills the same registers every day.

For **two weeks** we sit with your office and site on **one named project**. We set people and packages correctly, load the sheets the reports read, publish a DPR every working day, and close Week 2 with a WPR the client can accept.

**In the same two weeks** (not after), IT starts WhatsApp Business approval. Meta can take a few days. If you start Day 1, owner/client alerts can switch on as soon as the first WPR is trusted — you do not wait another fortnight.

This is **not** “test every module.” It is **get this project ready so reports are real.**

---

## What “done” means after two weeks

Tick all of these before you call the cycle complete.

| # | Exit criterion | Pass |
|---|----------------|:----:|
| 1 | One **live** project is open (not only the demo). Directory has real office, site, client, consultant, and contractor people. | ☐ |
| 2 | Work packages exist. Client, consultant, and contractor companies are assigned, with packages pinned where needed. | ☐ |
| 3 | Required sheets are in the portal (BOQ + Planned vs Actual as minimum). Drawings published if QI / drawing-check will be used. | ☐ |
| 4 | Site publishes **≥1 DPR per working day** from Day 3 through Week 2 Friday (discipline that actually worked). | ☐ |
| 5 | Each published DPR has **today’s qty**, weather, photos, and **three signatures** (site / PMC / contractor). | ☐ |
| 6 | Quality and safety for those days are in the **registers** (not only typed into the DPR): TBT or safety fill, QI when there is a hold point, cubes/NCR if they happened. | ☐ |
| 7 | Office reviews and downloads XLSX + PDF for each published day. Files visible under project DMS / ISO daily records. | ☐ |
| 8 | **Week 2 Friday:** WPR Maker run for that week. 24 sections reviewed. PPTX + XLSX downloaded and shared with client. | ☐ |
| 9 | Client login can **read** published DPR/WPR and progress — cannot upload drawings or edit cost. | ☐ |
| 10 | WhatsApp track: dedicated SIM + MSG91 started **in Week 1**. Test send (API or wa.me) recorded. Switch-on decision written for after WPR sign-off. | ☐ |

Until 4–8 are true, keep using this plan. Do not declare “reports are live” from demo seed data.

---

## How we work together (rules for the two weeks)

| Rule | Meaning |
|------|---------|
| **One project** | All sitting, fills, and reports are on the named live project. Demo (`SPDC-DEMO-01`) is only for “show me how.” |
| **Portal is master** | After a register is imported, **stop** parallel Excel DPRs for that project. Edit in the portal or re-import — not both without a sync. |
| **Sit, don’t lecture** | Each session: we do the click path once, then **your** person repeats it on their login. |
| **Log, don’t freeze** | P2/P3 issues go in §12. Daily DPR still publishes unless something is a stop (login down, cannot save, wrong project data leak). |
| **Vendor ≠ clock-in** | Contractors fill checklists, RFIs, and project data. They do **not** punch attendance. |
| **Client = view / concerns** | Client does not upload drawings and does not edit Cost. |
| **WhatsApp is parallel** | IT owns MSG91/Meta. PMO does not wait for WhatsApp to start daily DPRs. |

**Default first password** for new portal users (change after first login): `Demo@1234`.

**Live URL:** https://portal.spdc.in — this is **not** `app.spdc.in`.

---

## 1. People you must name before Day 1

Create **real** accounts in **Master → Directory** (or project setup). Do not run two weeks only on `@sharnam.demo` if the client will later rely on these reports.

| Seat | Name | Mobile | Email | Portal login | Role in portal |
|------|------|--------|-------|--------------|----------------|
| Office / PMC lead | | | | `/login/office` | office |
| Planning / QS (BOQ, PvA) | | | | `/login/office` | office |
| Site engineer | | | | `/login/site` | site |
| Site QC | | | | `/login/site` | site |
| HSE | | | | `/login/site` | site |
| Client PM | | | | `/login/client` | client |
| Client director (WhatsApp later) | | | | optional | — |
| Consultant (architect / designer / PMC partner) | | | | office or stakeholder as you assign | consultant company on setup |
| Contractor (same type as vendor) | | | | `/login/vendor` | vendor |
| SPDC IT (WhatsApp + SharePoint) | | | | office | — |
| Our portal buddy | | | | — | on call / on site |

**Access check (Day 1, 20 minutes):** every named person logs in once, lands on the **correct project**, and can see their desk. If someone sees another project’s registers, stop and call us — that is a P1.

| Who | Must be able to | Must **not** |
|-----|-----------------|--------------|
| Office | Setup, Cost, DPR/WPR publish, DMS, approve file-access requests | — |
| Site | Field, checklists, safety, DPR draft/publish | Edit another project |
| Client | Read published drawings, progress, reports; raise concern / RFI | Upload drawings; edit Cost |
| Vendor / contractor | Assigned project fills, bid desk if used, **Request access** on DMS files | Clock in; browse every project |
| Consultant | Assigned packages + coordination as you grant | Client-only folders they were not given |

---

## 2. Files to collect **before** we sit (send in one folder)

Print this and tick. Missing files delay a proper DPR more than missing a “nice” module.

### Must have (reports stay thin without these)

| # | What | Typical Excel / file | Who brings it | In portal | Done |
|---|------|----------------------|---------------|-----------|:----:|
| 1 | BOQ / monitoring per structure | Project BOQ / budget monitoring | QS / planning | **Cost → BOQ** | ☐ |
| 2 | Planned vs Actual | `Planned Vs. Actual Dashboard` | Planning | **Progress → Planned vs Actual → Import** | ☐ |
| 3 | Live site photos for the days you will report | Phone / WhatsApp album is fine | Site | DPR evidence + Field photos | ☐ |

### Strongly recommended (first WPR looks empty without them)

| # | What | Typical file | In portal | Done |
|---|------|--------------|-----------|:----:|
| 4 | MB (measurement book) | MB tabs from budget workbook | **Cost → MB** (or pick global master, then edit qty) | ☐ |
| 5 | BBS + shape codes | BBS tabs | **Cost → BBS** | ☐ |
| 6 | Programme | MS Project **XML** export (or Excel fallback) | **Progress → MS Project → Import XML** | ☐ |
| 7 | Milestone list | `Milestone tracking` | **Progress → Milestones** | ☐ |
| 8 | Hindrance register | `HInderance Register Dashboard` | **Progress → Hindrance** | ☐ |
| 9 | QAP week | `Quality Assurance Plan Week 50` (or your current week) | **Quality → QAP** | ☐ |
| 10 | Cube register | SPDC cube register | **Quality → Cube Test** | ☐ |
| 11 | Open NCR / CAR | `NCR 01` or your list | **Quality → NCR / CAR** | ☐ |
| 12 | Safety dashboard / TBT habit | Safety dashboard + NCR | **Safety** | ☐ |
| 13 | Current GFC set | PDF / DWG | **Drawings** — upload in the **modal**, then publish | ☐ |

### Optional in these two weeks (do not block DPR)

Comms matrix, design coordination, full Finance RA/COP, CRM bid (bids are **optional** — you can add contractors on project setup without opening a bid), HRMS, closure/snag.

**Global once (office, if not already on the server):** MB/BBS masters and checklist masters under **Master → Global masters**. See [11-Global-Masters-vs-Project-Seed.md](./11-Global-Masters-vs-Project-Seed.md).

---

## 3. Project setup we do together (Day 1–2)

Do this on the **live** project. Path: project → **Setup** (`/projects/{id}/setup`) or CRM project setup if the job is still in CRM.

### 3.1 Create or open the project

1. Office: **Master → Projects** — create if needed (code, name, client name on the card).  
2. Open **Setup**.  
3. Confirm SharePoint / ISO tree exists (DMS root opens). If folders are empty, stay on the project — first register dump and first publish fill them.

### 3.2 Packages

On Setup, use **Package manager**:

- Add packages this job actually has (usually Civil, Electrical, Plumbing, Fire, HVAC, PEB, interiors — only what is real).  
- Delete packages that are not on this site (delete **from this project**; catalogue × is org-wide — ask before that).

DPR Maker is **per discipline**. If the package is missing, that day’s discipline report has nowhere clean to sit.

### 3.3 Three party desks (not only “vendors”)

On the same Setup page, fill **all three**:

| Desk | Who | What to pin |
|------|-----|-------------|
| **Client** | Owner company on this job | Packages they must see |
| **Consultant** | Designer / architect / PMC partner | Their packages |
| **Contractor** | Vendor and contractor are **one company type** | Trades / packages they execute |

Assign companies from the directory. Tap packages on each assigned company. Save.  
You do **not** need a bid to add a contractor.

### 3.4 People on the job

Directory: office, site, client, contractor logins attached to **this** project.  
Client and vendor only browse **their** assigned project. They **request access** to open a DMS file; office approves and copies the portal link (`/dms/open/…`). Office can also use **Share link** on a file.

### 3.5 Drawings (needed before QI / drawing-check)

1. Drawings → upload via the **upload modal** (not a bare file box).  
2. Complete drawing-check if your process requires it.  
3. **Publish** at least one sheet with a file.  

Checklist submit and Quality Inspection **will block** if there is no published drawing. Client never uploads.

### 3.6 Load the two report engines

| Order | Module | Action | Why |
|-------|--------|--------|-----|
| 1 | Cost → BOQ | Upload / enter per structure | DPR quantity rows |
| 2 | Progress → Planned vs Actual | Import Excel | Planned hints + WPR progress |
| 3 | Cost → MB / BBS | Pick master or import | Cumulative qty / rebar |
| 4 | Progress → MS Project / milestones / hindrance | Import or type | S-curve + WPR slides |
| 5 | Quality + Safety | QAP, cubes, NCR, TBT, assign QI/Safety checklists | Auto-fill on DPR / WPR |
| 6 | DPR Maker | Pick **today**, discipline, review auto-fill, enter **qty today**, publish | First real daily |

**Site still types every day:** today’s quantity, weather, photos, signatures. The portal does not invent site progress.

---

## 4. Two-week calendar

**Morning stand-up (15 min, same time every day):** what was published yesterday, who fills today, one blocker.  
**Afternoon sit (45–90 min, Week 1):** we are on the call or at the desk while they click.  
**Week 2:** we stay on the daily close; they drive.

WhatsApp column is **IT + one PMO** — it does not replace the site column.

### Week 1 — set up the job and publish the first real DPRs

| Day | Sit-with-them (office + site) | Outcome by EOD | WhatsApp (parallel) |
|-----|-------------------------------|----------------|---------------------|
| **Day 1 · Mon** | Accounts + access check. Open live project. Packages. Client / consultant / contractor desks. Directory. | Everyone logged in on the **right** project. Setup saved. | Pick **one dedicated SIM** (not a personal WhatsApp). Decide owner + client mobiles. |
| **Day 2 · Tue** | Import BOQ + Planned vs Actual. Start MB/BBS. Upload/publish drawings if QI will run. Assign QI + Safety checklists. | Cost + Progress have real rows. Drawing gate ready. | MSG91 account + Titan plan. GST/docs for Meta Business Manager. |
| **Day 3 · Wed** | **First live DPR.** Morning TBT + one safety or QI fill. DPR Maker: date + discipline, auto-fill, qty today, photos, 3 signs, **Publish**. Office downloads XLSX + PDF. | **DPR-01** exists for a real working day. | Submit Utility template `sharnam_portal_update`. Start business verification. |
| **Day 4 · Thu** | Repeat daily rhythm (see §5). Add cubes/NCR only if they happened. Second discipline only if that trade worked. | **DPR-02**. Issues logged in §12. | Wallet top-up. Share *draft* auth key process with portal host (credentials later, secure channel). |
| **Day 5 · Fri** | Third DPR. Office reviews Mon–Fri pack (or Wed–Fri if Day 3 was first publish). Fix any empty auto-fill (usually missing PvA / BOQ match / safety not logged). | **DPR-03** + written list of what still blocks a full WPR. | Template status checked. If still pending, keep **wa.me** fallback. |

**Week 1 exit:** at least **three published DPRs** on the live project, setup desks complete, required sheets loaded, WhatsApp SIM + MSG91 started.

### Week 2 — every working day, then one proper WPR

| Day | Sit-with-them | Outcome by EOD | WhatsApp (parallel) |
|-----|---------------|----------------|---------------------|
| **Day 6 · Mon** | Daily rhythm without us driving. We watch the first 20 minutes, then they finish. | **DPR-04**. Site can publish without a screenshare. | If template **Approved**, send credentials to host. |
| **Day 7 · Tue** | Daily rhythm. Planning updates PvA / hindrance if the week changed. | **DPR-05**. Registers match the site. | Host sets server keys + restart. **Send test WhatsApp** on Comms. |
| **Day 8 · Wed** | Daily rhythm. Client login: open published DPR / progress (read-only). | **DPR-06**. Client confirms they can see, not edit. | Live test: raise a **test** meeting or RFI → WhatsApp received (or wa.me recorded). |
| **Day 9 · Thu** | Daily rhythm. Office pre-checks WPR Maker (week ending tomorrow or this Friday). Fill any empty WPR section from the register — do not type fiction into the pack. | **DPR-07**. WPR preview opened; gaps listed. | Confirm recipient list (owner first, then client). Tick **WhatsApp enabled** only when test passed. |
| **Day 10 · Fri** | Publish today’s DPR. **WPR Maker → week ending → review 24 sections → Download PPTX + XLSX → publish / share with client.** Sign §13. | **First proper WPR** + week of DPRs. Go/no-go for WhatsApp auto-send. | Decision: **API live** / **wa.me until Meta done** / **wait until next week**. |

**Week 2 exit:** daily DPRs for the week + **one client-shareable WPR** + WhatsApp decision written.

If a working day is a holiday, skip that DPR and note it. Do not “back-fill” a fake full week.

---

## 5. Daily operating rhythm (from Day 3)

Give this page to the **site engineer**. Office uses the close-out table.

### Morning (site) — 20–30 min

| # | Task | Where |
|---|------|--------|
| 1 | Site login. Confirm **this** project. | `/login/site` |
| 2 | Toolbox talk or confirm TBT for today. | **Safety** |
| 3 | Fill assigned **Safety** checklist if scheduled (photos + sign). | Checklists → Safety |
| 4 | Fill **QI** if there is a hold point today (needs a **published** drawing). | Checklists → Quality |
| 5 | Contractors fill **their** assigned checklists / RFIs. No clock-in. | Vendor login |

### During the day

| # | Task | Where |
|---|------|--------|
| 6 | Cube cast / test if it happened — **test agency** on the row. | Quality → Cube |
| 7 | Raise NCR / CAR or safety observation only if real. | Quality / Safety |
| 8 | Photos of work done today. | Field photos and/or DPR evidence |

### End of day (site) — 30–45 min

| # | Task | Where |
|---|------|--------|
| 9 | **DPR Maker** → today’s date → each **discipline that worked**. | Reports → DPR Maker |
| 10 | Check auto-fill (BOQ lines, HSE, quality, open RFI/hindrance). Do not re-type those. | Same |
| 11 | Enter **qty today**, weather, materials if needed, next-day plan. | Same |
| 12 | Attach photos. Three signatures. **Save draft** then **Publish**. | Same |

### Office close (same evening or next morning 09:00)

| # | Task |
|---|------|
| 1 | Every worked discipline shows **Published** for that date. |
| 2 | Download **XLSX** (SPDC template) + **HTML/PDF**. |
| 3 | Confirm files in DMS under daily site records / discipline folder. |
| 4 | Approve any vendor/client **Request access** so they can open the published pack via portal link. |
| 5 | Assign or close new NCR / hindrance — do not leave them only in the DPR narrative. |

### Friday extra (office)

WPR Maker → that week ending → review → PPTX + XLSX → share with client.  
Update QAP sign-off for the week if you use QAP.

Step-by-step field card: [06-PMC-End-of-Day-Fill-Guide.md](./06-PMC-End-of-Day-Fill-Guide.md).  
What feeds which report: [08-Quality-Safety-DPR-WPR-Guide.md](./08-Quality-Safety-DPR-WPR-Guide.md).

---

## 6. What a **proper** DPR looks like (pass / fail)

Use this when you review Day 3 and every Friday.

| Check | Fail if… | Pass |
|-------|----------|:----:|
| Correct **project** and **date** | Demo project or wrong day | ☐ |
| Discipline matches work done | Empty Civil published because “we needed a file” | ☐ |
| Qty today on lines that moved | All zeros while photos show work | ☐ |
| Auto-fill HSE / quality matches registers | Safety done on paper only | ☐ |
| Photos + 3 signatures | Missing PMC or contractor sign | ☐ |
| Published (not draft-only) | File never left the maker | ☐ |
| Office can download and client can **view** | Only office has the XLSX in email | ☐ |

**Seven disciplines** exist (Civil, Structural, Electrical, Plumbing, Fire, Mechanical, PEB, etc. as on your packages). Publish **only** those that worked that day. Do not force all seven on Day 3.

---

## 7. What a **proper** WPR looks like (Week 2 Friday)

| Check | Fail if… | Pass |
|-------|----------|:----:|
| Week ending matches the days you actually published DPRs | WPR for a week with no DPRs | ☐ |
| Progress / PvA / milestones / hindrance reviewed | Sections still say demo or blank because nothing was imported | ☐ |
| Quality + safety sections match the week’s registers | Invented NCR counts | ☐ |
| Photos from **this** week | Last month’s album | ☐ |
| PPTX + XLSX downloaded and given to client | “We’ll export later” | ☐ |
| Client can open the pack (portal and/or shared file) | Only PMC mailbox has it | ☐ |

WPR **reads** the same registers as DPR. If a section is empty, fix the **register** (Progress, Quality, Safety, Cost), then regenerate — do not decorate the PPTX as the master.

---

## 8. WhatsApp — get ready in these two weeks (do not wait)

Full cost, templates, and MSG91 email: [WHATSAPP_OWNER_CLIENT_UPDATES.md](./WHATSAPP_OWNER_CLIENT_UPDATES.md).

**Decision already made for Sharnam:** owner + **client** numbers only. **No** vendor broadcast. Utility messages only (RFI, meeting, NCR/CAR). Daily WhatsApp digest is **later** (after API is proven).

| When | Who | Action | Done |
|------|-----|--------|:----:|
| Day 1 | Ops | Dedicated SIM chosen; **not** used on normal WhatsApp app | ☐ |
| Day 1 | PMO | List 2–5 mobiles: PMC owner first, then client | ☐ |
| Day 1 | PMO | Tell those people they will get **project alerts** (consent) | ☐ |
| Day 2 | Finance / IT | MSG91 + Titan WhatsApp + wallet ~₹500–1,000 | ☐ |
| Day 2–3 | IT | Meta Business Manager + GST verification | ☐ |
| Day 3 | IT | Utility template `sharnam_portal_update` submitted | ☐ |
| Day 3–10 | Meta | Template **Approved** (often hours; verification can be 1–3 days) | ☐ |
| When approved | IT → us | Auth key + sender + template name on a **secure** channel | ☐ |
| Same day | Us | Server env + API restart (~15 min) | ☐ |
| Next session | PMO | Project → **Comms → Email & WhatsApp** → numbers → enable → **Send test** | ☐ |
| After first WPR | PMO + client | Switch-on: auto API **or** keep wa.me | ☐ |

**Until API is live:** staff use **Open WhatsApp** (wa.me) from the portal. Reports do not depend on this.

**Do not** put WhatsApp on vendors’ phones as a blast list. If a contractor needs a file, they use **Request access** on DMS.

**After Week 2 (optional):** daily morning summary on WhatsApp (Option B in the WhatsApp note) — only if owners still want it after API alerts work.

---

## 9. Who does what (keep this on the wall)

| Work | Site | Office / PMC | Vendor | Client | Our buddy | IT |
|------|:----:|:------------:|:------:|:------:|:---------:|:--:|
| Daily TBT / checklist / photos | ● | ○ | ● fills assigned | — | ○ Week 1 | — |
| Qty today + publish DPR | ● | ○ review | Sign as contractor | View | ○ Week 1 | — |
| BOQ / PvA / programme | ○ | ● | — | View | ○ Day 2 | — |
| Approve DMS access links | — | ● | Request | Request | ○ | ○ SharePoint |
| First WPR | ○ | ● | — | Accept / comment | ● Day 10 | — |
| MSG91 / Meta | — | ○ numbers | — | Opt-in | ○ env | ● |
| New feature requests | — | Log §12 | — | Log §12 | Prioritise | — |

● does it · ○ helps / reviews

---

## 10. What we are **not** finishing in these two weeks

Say this out loud on Day 1 so the two weeks stay on reports.

- Every module in the big UAT scenario bank  
- Perfect Finance RA/COP on this job (unless you already have POs)  
- Bid management (optional; setup does not need a bid)  
- WhatsApp daily digest and marketing templates  
- Native mobile app  
- Back-filling months of old DPRs (optional later; do not block Week 2 WPR)

Those stay on the existing UAT / delivery docs. This cycle is **setup + daily truth + one honest WPR + WhatsApp plumbing**.

---

## 11. Demo vs live (so nobody is confused)

| | Demo | These two weeks |
|--|------|-----------------|
| Project | `SPDC-DEMO-01` / UAT live seed | **Your** named site |
| Login | `office@sharnam.demo` etc. / `Demo@1234` | Real people + same first password, then change |
| DPR | “Prepare demo day” / seeded 2026-08-14 | **Today’s** date, real qty |
| WPR | Seeded week | Week ending **this** Friday in Week 2 |
| WhatsApp | wa.me / test numbers | Owner + client only, after MSG91 |

Use demo for “show the button.” Publish reports on the live project.

---

## 12. Issue log (fill during the two weeks)

| Date | Raised by | Role | What happened (project + screen) | P1 / P2 / P3 | Owner | Status |
|------|-----------|------|----------------------------------|--------------|-------|--------|
| | | | | | | Open |
| | | | | | | |
| | | | | | | |

**P1 stop:** cannot log in, cannot save/publish, data from another project, client can edit cost or upload drawings.  
**P2:** report missing a section because a register was not loaded — fix the register the same day if it blocks Friday WPR.  
**P3:** wording, extra columns, nice-to-have.

---

## 13. Sign-off (Week 2 Friday)

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Sharnam PMO / project lead | | | |
| Site engineer lead | | | |
| Client representative (reports readable) | | | |
| SPDC IT (WhatsApp + SharePoint) | | | |
| Portal team | | | |

**We confirm:**

- [ ] Live project setup (packages + client / consultant / contractor) is correct.  
- [ ] Daily DPRs for this cycle are published and stored.  
- [ ] First proper WPR (PPTX + XLSX) was generated and shared.  
- [ ] WhatsApp: MSG91/Meta status is ________ ; alerts will **go live / stay wa.me / wait** (circle one).

---

## 14. After the two weeks

| Keep doing | Owner |
|------------|--------|
| Publish DPR every working day (disciplines that worked) | Site + office close |
| WPR every Friday | Office |
| Keep BOQ / PvA / QAP / hindrance as the live registers | Planning + QC |
| New people → Directory + setup desks; remove leavers from WhatsApp list | PMO |
| File access for client/vendor via **Request access** / Share link | Office |
| Turn on API WhatsApp if not already | IT + PMO |
| Next project: copy this setup list (BOQ + PvA first), do not copy demo seed | PMO |

Module-by-module feature testing, if still open: [03-Module-Test-Plan.md](./03-Module-Test-Plan.md) and [12-Live-Client-UAT-Workbook.md](./12-Live-Client-UAT-Workbook.md).

---

## Quick links (give these with this pack)

| Need | Document |
|------|----------|
| Logins and role rules | [02-Logins-and-Access.md](./02-Logins-and-Access.md) |
| Sheets that feed DPR/WPR | [09-Project-Setup-Sheets-Required.md](./09-Project-Setup-Sheets-Required.md) |
| Global vs per-project files | [11-Global-Masters-vs-Project-Seed.md](./11-Global-Masters-vs-Project-Seed.md) |
| Daily fill card | [06-PMC-End-of-Day-Fill-Guide.md](./06-PMC-End-of-Day-Fill-Guide.md) |
| Quality / safety → reports | [08-Quality-Safety-DPR-WPR-Guide.md](./08-Quality-Safety-DPR-WPR-Guide.md) |
| WhatsApp options, cost, MSG91 email | [WHATSAPP_OWNER_CLIENT_UPDATES.md](./WHATSAPP_OWNER_CLIENT_UPDATES.md) |
| SharePoint / files | [04-SharePoint-and-Files.md](./04-SharePoint-and-Files.md) |

---

*SPDC-CLIENT-SHARE · Two-week setup, first real DPR/WPR, WhatsApp in parallel · Rev 01 · September 2026*
