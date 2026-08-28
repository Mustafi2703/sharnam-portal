/**
 * SPDC HSE Pack seeder — reads
 * `module_prompts/Sharnam_modules_docs 2/SPDC_Safety_Inspection_Request_and_Checklists.xlsx`
 * and creates three canonical checklist templates so PMC / contractors do not
 * type these ~170 line items again:
 *   • SPDC/HSE/F-01 · Safety Inspection & Clearance Request (pre-start)
 *   • SPDC/HSE/F-02 · Site Safety Inspection Checklist (periodic walkthrough)
 *   • SPDC/HSE/F-03 · Activity-Specific Pre-Start Safety Checklists
 *
 * Section headers in the workbook are all upper-case labels like `A. STATUTORY & DOCUMENTATION`.
 * We keep those as `section` values so the master editor can group by band the same
 * way BOQ / MB sheets already do.
 */

import fs from "fs";
import path from "path";
import XLSX from "../lib/xlsx.js";
import { prisma } from "../prisma.js";

type ParsedItem = {
  section: string;
  itemNo: number;
  description: string;
  requirePhoto?: boolean;
  instruction?: string;
};

type ParsedTemplate = {
  key: string;
  name: string;
  docNo: string;
  category: string;
  checklistType: "Safety";
  requirePhotosMin: number;
  instructions: string;
  items: ParsedItem[];
};

/** Look in a few well-known locations so the pack works from the repo root and Render's build dir. */
export function locateSafetyPackXlsx(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "module_prompts/Sharnam_modules_docs 2/SPDC_Safety_Inspection_Request_and_Checklists.xlsx"),
    path.resolve(process.cwd(), "../../module_prompts/Sharnam_modules_docs 2/SPDC_Safety_Inspection_Request_and_Checklists.xlsx"),
    path.resolve(process.cwd(), "../../../module_prompts/Sharnam_modules_docs 2/SPDC_Safety_Inspection_Request_and_Checklists.xlsx"),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* try next */
    }
  }
  return null;
}

