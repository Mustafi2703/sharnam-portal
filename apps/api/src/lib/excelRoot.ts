import fs from "fs";
import path from "path";

/** Same resolution as `seed/seed.ts` — bundled workbooks under seed/data when env unset. */
export function resolveExcelRoot(): string {
  if (process.env.SHARNAM_EXCEL_ROOT) return path.resolve(process.env.SHARNAM_EXCEL_ROOT);
  const bundled = path.resolve(process.cwd(), "seed/data");
  if (fs.existsSync(bundled)) return bundled;
  return process.cwd();
}
