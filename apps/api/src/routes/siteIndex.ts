/**
 * Site / Final Drawing Index master — CRUD, XLSX upload, Sharnam-branded
 * XLSX + HTML download, and a starter seed of a typical civil / MEP index
 * so PMC has a working master to demo from day one.
 *
 * Global (project-agnostic) rows: PMC picks the subset that applies to each
 * project when planning the drawing schedule.
 */
import { Router } from "express";
import multer from "multer";
import fs from "fs";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { audit } from "../services/audit.js";
import XLSX from "../lib/xlsx.js";
import { sharnamLogoDataUri } from "../services/brandedExport.js";

export const siteIndexRouter = Router();
siteIndexRouter.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const STARTER: {
  drawingNo: string;
  title: string;
  discipline: string;
  stage: string;
  packageHint?: string;
  notes?: string;
}[] = [
  { drawingNo: "GA-001", title: "Site plan · layout & levels", discipline: "Architectural", stage: "Concept", packageHint: "Civil" },
  { drawingNo: "GA-002", title: "Landscape & external works plan", discipline: "Landscape", stage: "Design", packageHint: "Civil" },
  { drawingNo: "STR-001", title: "General notes & abbreviations", discipline: "Structural", stage: "GFC", packageHint: "Civil" },
  { drawingNo: "STR-101", title: "Foundation plan & footings", discipline: "Structural", stage: "GFC", packageHint: "Civil" },
  { drawingNo: "STR-201", title: "Column & shear-wall layout", discipline: "Structural", stage: "GFC", packageHint: "Civil" },
  { drawingNo: "STR-301", title: "Slab & beam plans · Level 1", discipline: "Structural", stage: "GFC", packageHint: "Civil" },
  { drawingNo: "STR-BBS-01", title: "Bar bending schedule · Foundation", discipline: "Structural", stage: "GFC", packageHint: "Civil" },
  { drawingNo: "ARC-101", title: "Ground floor architectural plan", discipline: "Architectural", stage: "GFC", packageHint: "Civil" },
  { drawingNo: "ARC-201", title: "Sections & elevations", discipline: "Architectural", stage: "GFC", packageHint: "Civil" },
  { drawingNo: "ARC-401", title: "Toilet layout & tile pattern", discipline: "Architectural", stage: "GFC", packageHint: "Civil" },
  { drawingNo: "MEP-101", title: "Electrical single line diagram", discipline: "Electrical", stage: "GFC", packageHint: "MEP" },
  { drawingNo: "MEP-201", title: "Plumbing layout · Ground", discipline: "Plumbing", stage: "GFC", packageHint: "MEP" },
  { drawingNo: "MEP-301", title: "Fire protection & sprinkler layout", discipline: "Fire", stage: "GFC", packageHint: "MEP" },
  { drawingNo: "MEP-401", title: "HVAC ducting & equipment plan", discipline: "HVAC", stage: "GFC", packageHint: "MEP" },
  { drawingNo: "PEB-001", title: "PEB anchor bolt & column base plan", discipline: "Structural", stage: "GFC", packageHint: "PEB" },
  { drawingNo: "PEB-101", title: "PEB frame elevations & rafters", discipline: "Structural", stage: "GFC", packageHint: "PEB" },
  { drawingNo: "PEB-201", title: "PEB roof & wall sheeting layout", discipline: "Structural", stage: "GFC", packageHint: "PEB" },
  { drawingNo: "AS-BUILT-001", title: "As-built · site plan", discipline: "Architectural", stage: "As-built", packageHint: "Handover" },
  { drawingNo: "AS-BUILT-002", title: "As-built · structural composite", discipline: "Structural", stage: "As-built", packageHint: "Handover" },
  { drawingNo: "AS-BUILT-003", title: "As-built · MEP composite", discipline: "MEP", stage: "As-built", packageHint: "Handover" },
];

siteIndexRouter.get("/", async (_req, res) => {
  const rows = await prisma.siteFinalIndex.findMany({ orderBy: [{ srNo: "asc" }, { drawingNo: "asc" }] });
  res.json(rows);
});

