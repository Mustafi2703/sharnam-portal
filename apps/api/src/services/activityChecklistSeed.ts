/**
 * Activity Inspection checklist (SPDC/QA/F-02) from SPDC_Activity_Inspection_Checklist_Format.xlsx.
 * Creates the worked "RCC Column" template once (A–H sections, acceptance criteria, method, reference).
 * Never rebuilds an existing template, so filled checklists keep their answers.
 */
import fs from "fs";
import XLSX from "../lib/xlsx.js";
import { prisma } from "../prisma.js";
import { findWorkbook } from "../lib/excelRoot.js";

export const ACTIVITY_TEMPLATE_NAME = "RCC Column — Activity Inspection (SPDC/QA/F-02)";

export async function seedActivityChecklist(): Promise<{ created: boolean; items: number; templateId: string } | null> {
  const existing = await prisma.checklistTemplate.findFirst({ where: { name: ACTIVITY_TEMPLATE_NAME } });
  if (existing) {
    const items = await prisma.checklistItem.count({ where: { templateId: existing.id } });
    return { created: false, items, templateId: existing.id };
  }
  const file = findWorkbook(["SPDC_Activity_Inspection_Checklist_Format.xlsx"]);
  if (!file) return null;
  const wb = XLSX.read(fs.readFileSync(file));
  const sheet = wb.SheetNames.find((n) => /example/i.test(n)) || wb.SheetNames[1] || wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet], { header: 1, defval: "" }) as unknown[][];
  const s = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
  let section = "";
  let order = 0;
  const items: { itemCode: string; description: string; instruction: string; section: string; sortOrder: number; requirePhoto: boolean }[] = [];
  for (const r of rows) {
    const cells = r.map(s);
    const first = cells.find((c) => c) || "";
    if (/^[A-H]\.\s/.test(first) && cells.filter((c) => c).length === 1) {
      section = first;
      continue;
    }
    // Sr. | Check description | Requirement / acceptance | Method | Reference | Status | Observation | Remarks
    const srIdx = cells.findIndex((c) => /^\d+$/.test(c));
    if (srIdx < 0 || !section) continue;
    const [sr, desc, criteria, method, ref] = cells.slice(srIdx, srIdx + 5);
    if (!desc) continue;
    order++;
    items.push({
      itemCode: `${section.charAt(0)}${sr}`,
      description: desc,
      instruction: [criteria && `Acceptance: ${criteria}`, method && `Method: ${method}`, ref && `Ref: ${ref}`].filter(Boolean).join(" · "),
      section,
      sortOrder: order,
      requirePhoto: /^E|^D/.test(section),
    });
  }
  if (!items.length) return null;
  const t = await prisma.checklistTemplate.create({
    data: {
      name: ACTIVITY_TEMPLATE_NAME,
      category: "Civil / Structural",
      checklistType: "ActivityInspection",
      source: "SPDC_Activity_Inspection_Checklist_Format.xlsx",
      instructions:
        "Enclose with the Request for Inspection (SPDC/QA/F-01). Record the actual reading, not just OK. Not OK must be cleared and re-verified; NA needs a one-line reason.",
      requirePhotosMin: 2,
      items: { create: items },
    },
  });
  return { created: true, items: items.length, templateId: t.id };
}
