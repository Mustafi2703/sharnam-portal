/**
 * Onboard client checklist pack (docs/New folder / seed/checklist-pack)
 * into Quality or Safety masters — one template per workbook, lines from xlsx.
 */
import fs from "fs";
import path from "path";
import { prisma } from "../prisma.js";
import { resolveChecklistPackRoot } from "./checklistPackPaths.js";
import { parseChecklistPackFile } from "./checklistPackImport.js";

export type PackFamily = "QualityInspection" | "Safety" | "SiteExecution";

/** Folder name → family. HIRA / safety → Safety; otherwise Quality or Site based on target. */
export function familyForPackFolder(folderName: string, target: PackFamily = "QualityInspection"): PackFamily {
  const n = folderName.toLowerCase();
  if (/hira|safety|hse|work\s*permit|unsafe|observation/.test(n)) return "Safety";
  if (target === "SiteExecution") return "SiteExecution";
  if (target === "Safety") return "Safety";
  return "QualityInspection";
}

/**
 * Pack files unzipped without the UTF-8 flag decode Windows-1252 dashes / quotes as CP437
 * ("Fixing – Peb" → "Fixing û Peb"). Checklist names are English, so these glyphs are never intended.
 */
const CP437_MOJIBAKE: Array<[RegExp, string]> = [
  [/\s?û\s?/g, " – "],
  [/\s?ù\s?/g, " — "],
  [/Æ/g, "’"],
  [/æ/g, "‘"],
];
export function repairPackName(name: string): string {
  let out = name;
  for (const [re, to] of CP437_MOJIBAKE) out = out.replace(re, to);
  return out.replace(/\s{2,}/g, " ").trim();
}

/** Rename templates saved with CP437-garbled names; skipped when the clean name already exists in that family. */
export async function repairMojibakeTemplateNames(): Promise<number> {
  const broken = await prisma.checklistTemplate.findMany({
    where: { OR: [{ name: { contains: "û" } }, { name: { contains: "ù" } }, { name: { contains: "Æ" } }] },
    select: { id: true, name: true, checklistType: true },
  });
  let renamed = 0;
  for (const t of broken) {
    const name = repairPackName(t.name);
    if (name === t.name) continue;
    const clash = await prisma.checklistTemplate.findFirst({ where: { name, checklistType: t.checklistType }, select: { id: true } });
    if (clash) continue;
    await prisma.checklistTemplate.update({ where: { id: t.id }, data: { name } });
    renamed++;
  }
  return renamed;
}

function listPackWorkbooks(root: string): { folder: string; name: string; fullPath: string }[] {
  const out: { folder: string; name: string; fullPath: string }[] = [];
  for (const ent of fs.readdirSync(root, { withFileTypes: true })) {
    if (ent.name.startsWith(".")) continue;
    const full = path.join(root, ent.name);
    if (ent.isFile() && /\.xlsx$/i.test(ent.name)) {
      // Root files: HIRA → Safety; Final Index is catalog only
      if (/final\s*index/i.test(ent.name)) continue;
      const folder = /hira/i.test(ent.name) ? "HIRA" : "General";
      out.push({
        folder,
        name: repairPackName(ent.name.replace(/\.xlsx$/i, "")),
        fullPath: full,
      });
      continue;
    }
    if (!ent.isDirectory()) continue;
    const stack = [full];
    while (stack.length) {
      const dir = stack.pop()!;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const f = path.join(dir, e.name);
        if (e.isDirectory()) stack.push(f);
        else if (/\.xlsx$/i.test(e.name)) {
          out.push({
            folder: ent.name,
            name: repairPackName(e.name.replace(/\.xlsx$/i, "")),
            fullPath: f,
          });
        }
      }
    }
  }
  return out;
}

