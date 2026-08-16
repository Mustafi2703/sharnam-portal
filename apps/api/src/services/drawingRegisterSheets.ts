/**
 * Parse DRAWING REGISTER - 01.xlsx for dashboard KPIs.
 */
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

function n(v: unknown) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function resolveDrawingRegisterPath(): string | null {
  const candidates = [
    process.env.SHARNAM_EXCEL_ROOT
      ? path.join(process.env.SHARNAM_EXCEL_ROOT, "DRAWING REGISTER - 01.xlsx")
      : "",
    path.join(process.cwd(), "seed", "data", "DRAWING REGISTER - 01.xlsx"),
    path.join(process.cwd(), "Sharnam_modules_docs", "DRAWING REGISTER - 01.xlsx"),
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export type DrawingRegisterDashboard = {
  weekLabel: string;
  totalDrawings: number;
  gfcCount: number;
  criticalCount: number;
  delayedCount: number;
  source: string;
};

export function loadDrawingRegisterDashboard(): DrawingRegisterDashboard | null {
  const file = resolveDrawingRegisterPath();
  if (!file) return null;
  const wb = XLSX.readFile(file);
  const master = wb.SheetNames.find((n) => /Master Drawing Register/i.test(n));
  if (!master) return null;
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[master], {
    header: 1,
    defval: "",
  }) as unknown[][];
  let weekLabel = "Week #";
  for (const r of rows.slice(0, 10)) {
    const label = String(r[1] ?? r[0] ?? "");
    const m = label.match(/Week\s*#?\s*(\d+)/i);
    if (m) weekLabel = `Week ${m[1]}`;
  }
  const headerIdx = rows.findIndex((r) => String(r[0] ?? "").trim() === "Sr #");
  let totalDrawings = 0;
  let gfcCount = 0;
  let criticalCount = 0;
  let delayedCount = 0;
  for (let i = (headerIdx >= 0 ? headerIdx : 5) + 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const sn = n(r[0]);
    const num = String(r[4] ?? "").trim();
    if (!sn || !num) continue;
    totalDrawings++;
    if (/gfc|good for construction/i.test(String(r[6] ?? ""))) gfcCount++;
    if (/yes/i.test(String(r[19] ?? ""))) criticalCount++;
    if (n(r[14]) > 0) delayedCount++;
  }
  return {
    weekLabel,
    totalDrawings,
    gfcCount,
    criticalCount,
    delayedCount,
    source: path.basename(file),
  };
}
