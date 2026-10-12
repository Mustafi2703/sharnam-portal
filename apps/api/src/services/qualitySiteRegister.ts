/**
 * Site Observation / Site Instruction register — branded Excel download and the same layout read back in.
 * Columns: Sr · Date · Title · Description · Location · Severity · Issued to · Status · Closed on · Corrective action · Photos.
 */
import ExcelJS from "exceljs";
import XLSX from "../lib/xlsx.js";
import { prisma } from "../prisma.js";

const HEAD = ["Sr", "Date", "Observation / instruction", "Description", "Location", "Severity", "Issued to", "Status", "Closed on", "Corrective action", "Photos"];
const NAVY = "FF1F3864";

export async function buildSiteRecordsXlsx(projectId: string, recordType: string): Promise<Buffer> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true, code: true, clientName: true, contractorName: true } });
  const rows = await prisma.qualitySiteRecord.findMany({ where: { projectId, recordType }, orderBy: { occurredAt: "asc" } });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(recordType.slice(0, 31), { views: [{ state: "frozen", ySplit: 6 }] });
  ws.columns = [6, 13, 34, 44, 18, 11, 20, 10, 13, 36, 8].map((width) => ({ width }));
  ws.mergeCells(1, 3, 1, 11);
  ws.getCell(1, 3).value = `${recordType.toUpperCase()} REGISTER`;
  ws.getCell(1, 3).font = { bold: true, size: 14, color: { argb: NAVY } };
  ws.getRow(1).height = 36;
  const meta: [string, string][] = [
    ["Project", project?.name || project?.code || ""],
    ["Client", project?.clientName || ""],
    ["Contractor", project?.contractorName || ""],
  ];
  meta.forEach(([k, v], i) => {
    ws.getCell(2 + i, 3).value = k;
    ws.getCell(2 + i, 3).font = { bold: true };
    ws.mergeCells(2 + i, 4, 2 + i, 11);
    ws.getCell(2 + i, 4).value = v;
  });
  HEAD.forEach((h, i) => {
    const c = ws.getCell(6, i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    c.alignment = { wrapText: true, vertical: "middle" };
  });
  rows.forEach((r, i) => {
    let photos = 0;
    try {
      photos = r.photosJson ? (JSON.parse(r.photosJson) as unknown[]).length : 0;
    } catch {
      photos = 0;
    }
    const row = ws.getRow(7 + i);
    row.values = [i + 1, r.occurredAt, r.title, r.description || "", r.location || "", r.severity || "", r.issuedTo || "", r.status, r.closedAt || "", r.correctiveAction || "", photos];
    row.getCell(2).numFmt = "dd-mmm-yy";
    row.getCell(9).numFmt = "dd-mmm-yy";
    row.alignment = { wrapText: true, vertical: "top" };
    const st = row.getCell(8);
    st.fill = { type: "pattern", pattern: "solid", fgColor: { argb: /clos/i.test(r.status) ? "FFC6EFCE" : "FFFFEB9C" } };
  });
  // Pick-lists for anyone filling the sheet offline.
  const last = Math.max(7 + rows.length + 200, 300);
  for (let r = 7; r <= last; r++) {
    ws.getCell(r, 6).dataValidation = { type: "list", allowBlank: true, formulae: ['"Low,Medium,High,Critical"'] };
    ws.getCell(r, 8).dataValidation = { type: "list", allowBlank: true, formulae: ['"Open,Closed"'] };
  }
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

export async function importSiteRecords(projectId: string, recordType: string, buffer: Buffer, userId: string) {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: true }) as unknown[][];
  const hi = rows.findIndex((r) => /^sr/i.test(String(r[0] ?? "").trim()) && /date/i.test(String(r[1] ?? "")));
  const out = { created: 0, updated: 0, skipped: 0 };
  if (hi < 0) return out;
  for (const r of rows.slice(hi + 1)) {
    const title = String(r[2] ?? "").trim();
    if (!title) continue;
    const when = cellDate(r[1]) || new Date();
    const status = /clos/i.test(String(r[7] ?? "")) ? "Closed" : "Open";
    const data = {
      description: String(r[3] ?? "").trim() || null,
      location: String(r[4] ?? "").trim() || null,
      severity: String(r[5] ?? "").trim() || null,
      issuedTo: String(r[6] ?? "").trim() || null,
      status,
      closedAt: status === "Closed" ? cellDate(r[8]) || when : null,
      correctiveAction: String(r[9] ?? "").trim() || null,
    };
    // Same title on the same day = the same record (re-upload updates instead of duplicating).
    const dayStart = new Date(when);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const existing = await prisma.qualitySiteRecord.findFirst({ where: { projectId, recordType, title, occurredAt: { gte: dayStart, lt: dayEnd } }, select: { id: true } });
    if (existing) {
      await prisma.qualitySiteRecord.update({ where: { id: existing.id }, data });
      out.updated++;
    } else {
      await prisma.qualitySiteRecord.create({ data: { projectId, recordType, title, occurredAt: when, reportedById: userId, source: "import", ...data } });
      out.created++;
    }
  }
  return out;
}
