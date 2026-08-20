# MODULE — Reports (DPR · WPR)

**Prompts:** `module_prompts/dpr_generation.md`, `module_prompts/WPR_generation.md`  
**SRS:** [CLIENT_REQUIREMENTS.md](../CLIENT_REQUIREMENTS.md) §4.11  
**Hub:** `/projects/:id/hub/reports`

---

## 1. Purpose

Generate Daily / Weekly packs from **live registers**. DPR and WPR are **separate hub tools**.

---

## 2. Tools (sheet → hub card)

| Tool | Hub / route | Status | Source |
|------|-------------|--------|--------|
| **DPR pack** | `/reports` or `?kind=dpr` | Built | DPR-Sharnam PMC |
| **WPR pack** | `/reports?kind=wpr` · WPR Maker | Built | Excel + **~61-slide PPTX** aligned to `SPDC_Arvind Limited_WPR_50.pptx` (cover, dividers, multi-slide milestones/quality/PvsA/photos) |
| Pack viewer | Partial | In-app HTML/PDF for Client |

### Awaiting next sheets

| Tool | Status | Notes |
|------|--------|-------|
| Extra client pack layouts | Ready | New Excel → section map in this doc + generate service |

---

## 3–5. Sections

DPR / WPR section maps and checklist → report mapping — see prior content / prompts.

| Fill type | DPR / WPR section |
|-----------|-------------------|
| `SiteExecution` | Site execution / daily site checklist |
| `DrawingCheck` | Drawing / GFC checklist |
| `QualityInspection` | Quality (+ NCR / cube / QAP on WPR) |
| `Safety` | Safety |

---

## 6. Rules

1. Packs pull live data at generate time (`wprSeedSections` → Excel + `buildWprPptx`).  
2. WPR PPT is regenerated from portal data (not OpenXML fill of the client PPTX binary) but follows the Arvind **61-slide** narrative.  
3. Client civil must see generated report PDFs.  
4. Cashflow on WPR prefers **Cost** periods (incl. PVA sync + COP); Progress PvsA is the fallback.  

---

## 7. Review checklist

- [ ] Confirm DPR section order vs latest client Excel  
- [ ] Confirm WPR week definition  
- [ ] Confirm auto-publish to Client vs manual share  
