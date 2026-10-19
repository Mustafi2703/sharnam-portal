import fs from "fs/promises";
import path from "path";
import { prisma } from "../prisma.js";

export const DEFAULT_CONSULTANT_TYPES = [
  "Structural Consultant",
  "MEP Consultant",
  "Architectural Consultant",
  "Landscape Consultant",
  "Geotechnical Consultant",
  "PMC Partner",
  "Third-Party Reviewer",
  "Project Consultant",
  "Fire & Safety Consultant",
  "Facade Consultant",
];

const SETTING_KEY = "consultantTypes";

function catalogPath() {
  return path.join(process.cwd(), "data", "consultant-type-catalog.json");
}

function normalize(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function uniq(types: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of types) {
    const name = normalize(raw);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/** Older builds wrote the list to disk. A Hostinger rebuild deletes that file. */
async function readLegacyFile(): Promise<string[]> {
  try {
    const raw = await fs.readFile(catalogPath(), "utf8");
    const parsed = JSON.parse(raw) as { types?: unknown };
    return Array.isArray(parsed?.types) ? parsed.types.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function readDb(): Promise<string[] | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.value) as { types?: unknown };
    return Array.isArray(parsed?.types) ? parsed.types.map(String) : [];
  } catch {
    return null;
  }
}

async function save(types: string[]) {
  const value = JSON.stringify({ types: uniq(types) });
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value },
    update: { value },
  });
}

/** Types already chosen on a company survive even when the old file is gone. */
async function tradesOnCompanies(): Promise<string[]> {
  const rows = await prisma.vendor.findMany({
    where: {
      partyType: { in: ["Consultant", "PMC", "Designer"] },
      trade: { not: null },
    },
    select: { trade: true },
  });
  return rows.map((row) => row.trade || "");
}

export async function getConsultantTypes(): Promise<string[]> {
  const stored = await readDb();
  if (stored) return uniq(stored);

  const file = await readLegacyFile();
  let trades: string[] = [];
  try {
    trades = await tradesOnCompanies();
  } catch {
    if (file.length) return uniq(file);
    return [...DEFAULT_CONSULTANT_TYPES];
  }
  // A saved file is their list. Do not add the built-in names back on top of it.
  // When the file was wiped by a rebuild, keep the built-in names plus any type already on a company.
  const base = file.length ? file : [...DEFAULT_CONSULTANT_TYPES];
  const recovered = uniq([...base, ...trades]);
  await save(recovered);
  return recovered;
}

export async function addConsultantType(name: string): Promise<string[]> {
  const trimmed = normalize(name);
  if (!trimmed) throw new Error("Consultant type required");
  const current = await getConsultantTypes();
  if (current.some((t) => t.toLowerCase() === trimmed.toLowerCase())) return current;
  await save([...current, trimmed]);
  return getConsultantTypes();
}

export async function renameConsultantType(from: string, to: string): Promise<string[]> {
  const src = normalize(from);
  const dest = normalize(to);
  if (!src || !dest) throw new Error("Current and new type names required");
  const current = await getConsultantTypes();
  if (!current.some((t) => t.toLowerCase() === src.toLowerCase())) {
    throw new Error("Consultant type not found");
  }
  if (current.some((t) => t.toLowerCase() === dest.toLowerCase() && t.toLowerCase() !== src.toLowerCase())) {
    throw new Error("That consultant type already exists");
  }
  await save(current.map((t) => (t.toLowerCase() === src.toLowerCase() ? dest : t)));
  const companies = await prisma.vendor.findMany({
    where: { trade: { not: null } },
    select: { id: true, trade: true },
  });
  const ids = companies.filter((row) => (row.trade || "").trim().toLowerCase() === src.toLowerCase()).map((row) => row.id);
  if (ids.length) {
    await prisma.vendor.updateMany({ where: { id: { in: ids } }, data: { trade: dest } });
  }
  return getConsultantTypes();
}

export async function removeConsultantType(name: string): Promise<string[]> {
  const trimmed = normalize(name);
  if (!trimmed) throw new Error("Consultant type required");
  const current = await getConsultantTypes();
  await save(current.filter((t) => t.toLowerCase() !== trimmed.toLowerCase()));
  return getConsultantTypes();
}