async function upsertTemplateFromWorkbook(opts: {
  name: string;
  folder: string;
  fullPath: string;
  family: PackFamily;
  projectId: string;
}) {
  const { name, folder, fullPath, family, projectId } = opts;
  let template = await prisma.checklistTemplate.findFirst({
    where: { name, checklistType: family },
  });
  let created = false;
  const parsed = parseChecklistPackFile(fullPath);
  const items =
    parsed.length >= 3
      ? parsed
      : [
          { itemCode: "1", description: `${name} — preliminary checks`, section: "Pre-checks", requirePhoto: true },
          { itemCode: "2", description: "Materials / method as per specification", section: "Execution", requirePhoto: false },
          { itemCode: "3", description: "Workmanship acceptable to PMC", section: "Execution", requirePhoto: false },
          { itemCode: "4", description: "HSE precautions observed", section: "Safety", requirePhoto: false },
          { itemCode: "5", description: "Ready for next activity / sign-off", section: "Close-out", requirePhoto: true },
        ];

  if (!template) {
    template = await prisma.checklistTemplate.create({
      data: {
        name,
        category: folder,
        checklistType: family,
        source: `checklist-pack · ${folder}`,
        requirePhotosMin: family === "Safety" || family === "QualityInspection" ? 3 : 0,
        instructions: `Onboarded from ${fullPath}. Fill from the module register; log is information-only.`,
        items: {
          create: items.map((row, i) => ({
            sortOrder: i + 1,
            itemCode: row.itemCode,
            description: row.description,
            section: row.section,
            requirePhoto: !!row.requirePhoto,
            instruction: ("instruction" in row ? row.instruction : null) || null,
          })),
        },
      },
    });
    created = true;
  } else if (parsed.length >= 3) {
    await prisma.$transaction(async (tx) => {
      await tx.checklistItem.deleteMany({ where: { templateId: template!.id } });
      for (let i = 0; i < items.length; i++) {
        const row = items[i]!;
        await tx.checklistItem.create({
          data: {
            templateId: template!.id,
            sortOrder: i + 1,
            itemCode: row.itemCode,
            description: row.description,
            section: row.section,
            requirePhoto: !!row.requirePhoto,
            instruction: ("instruction" in row ? row.instruction : null) || null,
          },
        });
      }
    });
  }

  await prisma.checklistAssignment.upsert({
    where: { projectId_templateId: { projectId, templateId: template.id } },
    create: { projectId, templateId: template.id },
    update: {},
  });

  return { name, family, created, itemCount: items.length, templateId: template.id };
}

/**
 * Onboard pack workbooks for a family (QualityInspection | Safety | SiteExecution).
 * Quality onboard includes SiteExecution folders when family=QualityInspection (merged into QI)
 * unless `siteOnly` is set — then only SiteExecution mapping folders.
 */
export async function onboardChecklistPack(opts: {
  projectId: string;
  family: PackFamily;
}) {
  const root = resolveChecklistPackRoot();
  if (!root) throw new Error("Checklist pack not found — expected docs/New folder or seed/checklist-pack");

  await repairMojibakeTemplateNames();
  const books = listPackWorkbooks(root);
  let created = 0;
  let refreshed = 0;
  let skipped = 0;
  const details: { name: string; family: string; created: boolean; itemCount: number }[] = [];

  for (const book of books) {
    const mapped = familyForPackFolder(book.folder, opts.family);
    if (opts.family === "Safety" && mapped !== "Safety") {
      skipped++;
      continue;
    }
    if (opts.family !== "Safety" && mapped === "Safety") {
      skipped++;
      continue;
    }

    const out = await upsertTemplateFromWorkbook({
      name: book.name,
      folder: book.folder,
      fullPath: book.fullPath,
      family: opts.family,
      projectId: opts.projectId,
    });
    if (out.created) created++;
    else refreshed++;
    details.push({ name: out.name, family: out.family, created: out.created, itemCount: out.itemCount });
  }

  return {
    packRoot: root,
    scanned: books.length,
    created,
    refreshed,
    skipped,
    assigned: created + refreshed,
    details,
  };
}
