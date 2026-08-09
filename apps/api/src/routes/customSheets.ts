/**
 * Custom Sheet Maker — upload an Excel/CSV, we parse into a table you can then edit.
 * Cells are stored as JSON, sheet name/category is metadata, source file is kept for audit.
 */
import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { mockOneDrive } from "../services/mockOneDrive.js";
import { audit } from "../services/audit.js";

export const customSheetsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
customSheetsRouter.use(requireAuth);

function normaliseRows(sheet: XLSX.WorkSheet): { headers: string[]; rows: unknown[][] } {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
  if (!rows.length) return { headers: [], rows: [] };
  const headers = (rows[0] as unknown[]).map((h, i) => (h != null && String(h).trim() ? String(h) : `Column ${i + 1}`));
  return { headers, rows: rows.slice(1) };
}

customSheetsRouter.get("/", async (req, res) => {
  const projectId = req.query.projectId ? String(req.query.projectId) : undefined;
  const rows = await prisma.customSheet.findMany({
    where: projectId ? { projectId } : {},
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, category: true, projectId: true, sourceFile: true, createdAt: true, updatedAt: true, headersJson: true },
  });
  res.json(
    rows.map((r) => ({ ...r, headers: JSON.parse(r.headersJson || "[]") }))
  );
});

customSheetsRouter.get("/:id", async (req, res) => {
  const row = await prisma.customSheet.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "not found" });
  res.json({
    ...row,
    headers: JSON.parse(row.headersJson || "[]"),
    rows: JSON.parse(row.rowsJson || "[]"),
  });
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
  const { headers, rows } = normaliseRows(target);

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
  await audit("customsheet.upload", { userId: req.user!.id, entity: "CustomSheet", entityId: row.id, meta: { rows: rows.length, headers: headers.length } });
  res.status(201).json({ id: row.id, name: row.name, headers, rowCount: rows.length, storagePath });
});

customSheetsRouter.put("/:id", requireRoles("admin", "office"), async (req, res) => {
  const row = await prisma.customSheet.update({
    where: { id: req.params.id },
    data: {
      name: req.body.name || undefined,
      category: req.body.category || undefined,
      headersJson: req.body.headers ? JSON.stringify(req.body.headers) : undefined,
      rowsJson: req.body.rows ? JSON.stringify(req.body.rows) : undefined,
    },
  });
  res.json(row);
});

customSheetsRouter.post("/:id/export", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const row = await prisma.customSheet.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "not found" });
  const headers = JSON.parse(row.headersJson || "[]");
  const rows = JSON.parse(row.rowsJson || "[]");
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
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