function cleanCell(v: unknown): string {
  return String(v ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Row where col A is a number and col B is descriptive → real item.  Rows with col A blank
 *  and col B `A. STATUTORY & DOCUMENTATION` shape → new section header. */
/**
 * Section headers in the source pack look like `A.  STATUTORY & DOCUMENTATION`
 * placed in **column A** with column B empty; item rows have a numeric serial
 * in column A and the checkpoint text in column B.  Handle both layouts so we
 * keep the section grouping the SPDC HSE editor expects.
 */
function parseChecklistSheet(rows: string[][]): ParsedItem[] {
  const items: ParsedItem[] = [];
  let currentSection = "General";
  let itemCounter = 0;
  const looksLikeSectionHeader = (s: string) =>
    /^[A-Z]\.\s+/.test(s) || (s.length < 90 && /^[A-Z][A-Z0-9\s&,'()./\-]{2,}$/.test(s));
  for (const raw of rows) {
    if (!raw?.length) continue;
    const a = cleanCell(raw[0]);
    const b = cleanCell(raw[1]);
    if (!a && !b) continue;

    // Section header in column A, column B empty
    if (a && !b && looksLikeSectionHeader(a)) {
      currentSection = a.replace(/^[A-Z]\.\s*/, "").trim() || currentSection;
      continue;
    }
    // Section header in column B, column A empty
    if (!a && b && looksLikeSectionHeader(b)) {
      currentSection = b.replace(/^[A-Z]\.\s*/, "").trim() || currentSection;
      continue;
    }
    if (!b) continue;

    // Item row: numeric serial in col A, checkpoint text in col B
    const serial = Number(a);
    if (Number.isFinite(serial) && serial > 0 && b.length > 3) {
      itemCounter += 1;
      items.push({
        section: currentSection,
        itemNo: itemCounter,
        description: b,
        requirePhoto: true,
        instruction: `Rate Yes / No / NA.  Photo evidence mandatory when Status = No or observation raised.  SPDC HSE pack · ${currentSection}.`,
      });
    }
  }
  return items;
}

/** Safety IR form is a fixed 12-line pre-start checklist we synthesise from the form
 *  header rows so PMC / contractor can fill it as a checklist even though the source is
 *  a printable form.  Items mirror the numbered sections we observed in the workbook. */
function safetyIrRequestItems(): ParsedItem[] {
  const items = [
    "Particulars filled: Project, Client, Contractor, PMC, IR number, date, WO / package number.",
    "High-risk activity type ticked (Excavation / Work at height / Hot work / Confined space / Lifting / etc.).",
    "Description of work, exact location, grid, level captured.",
    "Clearance sought from named PMC engineer with date, shift and valid-up-to.",
    "HIRA / method statement / drawings / PTW / TBT records attached and current.",
    "Competent supervisor and certified crew names + IDs listed and available at work front.",
    "PPE and tools inspected — helmet, harness (double-lanyard), gloves, goggles, footwear, tags.",
    "Barricading, signage, rescue equipment, first-aider and fire extinguisher present.",
    "Weather, wind, visibility, temperature, ambient gas readings acceptable for the shift.",
    "Adjacent trades notified; no clash of operations; interference risks controlled.",
    "PMC inspection at work front — controls physically verified against the checklist.",
    "Result code (S1 Cleared / S2 Cleared with conditions / S3 Not cleared / S4 Stop Work) recorded.",
  ];
  return items.map((description, idx) => ({
    section: idx < 4 ? "Particulars" : idx < 8 ? "Method + Resources" : "PMC Verification",
    itemNo: idx + 1,
    description,
    requirePhoto: idx >= 8,
    instruction: idx >= 8
      ? "PMC engineer confirms visually and stamps the IR.  Photo of the work front required."
      : "Contractor safety officer to fill before offering the IR.",
  }));
}

export function parseSafetyPack(xlsxPath: string): ParsedTemplate[] {
  const buf = fs.readFileSync(xlsxPath);
  const wb = XLSX.read(buf, { type: "buffer" });

  const generalRaw = XLSX.utils.sheet_to_json<any[]>(wb.Sheets["Safety Checklist (General)"] || {}, {
    header: 1,
    blankrows: false,
    raw: false,
  });
  const activityRaw = XLSX.utils.sheet_to_json<any[]>(wb.Sheets["Activity Safety Checklists"] || {}, {
    header: 1,
    blankrows: false,
    raw: false,
  });

  const generalItems = parseChecklistSheet(generalRaw as string[][]);
  const activityItems = parseChecklistSheet(activityRaw as string[][]);
  const irItems = safetyIrRequestItems();

  const templates: ParsedTemplate[] = [
    {
      key: "SPDC/HSE/F-01",
      name: "SPDC/HSE/F-01 · Safety Inspection & Clearance Request",
      docNo: "SPDC/HSE/F-01 Rev.0",
      category: "Safety · Pre-start clearance",
      checklistType: "Safety",
      requirePhotosMin: 3,
      instructions:
        "Pre-start clearance IR for one high-risk activity.  Raised by contractor safety officer, cleared by PMC at the work front before work begins.  Result codes: S1 Cleared · S2 Cleared with conditions · S3 Not cleared · S4 Stop-work.",
      items: irItems,
    },
    {
      key: "SPDC/HSE/F-02",
      name: "SPDC/HSE/F-02 · Site Safety Inspection Checklist (Periodic Walkthrough)",
      docNo: "SPDC/HSE/F-02 Rev.0",
      category: "Safety · Periodic walkthrough",
      checklistType: "Safety",
      requirePhotosMin: 3,
      instructions:
        "Weekly joint walkthrough by PMC and contractor safety.  Score = Yes / (Yes + No).  ≥95% Satisfactory · 85–95% Needs Improvement · <85% Unsatisfactory.  Any open High-risk finding forces Unsatisfactory.",
      items: generalItems,
    },
    {
      key: "SPDC/HSE/F-03",
      name: "SPDC/HSE/F-03 · Activity-Specific Pre-Start Safety Checklists",
      docNo: "SPDC/HSE/F-03 Rev.0",
      category: "Safety · Activity pre-start",
      checklistType: "Safety",
      requirePhotosMin: 3,
      instructions:
        "Pre-start activity checks per SPDC activity groups (scaffold, work at height, hot work, lifting, confined space, energisation, excavation, night work).  Use before every shift and after any interruption.",
      items: activityItems,
    },
  ];
  return templates.filter((t) => t.items.length > 0);
}

/** Idempotent seed — matches an existing template by `name` (`SPDC/HSE/F-0x …`)
 *  and replaces its items so we can safely re-run after updating the pack. */
export async function seedSpdcSafetyPack(source?: string) {
  const xlsxPath = source && fs.existsSync(source) ? source : locateSafetyPackXlsx();
  if (!xlsxPath) {
    throw new Error(
      "SPDC HSE pack not found — expected module_prompts/Sharnam_modules_docs 2/SPDC_Safety_Inspection_Request_and_Checklists.xlsx"
    );
  }
  const templates = parseSafetyPack(xlsxPath);
  const summary: { name: string; templateId: string; items: number; created: boolean }[] = [];
  for (const t of templates) {
    const existing = await prisma.checklistTemplate.findFirst({ where: { name: t.name } });
    if (existing) {
      await prisma.checklistItem.deleteMany({ where: { templateId: existing.id } });
      await prisma.checklistTemplate.update({
        where: { id: existing.id },
        data: {
          category: t.category,
          checklistType: t.checklistType,
          instructions: t.instructions,
          requirePhotosMin: t.requirePhotosMin,
          source: "SPDC HSE Pack",
          items: {
            create: t.items.map((it) => ({
              itemCode: String(it.itemNo),
              description: it.description,
              instruction: it.instruction || null,
              section: it.section,
              sortOrder: it.itemNo,
              requirePhoto: Boolean(it.requirePhoto),
            })),
          },
        },
      });
      summary.push({ name: t.name, templateId: existing.id, items: t.items.length, created: false });
    } else {
      const created = await prisma.checklistTemplate.create({
        data: {
          name: t.name,
          category: t.category,
          checklistType: t.checklistType,
          instructions: t.instructions,
          requirePhotosMin: t.requirePhotosMin,
          source: "SPDC HSE Pack",
          items: {
            create: t.items.map((it) => ({
              itemCode: String(it.itemNo),
              description: it.description,
              instruction: it.instruction || null,
              section: it.section,
              sortOrder: it.itemNo,
              requirePhoto: Boolean(it.requirePhoto),
            })),
          },
        },
      });
      summary.push({ name: t.name, templateId: created.id, items: t.items.length, created: true });
    }
  }
  return { source: xlsxPath, templates: summary };
}
