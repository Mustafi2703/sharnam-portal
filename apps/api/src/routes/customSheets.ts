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
import { MASTER_CATEGORY } from "../services/costMasterLines.js";

export const customSheetsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
customSheetsRouter.use(requireAuth);

const WRITE_ROLES = ["admin", "office", "employee"] as const;

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

function sheetStats(rows: SheetCell[][]) {
  return {
    rowCount: rows.length,
    formulaCount: rows.flat().filter((c) => isFormula(c.raw)).length,
  };
}

function buildWorksheet(headers: string[], rows: SheetCell[][]): XLSX.WorkSheet {
  const evaluated = evaluateAllRows(rows);
  const { data, formulas } = sheetCellsToAoa(headers, evaluated);
  const ws = XLSX.utils.aoa_to_sheet(data);
  applyFormulasToWorksheet(ws as Record<string, unknown>, formulas);
  return ws;
}

function readWorkbook(buffer: Buffer, fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) {
    const text = buffer.toString("utf8");
    const wb = XLSX.read(text, { type: "string" });
    return wb;
  }
  return XLSX.read(buffer, { type: "buffer", cellFormula: true, cellDates: true });
}

customSheetsRouter.get("/masters", async (req, res) => {
  const kind = String(req.query.kind || "").trim() as "mb" | "bbs" | "monitoring" | "";
  const category = kind ? MASTER_CATEGORY[kind] : undefined;
  const rows = await prisma.customSheet.findMany({
    where: {
      projectId: null,
      ...(category ? { category } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });
  res.json(
    rows.map((r) => {
      const headers = JSON.parse(r.headersJson || "[]");
      const parsed = parseRowsJson(r.rowsJson);
      return {
        id: r.id,
        name: r.name,
        category: r.category,
        sourceFile: r.sourceFile,
        updatedAt: r.updatedAt,
        rowCount: parsed.length,
        headers,
      };
    })
  );
});

/** Upload SPDC-style MB/BBS master from budget Excel — stored global for all projects */
customSheetsRouter.post(
  "/masters/upload",
  requireRoles(...WRITE_ROLES),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    if (!req.file) return res.status(400).json({ error: "file required" });
    const kind = String(req.body.kind || "mb") as "mb" | "bbs" | "monitoring";
    if (kind === "monitoring") {
      return res.status(400).json({
        error: "BOQ / monitoring is per-project only — upload structure BOQ on Cost → BOQ tab, not as a global master.",
      });
    }
    if (!MASTER_CATEGORY[kind]) return res.status(400).json({ error: "kind must be mb or bbs" });
    const name = String(req.body.name || req.file.originalname).trim();

    let headers: string[] = [];
    let rows: SheetCell[][] = [];

    if (kind === "mb") {
      const { parseMbBuffer } = await import("../services/costSheetParser.js");
      const { mbLinesToSheetRows, MB_HEADERS } = await import("../services/costMasterLines.js");
      const lines = parseMbBuffer(req.file.buffer);
      headers = MB_HEADERS;
      rows = mbLinesToSheetRows(lines);
    } else if (kind === "bbs") {
      const { parseBbsBuffer } = await import("../services/costSheetParser.js");
      const { bbsLinesToSheetRows, BBS_HEADERS } = await import("../services/costMasterLines.js");
      const lines = parseBbsBuffer(req.file.buffer);
      headers = BBS_HEADERS;
      rows = bbsLinesToSheetRows(lines);
    } else {
      return res.status(400).json({ error: "kind must be mb or bbs" });
    }

    const row = await prisma.customSheet.create({
      data: {
        projectId: null,
        name,
        category: MASTER_CATEGORY[kind],
        headersJson: JSON.stringify(headers),
        rowsJson: JSON.stringify(rows),
        sourceFile: req.file.originalname,
        storagePath: null,
        createdById: req.user!.id,
      },
    });

    await audit("customsheet.master.upload", {
      userId: req.user!.id,
      entity: "CustomSheet",
      entityId: row.id,
      meta: { kind, rows: rows.length },
    });

    res.status(201).json({ id: row.id, name: row.name, kind, rowCount: rows.length, headers });
  }
);

customSheetsRouter.get("/masters/:masterId/lines", async (req, res) => {
  const row = await prisma.customSheet.findFirst({
    where: { id: req.params.masterId, projectId: null },
  });
  if (!row) return res.status(404).json({ error: "Master not found" });
  const kind =
    row.category === MASTER_CATEGORY.bbs ? "bbs" : row.category === MASTER_CATEGORY.monitoring ? "monitoring" : "mb";
  const headers = JSON.parse(row.headersJson || "[]");
  const rows = parseRowsJson(row.rowsJson);
  const { previewMasterLines } = await import("../services/costMasterLines.js");
  res.json({
    id: row.id,
    name: row.name,
    kind,
    category: row.category,
    headers,
    rows,
    lines: previewMasterLines(kind as "mb" | "bbs" | "monitoring", headers, rows),
  });
});

customSheetsRouter.get("/", async (req, res) => {
  const projectId = req.query.projectId ? String(req.query.projectId) : undefined;
  const rows = await prisma.customSheet.findMany({
    where: projectId ? { projectId } : {},
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      category: true,
      projectId: true,
      sourceFile: true,
      storagePath: true,
      createdAt: true,
      updatedAt: true,
      headersJson: true,
      rowsJson: true,
    },
  });
  res.json(
    rows.map((r) => {
      const headers = JSON.parse(r.headersJson || "[]");
      const parsed = parseRowsJson(r.rowsJson);
      const stats = sheetStats(parsed);
      return {
        id: r.id,
        name: r.name,
        category: r.category,
        projectId: r.projectId,
        sourceFile: r.sourceFile,
        storagePath: r.storagePath,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        headers,
        ...stats,
      };
    })
  );
});

