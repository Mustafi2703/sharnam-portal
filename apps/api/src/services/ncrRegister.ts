/**
 * NCR 01 .xlsx → "NCR REGISTER" sheet: the register of every NCR / CAR on a project, in the client's layout
 * (header row 4, data from row 5, the sheet's own Type / Location / Status pick-lists kept). Also reads it back in.
 */
import ExcelJS from "exceljs";
import XLSX from "../lib/xlsx.js";
import { prisma } from "../prisma.js";
import { detachSharedStyles } from "../lib/excelTemplate.js";
import { resolveNcrTemplatePath } from "./ncrFormExport.js";

const FIRST = 5;
const LAST_SAMPLE = 99;

export type NcrRegisterKind = "NCR" | "CAR" | "ALL";

/** CAR rows are the ones numbered CAR-… or typed "Corrective Action"; everything else is an NCR. */
export function isCarRow(n: { number?: string | null; ncrType?: string | null }): boolean {
  return /^CAR/i.test(String(n.number || "")) || /corrective/i.test(String(n.ncrType || ""));
}

export const NCR_REGISTER_TITLE: Record<NcrRegisterKind, string> = {
  NCR: "NON CONFORMANCE REPORT (NCR) REGISTER",
  CAR: "CORRECTIVE ACTION REQUEST (CAR) REGISTER",
  ALL: "NON CONFORMANCE AND CORRECTIVE ACTION REGISTER",
};

/**
 * The register in the client's NCR 01 "NCR REGISTER" layout. `kind` picks the report the register is kept for:
 * NCR register (NCRs only), CAR register (CARs only) or the combined view.
 */
export async function buildNcrRegisterXlsx(projectId: string, kind: NcrRegisterKind = "ALL"): Promise<Buffer> {
  const all = await prisma.qualityNcr.findMany({ where: { projectId }, orderBy: [{ issueDate: "asc" }, { createdAt: "asc" }] });
  const ncrs = kind === "ALL" ? all : all.filter((n) => (kind === "CAR" ? isCarRow(n) : !isCarRow(n)));
  const tpl = resolveNcrTemplatePath("NCR 01 .xlsx");
  const wb = new ExcelJS.Workbook();
  if (tpl) await wb.xlsx.readFile(tpl);
  detachSharedStyles(wb);
  let ws = wb.worksheets.find((w) => /ncr\s*register/i.test(w.name));
  if (!ws) {
    ws = wb.addWorksheet("NCR REGISTER");
    ws.getCell("A2").value = "NON CONFORMANCE AND CORRECTIVE ACTION REGISTER";
    ["No.", "NCR Issue Date", "Type", "Contractor", "Brief Description of Non Conformance", "Location", "Planned Closure Date", "Actual Closure Date", "Status"].forEach(
      (h, i) => (ws!.getCell(4, i + 1).value = h),
    );
  }
  // The register file carries the register only — the single-NCR form sheet is downloaded per NCR.
  for (const other of [...wb.worksheets]) if (other.id !== ws.id) wb.removeWorksheet(other.id);
  // Title row (row 2 in the template) names the register being kept.
  for (let r = 1; r <= 3; r++) {
    for (let c = 1; c <= 9; c++) {
      const cell = ws.getCell(r, c);
      if (typeof cell.value === "string" && /register/i.test(cell.value)) cell.value = NCR_REGISTER_TITLE[kind];
    }
  }
  for (let r = FIRST; r <= LAST_SAMPLE; r++) for (let c = 1; c <= 9; c++) ws.getCell(r, c).value = null;
  ncrs.forEach((n, i) => {
    const r = FIRST + i;
    const day = (d?: Date | null) => (d ? new Date(d) : null);
    ws!.getCell(r, 1).value = n.number || i + 1;
    ws!.getCell(r, 2).value = day(n.issueDate);
    ws!.getCell(r, 3).value = n.ncrType || (isCarRow(n) ? "Corrective Action" : "General");
    ws!.getCell(r, 4).value = n.contractor || "";
    ws!.getCell(r, 5).value = n.description;
    ws!.getCell(r, 6).value = n.location || "";
    ws!.getCell(r, 7).value = day(n.plannedClosure);
    ws!.getCell(r, 8).value = day(n.actualClosure);
    ws!.getCell(r, 9).value = /clos/i.test(n.status || "") ? "Close" : "Open";
    for (const c of [2, 7, 8]) ws!.getCell(r, c).numFmt = "dd-mmm-yy";
    ws!.getCell(r, 5).alignment = { wrapText: true, vertical: "top" };
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function cellDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number" && v > 20000) {
    const t = new Date(Date.UTC(1899, 11, 30));
    t.setUTCDate(t.getUTCDate() + Math.floor(v));
    return t;
  }
  const t = new Date(String(v));
  return Number.isNaN(t.getTime()) ? null : t;
}

export async function importNcrRegister(projectId: string, buffer: Buffer): Promise<{ created: number; updated: number; skipped: number }> {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const name = wb.SheetNames.find((n) => /ncr\s*register|car\s*register/i.test(n)) || wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: "", raw: true }) as unknown[][];
  const hi = rows.findIndex((r) => /^no\.?$/i.test(String(r[0] ?? "").trim()) && /issue/i.test(String(r[1] ?? "")));
  const out = { created: 0, updated: 0, skipped: 0 };
  if (hi < 0) return out;
  for (const r of rows.slice(hi + 1)) {
    const desc = String(r[4] ?? "").trim();
    const noRaw = String(r[0] ?? "").trim();
    if (!desc) {
      if (noRaw) out.skipped++;
      continue;
    }
    if (/^(health|environment|quality|general)/i.test(noRaw) && !desc) continue;
    const number = /^\d+$/.test(noRaw) ? `NCR-${noRaw.padStart(2, "0")}` : noRaw || null;
    const status = /clos/i.test(String(r[8] ?? "")) ? "Closed" : "Open";
    const data = {
      issueDate: cellDate(r[1]),
      ncrType: String(r[2] ?? "").trim() || null,
      contractor: String(r[3] ?? "").trim() || null,
      description: desc,
      location: String(r[5] ?? "").trim() || null,
      plannedClosure: cellDate(r[6]),
      actualClosure: cellDate(r[7]),
      status,
    };
    const existing = number ? await prisma.qualityNcr.findFirst({ where: { projectId, number }, select: { id: true } }) : null;
    if (existing) {
      await prisma.qualityNcr.update({ where: { id: existing.id }, data });
      out.updated++;
    } else {
      await prisma.qualityNcr.create({ data: { projectId, number, source: "import", ...data } });
      out.created++;
    }
  }
  return out;
}
