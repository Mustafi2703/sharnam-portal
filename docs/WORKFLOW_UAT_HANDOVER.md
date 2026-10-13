# Sharnam Portal — End-to-end workflow & UAT handover

**Project:** Voltamp Transformers (Karjan) on https://portal.spdc.in  
**Target handover:** ~15 Oct 2026  
**Markup review (mark OK / FIX):** [`DELIVERY_REVIEW_MARKUP.md`](./DELIVERY_REVIEW_MARKUP.md)  
**Deep UAT script:** `UAT_PURGE=1 node scripts/prod-deep-uat.mjs`  
**Evidence:** `docs/uat-evidence/prod-deep-YYYY-MM-DD/REPORT.md`  
**Client WPR Excel:** July week template (`WPR-Client-Week-Template.xlsx` = `WPR  23 July to 29 July.xlsx`)  
**Client WPR PPTX:** Arvind deck (`templates/SPDC_WPR_CLIENT_REFERENCE.pptx` = `SPDC_Arvind Limited_WPR_50.pptx`)

This document is the single place for (1) the workflow the UAT covers, (2) what every major page does, and (3) known gaps before client handover. Point out mistakes here; we fix, redeploy, and re-run UAT.

---

## 1. Roles used in production UAT

| Login portal | Account | Role on the job |
|---|---|---|
| Office | operations@spdc.in | Sharnam PMC desk |
| Site | jaideep.parmar@spdc.in | Site engineer |
| Planning | planning.estimation@spdc.in | Planning / estimation |
| Vendor | sanjaythakor.reeca@gmail.com | Reeca Infrastructure (contractor) |
| Client | deven_mktg@voltamptransformers.com | Voltamp (read + concerns + sign-off) |
| Consultant | ashish.chobe@shahntalati.com | Shah & Talati (matrix) — answers RFIs |

Password for UAT accounts: `Demo@1234` (override with `UAT_PASSWORD`).

---

## 2. Workflow covered (what “done” looks like)

Timeline: **3 working weeks (Mon–Fri)** → **15 DPRs** + **3 WPRs**, with continuity (DPR cum carries day-to-day; WPR “till previous week” = last week’s “till date”).

```
Setup → Attendance → Drawings → Design coordination → RFIs
     → Quality (checklists, NCR/CAR, QAP, cubes) → Safety
     → Progress (activities, milestones, manpower, S-curve)
     → Finance / bills → DPR ×15 → WPR ×3 (xlsx + client pack + pptx)
     → SharePoint folder verify → branded downloads
```

### Step detail

1. **SET** — Resolve Voltamp project; optional purge of module data (users, team, communication matrix kept); site geofence pin; **client logo** upload for Sharnam + client co-branding.
2. **ATT** — Back-fill site attendance for 15 days; live GPS + selfie punch.
3. **DWG** — GFC/drawing uploads with revisions; master register; dashboard; drawing checklists; library files.
4. **DCI** — Design coordination issues → follow-ups → escalate to RFI; consultant markup.
5. **RFI** — Raise / answer / close; correspondence files + markups on SharePoint.
6. **CHK / QI** — Quality IR + site execution checklists (photos deferred to background SharePoint so the UI does not 504).
7. **NCR / CAR** — Separate registers; “Attention to” matrix contact emailed; vendor response + close.
8. **SAF** — Daily safety log (manpower, TBT, PPE); safety NCR / observations.
9. **PRG** — Activity register, milestones, **weekly manpower trades** (feeds WPR charts), hindrances, risks, legal, planned-vs-actual, S-curve.
10. **FIN** — Vendor RA bill path + cashflow/budget reads as applicable.
11. **DPR** — Site saves + publishes CIVIL DPR per day; cumulative continuity asserted.
12. **WPR** — Office builds week pack from DPRs; asserts:
    - Communication matrix ≥ 3 rows in section data
    - SPDC xlsx + **client week xlsx** + pptx download
    - Client pack: **≥6 embedded charts**, **Communication Matrix sheet**, **≥2 logos in xl/media**
    - PPTX size large enough for charts/photos
    - Report numbers 1 → 2 → 3; client can download, cannot edit
