import fs from "fs/promises";
import path from "path";

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

function catalogPath() {
  return path.join(process.cwd(), "data", "consultant-type-catalog.json");
}

async function readStored(): Promise<string[]> {
  try {
    const raw = await fs.readFile(catalogPath(), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.types) ? parsed.types.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function writeStored(types: string[]) {
  const dir = path.dirname(catalogPath());
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(catalogPath(), JSON.stringify({ types }, null, 2), "utf8");
}

function normalize(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export async function getConsultantTypes(): Promise<string[]> {
  const stored = await readStored();
  if (stored.length) return [...new Set(stored.map(normalize))].filter(Boolean).sort((a, b) => a.localeCompare(b));
  return [...DEFAULT_CONSULTANT_TYPES];
}

export async function addConsultantType(name: string): Promise<string[]> {
  const trimmed = normalize(name);
  if (!trimmed) throw new Error("Consultant type required");
  const current = await getConsultantTypes();
  if (current.some((t) => t.toLowerCase() === trimmed.toLowerCase())) return current;
  const next = [...current, trimmed];
  await writeStored(next);
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
  await writeStored(current.map((t) => (t.toLowerCase() === src.toLowerCase() ? dest : t)));
  return getConsultantTypes();
}

export async function removeConsultantType(name: string): Promise<string[]> {
  const trimmed = normalize(name);
  if (!trimmed) throw new Error("Consultant type required");
  const current = await getConsultantTypes();
  await writeStored(current.filter((t) => t.toLowerCase() !== trimmed.toLowerCase()));
  return getConsultantTypes();
}
