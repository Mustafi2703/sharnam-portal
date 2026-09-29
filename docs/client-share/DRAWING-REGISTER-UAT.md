# Drawings module UAT — Nirav (live project)

**Portal:** https://portal.spdc.in  
**Login:** Nirav office account · `Demo@1234` (or your live office user)  
**Project:** pick one **live** pilot / Arvind project you will wipe after UAT (do **not** use Voltamp production data you must keep).  
**Files on disk (upload from your laptop):**

| File | Use as |
|------|--------|
| `module_prompts/Sharnam_modules_docs 2/DRAWING REGISTER - 01.xlsx` | Master register + dashboard |
| `module_prompts/Sharnam_modules_docs 2/Approval  &  GFC Drawing Log.xlsx` | GFC log (or use **Load UAT GFC workbook**) |
| `module_prompts/Sharnam_modules_docs 2/Drwing check master checklist.xlt.xls` | Drawing check master (reload in UI) |
| `module_prompts/Sharnam_modules_docs 2/A_10_101_R0_ GROUND FLOOR PLAN.dwg` | First GFC upload · **R0** |
| `module_prompts/Sharnam_modules_docs 2/A_10_101_R1_ GROUND FLOOR PLAN.dwg` | Next revision · **R1** |

**Cleanup after UAT:** Approval & GFC → **Delete all rows** · Master register delete lines · SharePoint CSVs/XLSX can stay or be overwritten on next Publish.

**Screenshot folder:** `Sharnam Drawings UAT — Nirav` · name files as below · browser ~1440×900.

---

## Part 1 — Registers & all sheets (examine properly)

### 1A · Dashboard (DRAWING REGISTER - 01 · Dashboard sheet)

| # | Shot file | Steps | Pass |
|---|-----------|-------|:----:|
| D1 | `D1-register-dashboard-empty-or-before.png` | Drawings → **Register dashboard** (no `sheet=` in URL) | ☐ |
| D2 | `D2-upload-register-01.png` | **Upload Excel** → pick `DRAWING REGISTER - 01.xlsx` · toast with line count | ☐ |
| D3 | `D3-dashboard-kpis.png` | Week · Total · GFC · Critical · Linked | ☐ |
| D4 | `D4-dashboard-charts-all.png` | All charts: discipline, type, critical, package, building, consultant, building×discipline, delay | ☐ |
| D5 | `D5-dashboard-pivot-tables.png` | Pivot tables under charts | ☐ |
| D6 | `D6-export-excel-01.png` | **Excel (01)** download · open · sheets **Dashboard** + **Master Drawing Register** | ☐ |
| D7 | `D7-export-dashboard-pdf.png` | **Dashboard PDF** download · open | ☐ |
| D8 | `D8-publish-sharepoint-register.png` | **Publish → SharePoint** · success toast | ☐ |
| D9 | `D9-sharepoint-drawings-folder.png` | SharePoint project drawings folder shows `DRAWING-REGISTER-01.xlsx` + `DRAWING-REGISTER-Dashboard.pdf` | ☐ |

### 1B · Master register sheet

| # | Shot file | Steps | Pass |
|---|-----------|-------|:----:|
| M1 | `M1-master-register-table.png` | `…/drawings/register?sheet=master` · full DCI columns | ☐ |
| M2 | `M2-master-edit-row.png` | **Edit** one line → change title/planned → **Save changes** | ☐ |
| M3 | `M3-master-add-row.png` | Add one manual line via form | ☐ |
| M4 | `M4-master-delete-row.png` | **Delete** one test line (confirm) | ☐ |

### 1C · Approval & GFC log sheet

| # | Shot file | Steps | Pass |
|---|-----------|-------|:----:|
| G1 | `G1-gfc-log-page.png` | Drawings → **Approval & GFC log** | ☐ |
| G2 | `G2-import-gfc-log.png` | **Load UAT GFC workbook** *or* **Import GFC log** + Excel · toast with drawing/revision counts | ☐ |
| G3 | `G3-gfc-table-r0-rn.png` | Table shows Discipline · Building · TL · DWG · R0–Rn dates | ☐ |
| G4 | `G4-gfc-download-excel.png` | Export & sync → **Download GFC Excel** · open **GFC** sheet | ☐ |
| G5 | `G5-publish-gfc-sharepoint.png` | **Publish registers → SharePoint** · `Approval-GFC-Drawing-Log.xlsx` in folder | ☐ |

---

## Part 2 — Drawing check + DWG upload (A_10_101 R0 / R1) + fill log

Drawing number for this UAT: **`A_10_101`**  
Title: **GROUND FLOOR PLAN**  
Discipline: **Architecture**

### 2A · Checklist master

