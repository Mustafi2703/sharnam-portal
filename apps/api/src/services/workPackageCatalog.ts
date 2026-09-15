import fs from "fs/promises";
import path from "path";
import { prisma } from "../prisma.js";
import { COMPARATIVE_DISCIPLINES } from "./comparativeStatement.js";

/** R2 comparative sheet names — bid desk only, not org work-package catalogue. */
const R2_BID_LABELS = new Set(COMPARATIVE_DISCIPLINES.map((d) => d.label.toLowerCase()));

function isBidDisciplineCatalogName(name: string) {
  return R2_BID_LABELS.has(name.trim().toLowerCase());
}

/** Org-wide default catalogue — generic trades, not Sanika R2 bid sheet names. */
export const SPDC_DEFAULT_WORK_PACKAGES = [
  "Civil",
  "PEB",
  "MEP",
  "Fire Fighting",
  "Electrical",
  "Plumbing",
  "HVAC",
  "Landscape",
] as const;

const DEFAULT_PACKAGES = [...SPDC_DEFAULT_WORK_PACKAGES];

function catalogPath() {
  return path.join(process.cwd(), "data", "work-package-catalog.json");
}

type CatalogFile = { packages?: string[]; hidden?: string[] };

async function readCatalogFile(): Promise<{ extra: string[]; hidden: string[] }> {
  try {
    const raw = await fs.readFile(catalogPath(), "utf8");
    const parsed = JSON.parse(raw) as CatalogFile;
    const extra = Array.isArray(parsed?.packages) ? parsed.packages.map(String).filter(Boolean) : [];
    const hidden = Array.isArray(parsed?.hidden) ? parsed.hidden.map(String).filter(Boolean) : [];
    return { extra, hidden };
  } catch {
    return { extra: [], hidden: [] };
  }
}

async function writeCatalogFile(extra: string[], hidden: string[]) {
  const dir = path.dirname(catalogPath());
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(catalogPath(), JSON.stringify({ packages: extra, hidden }, null, 2), "utf8");
}

function withoutHidden(names: string[], hiddenLower: Set<string>) {
  return names.filter((p) => p && !hiddenLower.has(p.toLowerCase()) && !isBidDisciplineCatalogName(p));
}

export async function getWorkPackageCatalog(): Promise<string[]> {
  const { extra, hidden } = await readCatalogFile();
  const hiddenLower = new Set(hidden.map((h) => h.toLowerCase()));
  const projects = await prisma.project.findMany({ select: { workPackages: true } });
  const fromProjects: string[] = [];
  for (const p of projects) {
    try {
      const parsed = JSON.parse(p.workPackages || "[]");
      if (Array.isArray(parsed)) fromProjects.push(...parsed.map(String));
    } catch {
      /* ignore */
    }
  }
  return [
    ...new Set(
      withoutHidden([...DEFAULT_PACKAGES, ...extra, ...fromProjects], hiddenLower),
    ),
  ]
    .filter(Boolean)
    .sort();
}

export async function addWorkPackageCatalogEntry(name: string): Promise<string[]> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Package name required");
  const { extra, hidden } = await readCatalogFile();
  const nextExtra = [...new Set([...extra, trimmed])];
  const nextHidden = hidden.filter((h) => h.toLowerCase() !== trimmed.toLowerCase());
  await writeCatalogFile(nextExtra, nextHidden);
  return getWorkPackageCatalog();
}

export async function removeWorkPackageCatalogEntry(name: string): Promise<string[]> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Package name required");
  const { extra, hidden } = await readCatalogFile();
  const nextExtra = extra.filter((p) => p.toLowerCase() !== trimmed.toLowerCase());
  const nextHidden = hidden.some((h) => h.toLowerCase() === trimmed.toLowerCase())
    ? hidden
    : [...hidden, trimmed];
  await writeCatalogFile(nextExtra, nextHidden);
  return getWorkPackageCatalog();
}

export function parseProjectWorkPackages(raw?: string | null): string[] {
  if (!raw) return ["Civil", "PEB"];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p.map(String).filter(Boolean) : ["Civil", "PEB"];
  } catch {
    return ["Civil", "PEB"];
  }
}