siteIndexRouter.post(
  "/",
  requireRoles("admin", "office", "employee"),
  async (req: AuthedRequest, res) => {
    const b = req.body || {};
    const drawingNo = String(b.drawingNo || "").trim().toUpperCase();
    if (!drawingNo) return res.status(400).json({ error: "drawingNo required" });
    try {
      const row = await prisma.siteFinalIndex.create({
        data: {
          srNo: Number(b.srNo) || 0,
          drawingNo,
          title: String(b.title || "").trim() || drawingNo,
          discipline: String(b.discipline || "Architectural"),
          stage: String(b.stage || "Design"),
          status: String(b.status || "Planned"),
          packageHint: b.packageHint ? String(b.packageHint) : null,
          notes: b.notes ? String(b.notes) : null,
        },
      });
      await audit("master.site_index.create", { userId: req.user!.id, entity: "SiteFinalIndex", entityId: row.id });
      res.status(201).json(row);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/unique/i.test(msg)) return res.status(409).json({ error: `Drawing ${drawingNo} already in the index.` });
      res.status(500).json({ error: msg });
    }
  }
);

siteIndexRouter.patch(
  "/:id",
  requireRoles("admin", "office", "employee"),
  async (req: AuthedRequest, res) => {
    const b = req.body || {};
    const row = await prisma.siteFinalIndex.update({
      where: { id: req.params.id },
      data: {
        ...(b.srNo != null ? { srNo: Number(b.srNo) || 0 } : {}),
        ...(b.drawingNo ? { drawingNo: String(b.drawingNo).trim().toUpperCase() } : {}),
        ...(b.title !== undefined ? { title: b.title ? String(b.title) : "" } : {}),
        ...(b.discipline !== undefined ? { discipline: String(b.discipline || "Architectural") } : {}),
        ...(b.stage !== undefined ? { stage: String(b.stage || "Design") } : {}),
        ...(b.status !== undefined ? { status: String(b.status || "Planned") } : {}),
        ...(b.packageHint !== undefined ? { packageHint: b.packageHint ? String(b.packageHint) : null } : {}),
        ...(b.notes !== undefined ? { notes: b.notes ? String(b.notes) : null } : {}),
      },
    });
    await audit("master.site_index.update", { userId: req.user!.id, entity: "SiteFinalIndex", entityId: row.id });
    res.json(row);
  }
);

siteIndexRouter.delete("/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  await prisma.siteFinalIndex.delete({ where: { id: req.params.id } });
  await audit("master.site_index.delete", { userId: req.user!.id, entity: "SiteFinalIndex", entityId: req.params.id });
  res.json({ ok: true });
});

/**
 * Seed the starter index (~20 planned drawings covering civil / MEP / PEB /
 * as-built) so the client can demo immediately.  Idempotent — existing rows
 * (by drawingNo) are preserved.
 */
