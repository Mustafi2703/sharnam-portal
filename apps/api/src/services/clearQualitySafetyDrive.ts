/**
 * Remove generated Quality / Safety workbooks from the project's mock OneDrive tree
 * (live + Weekly packs under ISO 08). Does not touch drawings or cost folders.
 */
import fs from "fs";
import path from "path";

const QUALITY_SAFETY_PREFIXES = [
  "08_QUALITY_HSE_AND_ENVIRONMENT",
];

function walkFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

export async function clearQualitySafetyDriveFiles(projectCode: string): Promise<number> {
  const uploadRoot = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
  const projectRoot = path.join(uploadRoot, "onedrive", projectCode);
  if (!fs.existsSync(projectRoot)) return 0;

  let removed = 0;
  for (const prefix of QUALITY_SAFETY_PREFIXES) {
    const folder = path.join(projectRoot, prefix);
    for (const file of walkFiles(folder)) {
      try {
        fs.unlinkSync(file);
        removed += 1;
      } catch {
        /* ignore locked files */
      }
    }
  }
  return removed;
}