customSheetsRouter.post("/preview-sheets", requireRoles(...WRITE_ROLES), upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file required" });
  const wb = readWorkbook(req.file.buffer, req.file.originalname);
  res.json({ sheets: wb.SheetNames, fileName: req.file.originalname });
});

customSheetsRouter.get("/:id", async (req, res) => {
  const row = await prisma.customSheet.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "not found" });
  const headers = JSON.parse(row.headersJson || "[]");
  const rows = parseRowsJson(row.rowsJson);
  const stats = sheetStats(rows);
  res.json({ ...row, headers, rows, ...stats });
});

customSheetsRouter.post("/upload", requireRoles(...WRITE_ROLES), upload.single("file"), async (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ error: "file required" });
  const name = String(req.body.name || req.file.originalname).trim();
  const category = String(req.body.category || "General");
  const projectId = req.body.projectId ? String(req.body.projectId) : null;
  const sheetName = req.body.sheet ? String(req.body.sheet) : undefined;

  const wb = readWorkbook(req.file.buffer, req.file.originalname);
  const targetSheetName = sheetName && wb.Sheets[sheetName] ? sheetName : wb.SheetNames[0];
  const target = wb.Sheets[targetSheetName];
  if (!target) return res.status(400).json({ error: "No worksheet found in file" });
  const { headers, rows } = parseSheetWithFormulas(target);

  let storagePath: string | undefined;
  let sharePointUrl: string | undefined;
  if (projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project) {
      const saved = await mockOneDrive.upload(
        project.code,
        "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.18_Management_Review_and_Audit_Programme/Sheet_Maker",
        `${name.replace(/[^a-zA-Z0-9._-]/g, "_")}-${Date.now()}.xlsx`,
        req.file.buffer
      );
      storagePath = saved.path;
      sharePointUrl = saved.sharePointUrl || saved.url;
    }
  }

  const row = await prisma.customSheet.create({
    data: {
      projectId,
      name,
      category,
      headersJson: JSON.stringify(headers),
      rowsJson: JSON.stringify(rows),
      sourceFile: `${req.file.originalname}${targetSheetName ? ` · ${targetSheetName}` : ""}`,
      storagePath: storagePath || null,
      createdById: req.user!.id,
    },
  });
  const stats = sheetStats(rows);
  await audit("customsheet.upload", {
    userId: req.user!.id,
    entity: "CustomSheet",
    entityId: row.id,
    meta: { ...stats, headers: headers.length, sheetTab: targetSheetName, sharePointUrl },
  });
  res.status(201).json({
    id: row.id,
    name: row.name,
    headers,
    sheetTab: targetSheetName,
    availableSheets: wb.SheetNames,
    storagePath,
    sharePointUrl,
    ...stats,
  });
});