siteIndexRouter.post("/seed-defaults", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  let created = 0;
  let skipped = 0;
  for (let i = 0; i < STARTER.length; i++) {
    const s = STARTER[i];
    const existing = await prisma.siteFinalIndex.findUnique({ where: { drawingNo: s.drawingNo } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.siteFinalIndex.create({
      data: {
        srNo: i + 1,
        drawingNo: s.drawingNo,
        title: s.title,
        discipline: s.discipline,
        stage: s.stage,
        status: "Planned",
        packageHint: s.packageHint || null,
        notes: s.notes || null,
      },
    });
    created++;
  }
  await audit("master.site_index.seed_defaults", {
    userId: req.user!.id,
    entity: "SiteFinalIndex",
    meta: { created, skipped, total: STARTER.length },
  });
  res.json({ ok: true, created, skipped, total: STARTER.length });
});

/**
 * Import a Site/Final Index workbook — first sheet, header row 1, columns:
 *   Sr | DrawingNo | Title | Discipline | Stage | Status | Package | Notes
 * (column names case-insensitive; extras ignored).
 */
siteIndexRouter.post(
  "/upload",
  requireRoles("admin", "office"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    if (!req.file) return res.status(400).json({ error: "file required" });
    try {
      const wb = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      const norm = (k: string) => k.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      let created = 0;
      let updated = 0;
      let skipped = 0;
      for (const raw of aoa) {
        const bag: Record<string, unknown> = {};
        for (const k of Object.keys(raw)) bag[norm(k)] = raw[k];
        const drawingNo = String(bag["drawingno"] || bag["drawing"] || bag["drawingnumber"] || "").trim().toUpperCase();
        if (!drawingNo) {
          skipped++;
          continue;
        }
        const title = String(bag["title"] || bag["description"] || drawingNo).trim();
        const discipline = String(bag["discipline"] || bag["trade"] || "Architectural").trim() || "Architectural";
        const stage = String(bag["stage"] || bag["revision"] || "Design").trim() || "Design";
        const status = String(bag["status"] || "Planned").trim() || "Planned";
        const packageHint = String(bag["package"] || bag["packagehint"] || "").trim() || null;
        const notes = String(bag["notes"] || bag["remarks"] || "").trim() || null;
        const srNo = Number(bag["sr"] || bag["srno"] || bag["srnumber"]) || 0;

        const existing = await prisma.siteFinalIndex.findUnique({ where: { drawingNo } });
        if (existing) {
          await prisma.siteFinalIndex.update({
            where: { drawingNo },
            data: { srNo: srNo || existing.srNo, title, discipline, stage, status, packageHint, notes },
          });
          updated++;
        } else {
          await prisma.siteFinalIndex.create({
            data: { srNo, drawingNo, title, discipline, stage, status, packageHint, notes },
          });
          created++;
        }
      }
      await audit("master.site_index.upload", {
        userId: req.user!.id,
        entity: "SiteFinalIndex",
        meta: { created, updated, skipped, source: req.file.originalname },
      });
      res.status(201).json({ ok: true, created, updated, skipped });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }
);

siteIndexRouter.get("/download.xlsx", async (_req, res) => {
  const rows = await prisma.siteFinalIndex.findMany({ orderBy: [{ srNo: "asc" }, { drawingNo: "asc" }] });
  const { workbookBuffer } = await import("../services/brandedExport.js");
  const headers = ["Sr", "Drawing No", "Title", "Discipline", "Stage", "Status", "Package", "Notes"];
  const data = rows.map((r) => [r.srNo, r.drawingNo, r.title, r.discipline, r.stage, r.status, r.packageHint || "", r.notes || ""]);
  const buf = workbookBuffer([{ name: "Site & Final Index", rows: [headers, ...data] }], {
    title: "Sharnam · Site / Final Drawing Index master",
    projectCode: "MASTER",
  });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="Sharnam-Site-Final-Index.xlsx"`);
  res.send(buf);
});

/** Sharnam-letterhead printable info sheet — one page of the drawing index. */
siteIndexRouter.get("/download.html", async (_req, res) => {
  const rows = await prisma.siteFinalIndex.findMany({ orderBy: [{ srNo: "asc" }, { drawingNo: "asc" }] });
  const logo = sharnamLogoDataUri();
  const esc = (v: unknown) =>
    String(v ?? "—").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
    );
  const disciplineCount: Record<string, number> = {};
  const stageCount: Record<string, number> = {};
  for (const r of rows) {
    disciplineCount[r.discipline] = (disciplineCount[r.discipline] || 0) + 1;
    stageCount[r.stage] = (stageCount[r.stage] || 0) + 1;
  }
  const rowsHtml = rows
    .map(
      (r) => `
      <tr>
        <td class="c">${r.srNo || "—"}</td>
        <td class="mono">${esc(r.drawingNo)}</td>
        <td>${esc(r.title)}</td>
        <td>${esc(r.discipline)}</td>
        <td class="c">${esc(r.stage)}</td>
        <td class="c"><span class="tag tag--${r.status.toLowerCase().replace(/\s+/g, "")}">${esc(r.status)}</span></td>
        <td>${esc(r.packageHint || "—")}</td>
      </tr>`
    )
    .join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<title>Sharnam · Site / Final Drawing Index</title>
<style>
  @page { size: A4 landscape; margin: 10mm 12mm; }
  body { font-family: "Inter","Segoe UI",Arial,sans-serif; color:#111; font-size:10.5px; margin:0; }
  .letterhead { display:flex; align-items:center; gap:14px; border-bottom:2px solid #b28c3c; padding-bottom:8px; margin-bottom:10px; }
  .letterhead img { height:48px; }
  .letterhead h1 { margin:0; font-size:15px; color:#b28c3c; letter-spacing:.3px; }
  .letterhead .co { font-size:10px; color:#444; }
  .letterhead .doc { text-align:right; font-size:10px; color:#555; }
  .letterhead .doc b { color:#111; font-size:12px; }
  .band { display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; margin-bottom:10px; }
  .band .card { background:#fdf6e3; border:1px solid #e2d5aa; border-radius:4px; padding:6px 10px; }
  .band .card .k { color:#6b5a2e; font-size:9px; text-transform:uppercase; letter-spacing:.4px; }
  .band .card .v { font-size:14px; font-weight:700; color:#4a3a12; }
  table { border-collapse:collapse; width:100%; }
  th, td { border:1px solid #d0c9b3; padding:5px 7px; text-align:left; vertical-align:top; }
  th { background:#efe4c4; color:#4a3a12; font-weight:700; font-size:10px; }
  td.c { text-align:center; white-space:nowrap; }
  td.mono { font-family:"IBM Plex Mono", monospace; font-size:10px; }
  .tag { display:inline-block; padding:1px 8px; border-radius:10px; font-size:9px; font-weight:600; }
  .tag--planned { background:#dbeafe; color:#1e40af; }
  .tag--issued { background:#fef3c7; color:#92400e; }
  .tag--gfc { background:#d1fae5; color:#065f46; }
  .tag--asbuilt { background:#e9d5ff; color:#5b21b6; }
  .tag--pending { background:#fee2e2; color:#991b1b; }
  .footer { border-top:1px solid #eee; margin-top:10px; padding-top:5px; color:#666; font-size:9px; display:flex; justify-content:space-between; }
</style></head><body>
  <div class="letterhead">
    ${logo ? `<img src="${logo}" alt="Sharnam" />` : ""}
    <div style="flex:1">
      <h1>Sharnam Project Development Consultants &amp; Co.</h1>
      <div class="co">Project management consultancy · Ahmedabad, India</div>
    </div>
    <div class="doc"><b>Site / Final Drawing Index master</b><br />${rows.length} planned drawings on file</div>
  </div>
  <div class="band">
    <div class="card"><div class="k">Total drawings</div><div class="v">${rows.length}</div></div>
    <div class="card"><div class="k">Disciplines</div><div class="v">${Object.keys(disciplineCount).length}</div></div>
    <div class="card"><div class="k">GFC ready</div><div class="v">${stageCount["GFC"] || 0}</div></div>
    <div class="card"><div class="k">As-built</div><div class="v">${stageCount["As-built"] || 0}</div></div>
  </div>
  <table>
    <thead><tr><th style="width:38px">Sr</th><th style="width:100px">Drawing No</th><th>Title</th><th style="width:100px">Discipline</th><th style="width:70px">Stage</th><th style="width:80px">Status</th><th style="width:80px">Package</th></tr></thead>
    <tbody>${rowsHtml || `<tr><td colspan="7" style="text-align:center; padding:20px; color:#888">No drawings in the master — seed defaults or upload an XLSX.</td></tr>`}</tbody>
  </table>
  <div class="footer">
    <span>Generated ${new Date().toLocaleString("en-IN")}</span>
    <span>Sharnam PMC · Master → Site / Final Index · Confidential</span>
  </div>
</body></html>`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});
