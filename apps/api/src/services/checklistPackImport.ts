/**
 * Parse client checklist-pack xlsx workbooks into template line items.
 * Layout matches SPDC HSE pack and Civil Quality checklists (S.NO + Description + YES/NO).
 */
import fs from "fs";
import XLSX from "../lib/xlsx.js";
import { prisma } from "../prisma.js";
import { findChecklistWorkbook } from "./checklistPackPaths.js";

export type ParsedPackItem = {
  section: string;
  itemCode: string;
  description: string;
  requirePhoto?: boolean;
  instruction?: string;
};

function cleanCell(v: unknown): string {
  return String(v ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCatalogName(name: string): string {
  return name
    .trim()
    .replace(/\u00fb/g, "-")
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^Checklist For\s+/i, "")
    .replace(/^PD\s+/i, "")
    .replace(/^PC\s+/i, "");
}

/** Parse rows from a pack workbook sheet (first sheet with items). */
export function parseChecklistPackSheet(rows: unknown[][]): ParsedPackItem[] {
  const items: ParsedPackItem[] = [];
  let currentSection = "General";
  let itemCounter = 0;
  const looksLikeSectionHeader = (s: string) =>
    /^[A-Z]\.\s+/.test(s) || (s.length < 90 && /^[A-Z][A-Z0-9\s&,'()./\-]{2,}$/.test(s));

  for (const raw of rows) {
    if (!raw?.length) continue;
    const a = cleanCell(raw[0]);
    const b = cleanCell(raw[1]);
    const c = cleanCell(raw[2]);

    if (!a && b && looksLikeSectionHeader(b)) {
      currentSection = b;
      continue;
    }
    if (a && looksLikeSectionHeader(a) && !b) {
      currentSection = a;
      continue;
    }

    const sr = Number(a);
    const description = b || c;
    if (!description || /^(yes|no|n\.?a\.?|remarks|s\.?no\.?)$/i.test(description)) continue;
    if (!sr && !/checklist|inspection|project name|report no/i.test(description)) {
      if (looksLikeSectionHeader(description)) {
        currentSection = description;
      }
      continue;
    }
    if (!sr) continue;

    itemCounter++;
    items.push({
      section: currentSection,
      itemCode: String(sr),
      description,
      requirePhoto: /photo|image|attach/i.test(description),
    });
  }
  return items;
}

export function parseChecklistPackFile(filePath: string): ParsedPackItem[] {
  const wb = XLSX.readFile(filePath);
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, defval: "" });
    const items = parseChecklistPackSheet(rows);
    if (items.length >= 3) return items;
  }
  return [];
}

/** Resolve workbook for template name with fuzzy normalization. */
export function resolvePackWorkbook(templateName: string): string | null {
  const direct = findChecklistWorkbook(templateName);
  if (direct) return direct;
  const norm = normalizeCatalogName(templateName);
  return findChecklistWorkbook(norm) || findChecklistWorkbook(`Checklist For ${norm}`);
}

/** Replace template items from matching pack workbook (idempotent by sortOrder). */
export async function refreshTemplateItemsFromPack(templateId: string) {
  const template = await prisma.checklistTemplate.findUnique({
    where: { id: templateId },
    include: { items: true },
  });
  if (!template) throw new Error("Template not found");

  const workbookPath = resolvePackWorkbook(template.name);
  if (!workbookPath || !fs.existsSync(workbookPath)) {
    throw new Error(`No pack workbook found for "${template.name}" — check seed/checklist-pack/`);
  }

  const parsed = parseChecklistPackFile(workbookPath);
  if (!parsed.length) throw new Error(`Workbook parsed but no line items found: ${workbookPath}`);

  await prisma.$transaction(async (tx) => {
    await tx.checklistItem.deleteMany({ where: { templateId } });
    for (let i = 0; i < parsed.length; i++) {
      const row = parsed[i]!;
      await tx.checklistItem.create({
        data: {
          templateId,
          sortOrder: i + 1,
          itemCode: row.itemCode,
          description: row.description,
          section: row.section,
          requirePhoto: row.requirePhoto || false,
          instruction: row.instruction || null,
        },
      });
    }
  });

  return { templateId, templateName: template.name, workbookPath, itemCount: parsed.length };
}