13. **VERIFY** — Key ISO folders present; evidence REPORT written.

---

## 3. WPR deliverables (client-facing)

| Artefact | Endpoint | Must include |
|---|---|---|
| SPDC WPR workbook | `GET …/wpr-maker/:id/download.xlsx` | All sections, matrix, Sharnam + client logo on cover |
| Client week pack | `GET …/wpr-maker/:id/download-client.xlsx` | Arvind-style template charts restored after ExcelJS fill; **Communication Matrix** sheet appended with co-branded logos; ≥2 media images |
| PowerPoint | `GET …/wpr-maker/:id/download.pptx` | Chart slides + photos; client logo left of Sharnam on headers |
| Publish | `POST …/wpr-maker/:id/publish` | Files under `10.01_Progress_Reporting_MIS` |

---

## 4. App page-by-page (project workspace)

Paths are under `/projects/:id/…` unless noted. Hubs are card launchers; tools open the live sheet/UI.

### Auth & shells
| Path | What it does |
|---|---|
| `/login` (+ `/login/office|site|vendor|client|hr|stakeholder`) | Role portals into the same app |
| `/workspace` | Pick workspace / project |
| `/dashboard` | Cross-project desk |
| `/hrm/*` | HRMS (recruitment, onboarding, payroll, attendance, leave, vouchers, docs, masters, training, users) — company-wide, not project module |

### Project home
| Path / tool | What it does |
|---|---|
| Project overview | Shortcuts into modules |
| `setup` | Allocate SPDC people, vendors, **communication matrix**, complete setup, invites |
| `directory` | People by party (PMC / Site / Client / Contractor) + signature PNG for exports |
| `vendors` | Vendor assignments on the job |

### Drawings (`hub/drawings`)
| Tool | What it does |
|---|---|
| Approval & GFC log | Upload drawings (checklist → revision → dates); Excel + PDF |
| Dashboard | Location / critical / delay / org charts; branded PDF |
| Master register | Planned dates, criticality, delays |
| Drawing settings | Pick-lists + workbook load/save to SharePoint |
| Design coordination | Assign issues, follow up ×5, escalate to RFI |
| Drawing files / library | PDF/DWG in design folders |
| Checklist manager / fill log | Drawing Check Master + branded fills |
| RFI register / Ask | Correspondence RFIs linked to design |

### DMS
| Tool | What it does |
|---|---|
| Document manager | ISO Rev 02 tree — upload/preview; mirrors SharePoint |

### Quality (`hub/quality`)
| Tool | What it does |
|---|---|
| Dashboard | Quality KPIs / week / QI fills |
| SOR / Site observation / Site instruction | Observation registers |
| CAR / NCR register | Non-conformance + corrective action (separate NCR vs CAR downloads) |
| NCR / CAR fill log | Form fills, Sync SharePoint |
| Cube Test | Cube cast/test register |
| QAP + QAP master | Assurance plan + master library |
| Quality IR / Site checklist masters & fill logs | Templates + branded fills |
| Request for Inspection (F-01) | Raise / assign / track IR |
| Quality files | SharePoint 08 tree + exports |
| Vendor actions | NCR/CAR and QI responses for contractor |

### Safety (`hub/safety`)
| Tool | What it does |
|---|---|
| Dashboard | HSE one-pager KPIs |
| Site instruction / Unsafe act / NCR summary & form / Observation / HIRA / Safety hours | Sheet-mode registers |
| Safety checklist master / fills | Safety-only checklists |
| Safety files | HSE folder + safety RFIs/NCRs |
| Vendor actions | Safety NCR responses |

