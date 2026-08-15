# Sheet connection maps — Sharnam portal

**For client walkthrough · August 2026**

These maps show how your Excel registers connect inside the portal. **Comms matrix** and **Design coordination** are separate tools and are not shown here.

---

## 1. Daily hub — DPR pulls from all site modules

```mermaid
flowchart TB
  subgraph cost [Cost]
    BOQ[BOQ / Monitoring per structure]
    MB[Measurement Book MB]
    BBS[Bar Bending Schedule BBS]
    CF[Cashflow / AC certified]
  end
  subgraph progress [Progress]
    PA[Planned vs Actual register]
    MP[Weekly manpower]
    HIN[Hindrance register]
  end
  subgraph quality [Quality]
    NCR[Non-conformance NCR]
    CUBE[Cube register]
    QAP[Quality Assurance Plan QAP]
    CHK_QI[QI checklists]
  end
  subgraph safety [Safety]
    SAF[Safety observations / TBT]
    CHK_S[Safety checklists]
  end
  DPR[DPR Maker — daily × discipline]
  WPR[WPR Maker — weekly PPTX]

  BOQ --> DPR
  MB --> DPR
  BBS --> DPR
  PA --> DPR
  MP --> DPR
  HIN --> DPR
  SAF --> DPR
  NCR --> DPR
  CUBE --> DPR
  CF --> DPR
  DPR --> WPR
  PA --> WPR
  HIN --> WPR
  NCR --> WPR
  SAF --> WPR
```

| Excel / client sheet | Portal table | Feeds |
|---------------------|--------------|-------|
| BOQ monitoring (per structure upload) | `CostMonitoringLine` | DPR qty rows |
| MB sheet | `CostMbLine` | DPR cumulative qty |
| BBS sheet + shape master | `CostBbsLine` + `BbsShapeMaster` | DPR rebar kg |
| Planned Vs Actual Dashboard | `ProgressActivityLine` | DPR planned hints |
| Weekly Manpower | `ProgressManpower` | DPR + WPR |
| Hindrance Register | `ProgressHindrance` | DPR delays / issues |
| NCR 01.xlsx | `QualityNcr` | DPR quality + WPR |
| Cube register | `CubeTest` | DPR + WPR |
| QAP | `QapActivity` | WPR quality section |
| Safety dashboard | `SafetyRecord` | DPR HSE + WPR |

---

## 2. Cost module — what you upload vs global master

```mermaid
flowchart LR
  subgraph perProject [Per project — Cost tab]
    BOQ_UP[Upload BOQ per structure]
    MB_EDIT[MB sheet — inline edit]
    BBS_EDIT[BBS sheet — inline edit + shape diagram]
    SYNC[Sync MB → monitoring achieved]
  end
  subgraph global [Master module]
    MB_MASTER[Global MB template]
    BBS_MASTER[Global BBS template]
    SHAPE[BBS shape code library]
  end
  MB_MASTER -->|Pick lines| MB_EDIT
  BBS_MASTER -->|Pick lines| BBS_EDIT
  SHAPE --> BBS_EDIT
  BOQ_UP --> MON[Monitoring / GFC / Achieved]
  MB_EDIT --> SYNC --> MON
  MON --> DPR
  BBS_EDIT --> DPR
```

**Rule:** BOQ is **never** a global master — upload per structure on **Cost → BOQ**. MB/BBS lines come from **global master → pick into project**, then site edits quantities and diagrams.

---

## 3. NCR (Non-conformance) — raise → track → close

```mermaid
flowchart LR
  RAISE[Site / QC raises NCR]
  DB[(QualityNcr)]
  CHK[Safety or QI checklist may link]
  DPR[DPR quality block]
  WPR[WPR weekly quality slide]
  FIN[Finance COP only if commercial]

  RAISE --> DB
  CHK --> DB
  DB --> DPR
  DB --> WPR
```

| Step | Who | Portal |
|------|-----|--------|
| Raise | Site QC / PMC | **Quality → NCR** — description, location, severity, photos |
| Assign / close | PMC office | Update status, corrective action, close date |
| Daily rollup | Auto | **DPR Maker** quality tests row |
| Weekly rollup | Auto | **WPR Maker** quality section |

NCR is **not** the same as Safety observation — safety items live in **Safety** module; quality defects live in **Quality → NCR**.

---

## 4. Finance ↔ Cost (payment summary)

```mermaid
flowchart LR
  PO[Finance — Purchase Order]
  RA[RA Bill]
  COP[COP / certified payment]
  CF[Cost cashflow]
  BUD[Cost budget]

  PO --> RA --> COP
  COP --> CF
  COP --> BUD
  MON[Cost monitoring achieved] -. engineering qty .-> RA
```

Official commercial path: **Finance → PO → RA → COP**. Cost **Bills** tab is a quick vendor log only.

---

## 5. Checklists → modules

| Checklist type | Filled by | Connects to |
|----------------|-----------|-------------|
| Site execution | Site | DPR highlights (manual) |
| Quality inspection QI | Site QC | Quality logs, WPR |
| Drawing check | Drawing team | Drawings register |
| Safety | Site | Safety module → DPR HSE |

Fill checklists with **photos + signature** on mobile; branded HTML export for PDF archive.

---

## 6. WPR — same data as DPR, weekly PPTX

Client reference: `SPDC_Arvind Limited_WPR_50.pptx`

Portal: **WPR Maker** → 24 sections auto-seeded → **Download PPTX** (one slide per section + cover).

---

*PNG overview: `docs/client-share/assets/portal-sheet-connections.jpg` (for slide decks)*
