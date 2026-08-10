/**
 * Custom Sheet Maker — upload Excel/CSV, edit with formulas, export back to .xlsx.
 */
import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import {
  type SheetCell,
  migrateRows,
  evaluateAllRows,
  sheetCellsToAoa,
  applyFormulasToWorksheet,
  isFormula,
} from "@sharnam/shared";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { mockOneDrive } from "../services/mockOneDrive.js";
import { audit } from "../services/audit.js";

export const customSheetsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
customSheetsRouter.use(requireAuth);

function parseSheetWithFormulas(sheet: XLSX.WorkSheet): { headers: string[]; rows: SheetCell[][] } {
  const ref = sheet["!ref"];
  if (!ref) return { headers: [], rows: [] };
  const range = XLSX.utils.decode_range(ref);
  const headers: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: range.s.r, c });
    const cell = sheet[addr] as XLSX.CellObject | undefined;
    headers.push(cell?.v != null && String(cell.v).trim() ? String(cell.v) : `Column ${c - range.s.c + 1}`);
  }

  const rows: SheetCell[][] = [];
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const row: SheetCell[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr] as XLSX.CellObject | undefined;
      if (cell?.f) {
        const formula = cell.f.startsWith("=") ? cell.f : `=${cell.f}`;
        const cv = cell.v;
        const computed =
          typeof cv === "number" || typeof cv === "string" ? cv : cv != null ? String(cv) : null;
        row.push({ raw: formula, computed });
      } else if (cell?.v != null) {
        row.push({ raw: String(cell.v) });
      } else {
        row.push({ raw: "" });
      }
    }
    rows.push(row);
  }
  return { headers, rows: evaluateAllRows(rows) };
}

function parseRowsJson(json: string): SheetCell[][] {
  try {
    const parsed = JSON.parse(json || "[]");
    if (!Array.isArray(parsed)) return [];
    return evaluateAllRows(migrateRows(parsed));
  } catch {
    return [];
  }
}

function buildWorksheet(headers: string[], rows: SheetCell[][]): XLSX.WorkSheet {
  const evaluated = evaluateAllRows(rows);
  const { data, formulas } = sheetCellsToAoa(headers, evaluated);
  const ws = XLSX.utils.aoa_to_sheet(data);
  applyFormulasToWorksheet(ws as Record<string, unknown>, formulas);
  return ws;
}

customSheetsRouter.get("/", async (req, res) => {
  const projectId = req.query.projectId ? String(req.query.projectId) : undefined;
  const rows = await prisma.customSheet.findMany({
    where: projectId ? { projectId } : {},
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, category: true, projectId: true, sourceFile: true, createdAt: true, updatedAt: true, headersJson: true },
  });
  res.json(rows.map((r) => ({ ...r, headers: JSON.parse(r.headersJson || "[]") })));
});

customSheetsRouter.get("/:id", async (req, res) => {
  const row = await prisma.customSheet.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "not found" });
  const headers = JSON.parse(row.headersJson || "[]");
  const rows = parseRowsJson(row.rowsJson);
  res.json({ ...row, headers, rows });
});

customSheetsRouter.post("/upload", requireRoles("admin", "office"), upload.single("file"), async (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ error: "file required" });
  const name = String(req.body.name || req.file.originalname).trim();
  const category = String(req.body.category || "General");
  const projectId = req.body.projectId ? String(req.body.projectId) : null;
  const sheetName = req.body.sheet ? String(req.body.sheet) : undefined;

  const wb = XLSX.read(req.file.buffer, { type: "buffer" });
  const targetSheetName = sheetName && wb.Sheets[sheetName] ? sheetName : wb.SheetNames[0];
  const target = wb.Sheets[targetSheetName];
  const { headers, rows } = parseSheetWithFormulas(target);

  let storagePath: string | undefined;
  if (projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project) {
      const saved = await mockOneDrive.upload(
        project.code,
        "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.18_Management_Review_and_Audit_Programme",
        `${name.replace(/[^a-zA-Z0-9._-]/g, "_")}-${Date.now()}.xlsx`,
        req.file.buffer
      );
      storagePath = saved.path;
    }
  }

  const row = await prisma.customSheet.create({
    data: {
      projectId,
      name,
      category,
      headersJson: JSON.stringify(headers),
      rowsJson: JSON.stringify(rows),
      sourceFile: req.file.originalname,
      storagePath: storagePath || null,
      createdById: req.user!.id,
    },
  });
  const formulaCount = rows.flat().filter((c) => isFormula(c.raw)).length;
  await audit("customsheet.upload", {
    userId: req.user!.id,
    entity: "CustomSheet",
    entityId: row.id,
    meta: { rows: rows.length, headers: headers.length, formulas: formulaCount },
  });
  res.status(201).json({ id: row.id, name: row.name, headers, rowCount: rows.length, formulaCount, storagePath });
});

customSheetsRouter.post("/blank", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const name = String(req.body.name || "").trim() || `Untitled sheet — ${new Date().toISOString().slice(0, 10)}`;
  const category = String(req.body.category || "General");
  const projectId = req.body.projectId ? String(req.body.projectId) : null;
  const rawHeaders =
    Array.isArray(req.body.headers) && req.body.headers.length
      ? (req.body.headers as unknown[]).map((h, i) => String(h ?? "").trim() || `Column ${i + 1}`)
      : ["Column 1", "Column 2", "Column 3"];

  const row = await prisma.customSheet.create({
    data: {
      projectId,
      name,
      category,
      headersJson: JSON.stringify(rawHeaders),
      rowsJson: JSON.stringify([]),
      sourceFile: null,
      storagePath: null,
      createdById: req.user!.id,
    },
  });
  await audit("customsheet.create", {
    userId: req.user!.id,
    entity: "CustomSheet",
    entityId: row.id,
    meta: { headers: rawHeaders.length, source: "blank" },
  });
  res.status(201).json({ id: row.id, name: row.name, headers: rawHeaders, rowCount: 0 });
});

customSheetsRouter.put("/:id", requireRoles("admin", "office"), async (req, res) => {
  const rows = req.body.rows ? evaluateAllRows(migrateRows(req.body.rows)) : undefined;
  const row = await prisma.customSheet.update({
    where: { id: req.params.id },
    data: {
      name: req.body.name || undefined,
      category: req.body.category || undefined,
      headersJson: req.body.headers ? JSON.stringify(req.body.headers) : undefined,
      rowsJson: rows ? JSON.stringify(rows) : undefined,
    },
  });
  res.json(row);
});

customSheetsRouter.post("/:id/export", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const row = await prisma.customSheet.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "not found" });
  const headers = JSON.parse(row.headersJson || "[]");
  const rows = parseRowsJson(row.rowsJson);
  const ws = buildWorksheet(headers, rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, row.name.slice(0, 30));
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

  if (row.projectId) {
    const project = await prisma.project.findUnique({ where: { id: row.projectId } });
    if (project) {
      await mockOneDrive.upload(
        project.code,
        "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.18_Management_Review_and_Audit_Programme",
        `${row.name.replace(/[^a-zA-Z0-9._-]/g, "_")}-${Date.now()}.xlsx`,
        buf
      );
    }
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${row.name}.xlsx"`);
  res.send(buf);
});

customSheetsRouter.delete("/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  await prisma.customSheet.delete({ where: { id: req.params.id } });
  await audit("customsheet.delete", { userId: req.user!.id, entity: "CustomSheet", entityId: req.params.id });
  res.json({ ok: true });
});
