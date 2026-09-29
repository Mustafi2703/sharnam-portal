import path from "path";
import XLSX from "../lib/xlsx.js";
import { findWorkbook } from "../lib/excelRoot.js";
import { prisma } from "../prisma.js";

function readDrawingCheckRows(file: string): string[][] {
  const wb = XLSX.readFile(file);
  const sheetName = wb.SheetNames.find((n) => /check|drawing|review/i.test(n)) || wb.SheetNames[0];
  return XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheetName], { header: 1, defval: "" }) as string[][];
}

/** Parse Drwing check master checklist.xlt.xls → DrawingCheck templates (editable in checklist master). */
export async function importDrawingCheckTemplatesFromWorkbook(): Promise<{
  file: string | null;
  templates: number;
  items: number;
}> {
  const file =
    findWorkbook(["Drwing check master checklist.xlt.xls", "Drwing check master checklist.xlt"]) ||
    null;
  if (!file) return { file: null, templates: 0, items: 0 };

  const drawRows = readDrawingCheckRows(file);
  let section = "General";
  const bySection = new Map<string, { itemCode: string; description: string; section: string; sortOrder: number }[]>();
  let order = 0;

  for (let i = 0; i < drawRows.length; i++) {
    const c0 = String(drawRows[i][0] ?? "").trim();
    const c1 = String(drawRows[i][1] ?? "").trim();
    const c2 = String(drawRows[i][2] ?? "").trim();
    const header = c0 || c1;
    if (/DRAWING REVIEW|CHECKLIST/i.test(header) && !c2) {
      section = header.replace(/^\d+\.\s*/, "").trim();
      if (!bySection.has(section)) bySection.set(section, []);
      order = 0;
      continue;
    }
    if (/^Sr\.?$/i.test(c0) || /^Sr\.?$/i.test(c1) || c1 === "Sr.") continue;
    const checkpoint = c1 && !/^Sr/i.test(c1) ? c1 : c2 || (c0 && !/^\d+/.test(c0) ? c0 : "");
    if (!checkpoint || /Yes|No|N\.A/i.test(checkpoint)) continue;
    if (!bySection.has(section)) bySection.set(section, []);
    order++;
    bySection.get(section)!.push({
      itemCode: String(order),
      description: checkpoint,
      section,
      sortOrder: order,
    });
  }

  let templates = 0;
  let items = 0;
  for (const [sec, sectionItems] of bySection) {
    if (!sectionItems.length) continue;
    const name = sec.length > 80 ? `${sec.slice(0, 77)}…` : sec;
    const existing = await prisma.checklistTemplate.findFirst({ where: { name } });
    if (!existing) {
      await prisma.checklistTemplate.create({
        data: {
          name,
          category: "Drawings",
          checklistType: "DrawingCheck",
          source: path.basename(file),
          instructions: "Complete before uploading any drawing or revision (GFC gate).",
          requirePhotosMin: 0,
          items: { create: sectionItems },
        },
      });
      templates++;
      items += sectionItems.length;
    } else {
      await prisma.checklistTemplate.update({
        where: { id: existing.id },
        data: {
          checklistType: "DrawingCheck",
          source: path.basename(file),
          instructions: "Complete before uploading any drawing or revision (GFC gate).",
          requirePhotosMin: 0,
        },
      });
      await prisma.checklistItem.deleteMany({ where: { templateId: existing.id } });
      await prisma.checklistItem.createMany({
        data: sectionItems.map((it) => ({ ...it, templateId: existing.id })),
      });
      templates++;
      items += sectionItems.length;
    }
  }

  return { file: path.basename(file), templates, items };
}