customSheetsRouter.post("/blank", requireRoles(...WRITE_ROLES), async (req: AuthedRequest, res) => {
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
  res.status(201).json({ id: row.id, name: row.name, headers: rawHeaders, rowCount: 0, formulaCount: 0 });
});

customSheetsRouter.post("/:id/clone", requireRoles(...WRITE_ROLES), async (req: AuthedRequest, res) => {
  const src = await prisma.customSheet.findUnique({ where: { id: req.params.id } });
  if (!src) return res.status(404).json({ error: "not found" });
  const name = String(req.body.name || `${src.name} (copy)`).trim();
  const projectId = req.body.projectId !== undefined ? (req.body.projectId ? String(req.body.projectId) : null) : src.projectId;
  const row = await prisma.customSheet.create({
    data: {
      projectId,
      name,
      category: src.category,
      headersJson: src.headersJson,
      rowsJson: src.rowsJson,
      sourceFile: src.sourceFile ? `Clone of ${src.sourceFile}` : null,
      storagePath: null,
      createdById: req.user!.id,
    },
  });
  await audit("customsheet.clone", { userId: req.user!.id, entity: "CustomSheet", entityId: row.id, meta: { from: src.id } });
  res.status(201).json({ id: row.id, name: row.name });
});

customSheetsRouter.put("/:id", requireRoles(...WRITE_ROLES), async (req, res) => {
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
  const headers = JSON.parse(row.headersJson || "[]");
  const parsed = rows || parseRowsJson(row.rowsJson);
  res.json({ ...row, headers, rows: parsed, ...sheetStats(parsed) });
});

customSheetsRouter.post("/:id/reimport", requireRoles(...WRITE_ROLES), upload.single("file"), async (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ error: "file required" });
  const row = await prisma.customSheet.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "not found" });
  const sheetName = req.body.sheet ? String(req.body.sheet) : undefined;
  const wb = readWorkbook(req.file.buffer, req.file.originalname);
  const targetSheetName = sheetName && wb.Sheets[sheetName] ? sheetName : wb.SheetNames[0];
  const target = wb.Sheets[targetSheetName];
  if (!target) return res.status(400).json({ error: "No worksheet found" });
  const { headers, rows } = parseSheetWithFormulas(target);
  const updated = await prisma.customSheet.update({
    where: { id: row.id },
    data: {
      headersJson: JSON.stringify(headers),
      rowsJson: JSON.stringify(rows),
      sourceFile: `${req.file.originalname} · ${targetSheetName}`,
    },
  });
  res.json({ ...updated, headers, rows, ...sheetStats(rows) });
});

customSheetsRouter.post("/:id/export", requireRoles(...WRITE_ROLES), async (req: AuthedRequest, res) => {
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
        "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.18_Management_Review_and_Audit_Programme/Sheet_Maker",
        `${row.name.replace(/[^a-zA-Z0-9._-]/g, "_")}-${Date.now()}.xlsx`,
        buf
      );
    }
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${row.name.replace(/"/g, "")}.xlsx"`);
  res.send(buf);
});

customSheetsRouter.delete("/:id", requireRoles(...WRITE_ROLES), async (req: AuthedRequest, res) => {
  await prisma.customSheet.delete({ where: { id: req.params.id } });
  await audit("customsheet.delete", { userId: req.user!.id, entity: "CustomSheet", entityId: req.params.id });
  res.json({ ok: true });
});