| # | Shot file | Steps | Pass |
|---|-----------|-------|:----:|
| C1 | `C1-checklist-master.png` | Drawings → **Checklist manager** | ☐ |
| C2 | `C2-reload-drawing-check-xls.png` | **Reload from drawing check master XLS** · templates/lines present | ☐ |

### 2B · Upload R0 DWG (fills Drawing Check → unlock → file)

| # | Shot file | Steps | Pass |
|---|-----------|-------|:----:|
| U1 | `U1-upload-gfc-start.png` | Approval & GFC → **Upload GFC** · Drawing Check popup opens | ☐ |
| U2 | `U2-drawing-check-fill.png` | Complete **all** Yes/No/N.A. lines · submit unlock | ☐ |
| U3 | `U3-upload-r0-dwg-form.png` | Drawing no `A_10_101` · title GROUND FLOOR PLAN · rev **R0** · attach `A_10_101_R0_ GROUND FLOOR PLAN.dwg` · save | ☐ |
| U4 | `U4-gfc-row-r0-in-log.png` | GFC table / Log accordion shows R0 · **DWG** badge · file name | ☐ |

### 2C · Upload R1 DWG (next revision)

| # | Shot file | Steps | Pass |
|---|-----------|-------|:----:|
| U5 | `U5-upload-rev-r1-check.png` | On `A_10_101` → **Upload rev** · Drawing Check again if required for new rev | ☐ |
| U6 | `U6-upload-r1-dwg.png` | Rev **R1** · attach `A_10_101_R1_ GROUND FLOOR PLAN.dwg` · save | ☐ |
| U7 | `U7-gfc-r0-and-r1.png` | Log shows **R0** + **R1** · current rev R1 | ☐ |

### 2D · Checklist fill log (must show fills)

| # | Shot file | Steps | Pass |
|---|-----------|-------|:----:|
| L1 | `L1-checklist-fill-log.png` | Drawings → **Checklist fill log** · family Drawing check | ☐ |
| L2 | `L2-fill-log-preupload-rows.png` | Rows for Pre-upload / Drawing Check on `A_10_101` (R0 and/or R1) · status Submitted | ☐ |
| L3 | `L3-fill-log-open-detail.png` | Open one fill · answers / template name visible | ☐ |

### 2E · Optional RFI checklist fill

| # | Shot file | Steps | Pass |
|---|-----------|-------|:----:|
| R1 | `R1-rfi-request-checklist.png` | RFIs → Request checklist fill (DrawingChecklist) · assign party | ☐ |
| R2 | `R2-rfi-fill-log-link.png` | After fill · appears in fill log and/or RFI thread | ☐ |

---

## Part 3 — SharePoint confirmation (all filed)

After **Publish** from dashboard and/or GFC page, in the project **drawings** ISO folder confirm:

| File on SharePoint | Shot | Pass |
|--------------------|------|:----:|
| `DRAWING-REGISTER-01.xlsx` | `S1-sp-register-xlsx.png` | ☐ |
| `DRAWING-REGISTER-Dashboard.pdf` | `S2-sp-dashboard-pdf.png` | ☐ |
| `Approval-GFC-Drawing-Log.xlsx` | `S3-sp-gfc-xlsx.png` | ☐ |
| `DRAWING-REGISTER.csv` (audit) | optional | ☐ |
| `Drawing-Check-Master-Log.csv` | optional | ☐ |
| DWG under drawing revision path (R0/R1) | `S4-sp-dwg-files.png` | ☐ |

---

## Part 4 — Sign-off (Nirav)

| Area | Shots | Nirav Pass | Date |
|------|-------|:----------:|------|
| Register dashboard + all charts + Excel/PDF | D1–D9 | ☐ | |
| Master register edit/add/delete | M1–M4 | ☐ | |
| GFC import + SharePoint GFC xlsx | G1–G5 | ☐ | |
| Drawing check + A_10_101 R0/R1 DWG | U1–U7 | ☐ | |
| Checklist fill log | L1–L3 | ☐ | |
| SharePoint all registers filed | S1–S4 | ☐ | |

**Notes / blockers:**

_________________________________________________________________

**Wipe after UAT:** GFC **Delete all rows** · remove master test lines · leave CRM/HRMS/other projects untouched.

---

## Quick path (if short on time)

1. Register dashboard → Upload `DRAWING REGISTER - 01.xlsx` → Publish → SharePoint  
2. Approval & GFC → **Load UAT GFC workbook** → Publish  
3. Upload GFC → fill Drawing Check → `A_10_101` R0 DWG → Upload rev R1 DWG  
4. Checklist fill log → screenshot Pre-upload rows  
5. Delete all GFC rows when done  