### Inspection / Progress / Comms / Cost / Finance / Reports / Closure
| Hub | What it does |
|---|---|
| Inspection | Cross-cutting inspection register views |
| Progress | Activities, milestones, manpower, hindrances, risks, legal, planned-vs-actual, S-curve, DPR/WPR makers & file panels |
| Comms | Communication matrix maintenance + correspondence helpers |
| Cost | Budget / cashflow style tools (client sheets) |
| Finance | Vendor bills / RA / finance registers |
| Reports | MIS / published DPR–WPR file panels |
| Closure | Handover / close-out placeholders as configured |

### Standalone overlays
| Path | What it does |
|---|---|
| `/projects/:id/checklist/fill/:assignmentId` | Full-screen checklist fill |
| `/projects/:id/ncr-form/:scope/:recordId` | NCR/CAR form |
| `/projects/:id/drawings/precheck` | Drawing pre-check before upload |

### Module file panels
`…/drawings|quality|safety|progress|reports|dpr|wpr|cost|finance|comms|audit-kpi|inspection/files` — browse portal-generated + SharePoint files for that module (DPR/WPR panels for published packs).

---

## 5. Gap list (review before handover)

Mark each: **Fixed** / **Open** / **Won’t fix for 15 Oct**.

| # | Area | Gap | Status |
|---|---|---|---|
| G1 | WPR client pack | Charts invisible after ExcelJS rewrite | **Fixed** — `restoreTemplateCharts` after fill + matrix append |
| G1b | WPR client pack | Prod used old `WPR File.xlsx` (4 charts) via `SHARNAM_EXCEL_ROOT` | **Fixed** — prefer `WPR-Client-Week-Template.xlsx` (8 charts); copy into `seed/data` |
| G2 | WPR client pack | No Communication Matrix sheet / weak branding | **Fixed** — append sheet with Sharnam + client logos |
| G3 | WPR PPTX | Client logo missing on chart slides | **Fixed** — `chartClientLogoPath` in slide headers |
| G4 | WPR SPDC xlsx | Client logo on cover | **Fixed** — stamp on cover |
| G5 | Checklist photos | Gateway 504 while waiting on SharePoint | **Fixed** — `sharePointMs: 0` (background upload) |
| G6 | UAT | Did not assert charts / matrix / media logos | **Fixed** — deep UAT WPR asserts + binary download |
| G7 | UAT | Manpower empty → weak histogram chart | **Fixed** — PRG-1 seeds 8 trades |
| G8 | UAT | Client logo missing → single brand | **Fixed** — SET-4 uploads client logo |
| G9 | CHK / FIN | Occasional 504 / timeout on heavy SharePoint paths | **Watch** — race/background; re-check after deploy |
| G10 | Bid module | Out of scope for this UAT | Won’t fix for 15 Oct |
| G11 | Visual UAT | Human open of client xlsx + pptx in Excel/PowerPoint | **Open** — after next green deep UAT |
| G12 | REPORT.md | Stale run evidence | **Open** — refresh after next `UAT_PURGE=1` run |

---

## 6. Deploy & re-UAT loop

```bash
# After merge to main (Hostinger auto-deploy ~2 min)
curl -s https://portal.spdc.in/api/health   # check commit / ok

UAT_PURGE=1 node scripts/prod-deep-uat.mjs
# Optional: UAT_ONLY=WPR  or  UAT_ONLY=DPR,WPR

# Evidence lands under docs/uat-evidence/prod-deep-<date>/
```

When you spot a mistake in exports or a page: note the gap id (or new row), we patch → push → wait health → purge UAT → you re-check.

---

## 7. Handover checklist

- [ ] Deep UAT green (all sections including WPR chart/matrix asserts)
- [ ] Client week xlsx: 8 charts visible in Excel, Communication Matrix tab, both logos
- [ ] WPR PPTX: chart slides + both logos on header
- [ ] NCR and CAR registers separate on SharePoint 08.06
- [ ] DPR ×15 and WPR ×3 continuity numbers agreed
- [ ] Communication matrix on project setup matches exports
- [ ] Client + consultant can log in and only do allowed actions
- [ ] This MD + latest REPORT.md accepted by you
