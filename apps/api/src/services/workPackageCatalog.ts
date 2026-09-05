import fs from "fs/promises";
import path from "path";
import { prisma } from "../prisma.js";

const DEFAULT_PACKAGES = ["Civil", "PEB", "MEP", "Fire Fighting", "Electrical", "Plumbing", "HVAC", "Landscape"];

function catalogPath() {
  return path.join(process.cwd(), "data", "work-package-catalog.json");
}

async function readExtra(): Promise<string[]> {
  try {
    const raw = await fs.readFile(catalogPath(), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.packages) ? parsed.packages.map(String) : [];
  } catch {
    return [];
  }
}

async function writeExtra(packages: string[]) {
  const dir = path.dirname(catalogPath());
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(catalogPath(), JSON.stringify({ packages }, null, 2), "utf8");
}

export async function getWorkPackageCatalog(): Promise<string[]> {
  const extra = await readExtra();
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
  return [...new Set([...DEFAULT_PACKAGES, ...extra, ...fromProjects])].filter(Boolean).sort();
}

export async function addWorkPackageCatalogEntry(name: string): Promise<string[]> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Package name required");
  const extra = await readExtra();
  const next = [...new Set([...extra, trimmed])];
  await writeExtra(next);
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
