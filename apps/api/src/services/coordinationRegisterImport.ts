/**
 * Import a Design Coordination Register workbook (the same columns the portal exports).
 * Rows match existing issues by title — no duplicates. Imports never send email and never
 * change follow-up counts or RFI escalations.
 */
import * as XLSX from "xlsx";
import { prisma } from "../prisma.js";

type Col = "title" | "description" | "discipline" | "drawing" | "priority" | "assignee" | "ballInCourt" | "dueDate" | "status";

const HEADER_ALIASES: Record<Col, string[]> = {
  title: ["issue", "title", "issue title"],
  description: ["description", "details"],
  discipline: ["drawing type", "discipline"],
  drawing: ["linked drawing", "drawing", "drawing no", "drawing number", "dwg no"],
  priority: ["priority"],
  assignee: ["assigned to", "assignee"],
  ballInCourt: ["ball in court"],
  dueDate: ["due date", "target date"],
  status: ["status"],
};

function norm(v: unknown) {
  return String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function toDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    const parsed = XLSX.SSF.parse_date_code(v);
    return parsed ? new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)) : null;
  }
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function importCoordinationRegister(projectId: string, buf: Buffer) {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });

  // Find the sheet + header row that has an "Issue" column.
  let rows: unknown[][] = [];
  let headerIdx = -1;
  for (const name of wb.SheetNames) {
    const r = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: "", raw: true });
    const idx = r.findIndex((row) => row.slice(0, 30).some((c) => HEADER_ALIASES.title.includes(norm(c))));
    if (idx >= 0) {
      rows = r;
      headerIdx = idx;
      break;
    }
  }
  if (headerIdx < 0) {
    throw new Error('No "Issue" column found. Use the Design Coordination Register export as the template.');
  }

  const header = rows[headerIdx].map(norm);
  const colIndex = {} as Record<Col, number>;
  (Object.keys(HEADER_ALIASES) as Col[]).forEach((col) => {
    colIndex[col] = header.findIndex((h) => HEADER_ALIASES[col].includes(h));
  });
  const cell = (row: unknown[], col: Col) => (colIndex[col] >= 0 ? row[colIndex[col]] : "");

  const [existing, drawings] = await Promise.all([
    prisma.designCoordinationIssue.findMany({ where: { projectId } }),
    prisma.drawing.findMany({ where: { projectId }, select: { id: true, drawingNumber: true } }),
  ]);
  const byTitle = new Map(existing.map((i) => [norm(i.title), i]));
  const drawingByNo = new Map(drawings.map((d) => [norm(d.drawingNumber), d.id]));

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const unmatchedDrawings: string[] = [];

  for (const row of rows.slice(headerIdx + 1)) {
    const title = String(cell(row, "title") ?? "").trim();
    if (!title || /^project management consultants/i.test(title)) {
      skipped += 1;
      continue;
    }

    const assigneeRaw = String(cell(row, "assignee") ?? "").trim();
    const assignee = /@/.test(assigneeRaw)
      ? { assignedToEmail: assigneeRaw.toLowerCase(), assignedToName: assigneeRaw }
      : assigneeRaw
        ? { assignedToName: assigneeRaw }
        : {};

    const drawingRaw = String(cell(row, "drawing") ?? "").trim();
    let linkedDrawingId: string | undefined;
    if (drawingRaw) {
      const dwgNo = drawingRaw.replace(/\s*\(.*\)\s*$/, "");
      linkedDrawingId = drawingByNo.get(norm(dwgNo));
      if (!linkedDrawingId) unmatchedDrawings.push(dwgNo);
    }

    const statusRaw = norm(cell(row, "status"));
    // Escalated rows need a real RFI — imports may only open or close.
    const status = statusRaw === "closed" ? "Closed" : statusRaw === "open" ? "Open" : undefined;

    const data = {
      title,
      description: String(cell(row, "description") ?? "").trim() || undefined,
      discipline: String(cell(row, "discipline") ?? "").trim() || undefined,
      priority: String(cell(row, "priority") ?? "").trim() || undefined,
      ballInCourt: String(cell(row, "ballInCourt") ?? "").trim() || undefined,
      dueDate: toDate(cell(row, "dueDate")) ?? undefined,
      linkedDrawingId,
      ...assignee,
    };

    const match = byTitle.get(norm(title));
    if (match) {
      await prisma.designCoordinationIssue.update({
        where: { id: match.id },
        data: { ...data, ...(status && match.status !== "Escalated" ? { status } : {}) },
      });
      updated += 1;
    } else {
      const row = await prisma.designCoordinationIssue.create({
        data: { projectId, ...data, status: status || "Open" },
      });
      byTitle.set(norm(title), row);
      created += 1;
    }
  }

  return { created, updated, skipped, unmatchedDrawings: [...new Set(unmatchedDrawings)].slice(0, 20) };
}
