import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { seedAuditKpiFromSheets } from "../modules/audit-kpi/seedFromSheets.js";
import { audit } from "../services/audit.js";

export const auditKpiRouter = Router();
auditKpiRouter.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function csvEscape(v: unknown) {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: unknown[][]) {
  return [headers.join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");
}

function closureRatio(s: {
  pctClosed: number | null;
  closedCount: number;
  recordsCount: number;
}): number {
  if (s.pctClosed != null && Number.isFinite(s.pctClosed)) {
    return s.pctClosed > 1 ? s.pctClosed / 100 : s.pctClosed;
  }
  if (s.recordsCount > 0) return s.closedCount / s.recordsCount;
  return 0;
}

auditKpiRouter.get("/project/:projectId/dashboard", async (req, res) => {
  const projectId = req.params.projectId;
  const [findings, subjects, audit, checklist] = await Promise.all([
    prisma.auditFinding.findMany({ where: { projectId }, orderBy: { srNo: "asc" } }),
    prisma.kpiSubject.findMany({ where: { projectId }, orderBy: { srNo: "asc" } }),
    prisma.siteAudit.findFirst({ where: { projectId }, orderBy: { createdAt: "desc" } }),
    prisma.auditChecklistItem.count({ where: { projectId } }),
  ]);

  const openFindings = findings.filter((f) => f.status !== "Closed").length;
  const closedFindings = findings.length - openFindings;
  const ragCounts = { Red: 0, Amber: 0, Green: 0, UNUSED: 0 };
  for (const s of subjects) {
    const k = (s.rag || "UNUSED") as keyof typeof ragCounts;
    if (ragCounts[k] != null) ragCounts[k]++;
    else ragCounts.UNUSED++;
  }
  const overdueSubjects = subjects.filter((s) => s.overdueCount > 0).length;
  const avgClosure =
    subjects.length > 0
      ? subjects.reduce((a, s) => a + closureRatio(s), 0) / subjects.length
      : 0;

  res.json({
    audit,
    totals: {
      findings: findings.length,
      openFindings,
      closedFindings,
      checklistItems: checklist,
      subjects: subjects.length,
      overdueSubjects,
      ragCounts,
      avgClosurePct: Math.round(avgClosure * 100),
    },
    findings,
    subjects: subjects.slice(0, 50),
    subjectCount: subjects.length,
  });
});

auditKpiRouter.get("/project/:projectId/findings", async (req, res) => {
  const rows = await prisma.auditFinding.findMany({
    where: { projectId: req.params.projectId },
    orderBy: { srNo: "asc" },
  });
  res.json({ findings: rows });
});

auditKpiRouter.post(
  "/project/:projectId/findings",
  requireRoles("admin", "office", "employee"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    if (!body.description) return res.status(400).json({ error: "description required" });
    const count = await prisma.auditFinding.count({ where: { projectId: req.params.projectId } });
    const findingNo = body.findingNo || `SF-${String(count + 1).padStart(3, "0")}`;
    const row = await prisma.auditFinding.create({
      data: {
        projectId: req.params.projectId,
        findingNo,
        srNo: body.srNo ? Number(body.srNo) : count + 1,
        source: body.source || null,
        refNo: body.refNo || null,
        folderLocation: body.folderLocation || null,
        description: body.description,
        photoRef: body.photoRef || null,
        severity: body.severity || "Minor",
        status: body.status || "Open",
        correctiveAction: body.correctiveAction || null,
        owner: body.owner || req.user!.fullName,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      },
    });
    res.status(201).json(row);
  }
);

auditKpiRouter.patch(
  "/findings/:id",
  requireRoles("admin", "office", "employee"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const data: Record<string, unknown> = {};
    for (const k of [
      "source",
      "refNo",
      "folderLocation",
      "description",
      "photoRef",
      "severity",
      "status",
      "correctiveAction",
      "owner",
      "rootCause",
    ] as const) {
      if (body[k] !== undefined) data[k] = body[k];
    }
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.status === "Closed") data.closedAt = new Date();
    const row = await prisma.auditFinding.update({ where: { id: req.params.id }, data });
    res.json(row);
  }
);

auditKpiRouter.get("/project/:projectId/checklist", async (req, res) => {
  const section = req.query.section ? String(req.query.section) : undefined;
  const rows = await prisma.auditChecklistItem.findMany({
    where: { projectId: req.params.projectId, ...(section ? { section } : {}) },
    orderBy: [{ section: "asc" }, { itemNo: "asc" }],
  });
  res.json({ items: rows });
});

auditKpiRouter.patch(
  "/checklist/:id",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const data: Record<string, unknown> = {};
    for (const k of ["locationChecked", "observed", "score", "photoRef", "response", "notes"] as const) {
      if (body[k] !== undefined) data[k] = body[k];
    }
    if (body.score !== undefined) data.score = body.score === "" ? null : Number(body.score);
    const row = await prisma.auditChecklistItem.update({ where: { id: req.params.id }, data });
    res.json(row);
  }
);

auditKpiRouter.post(
  "/project/:projectId/checklist",
  requireRoles("admin", "office", "employee"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const section = String(body.section || "").trim();
    const prompt = String(body.prompt || "").trim();
    if (!section || !prompt) return res.status(400).json({ error: "section and prompt required" });
    const maxNo = await prisma.auditChecklistItem.aggregate({
      where: { projectId: req.params.projectId, section },
      _max: { itemNo: true },
    });
    const itemNo = body.itemNo ? Number(body.itemNo) : (maxNo._max.itemNo ?? 0) + 1;
    const row = await prisma.auditChecklistItem.create({
      data: {
        projectId: req.params.projectId,
        section,
        itemNo,
        prompt,
        locationChecked: body.locationChecked || null,
        observed: body.observed || null,
        score: body.score != null && body.score !== "" ? Number(body.score) : null,
        response: body.response || null,
      },
    });
    res.status(201).json(row);
  }
);

auditKpiRouter.get("/project/:projectId/subjects", async (req, res) => {
  const rows = await prisma.kpiSubject.findMany({
    where: { projectId: req.params.projectId },
    orderBy: { srNo: "asc" },
  });
  res.json({ subjects: rows });
});

auditKpiRouter.post(
  "/project/:projectId/subjects",
  requireRoles("admin", "office"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    if (!body.name || !body.isoArea) return res.status(400).json({ error: "name and isoArea required" });
    const maxSr = await prisma.kpiSubject.aggregate({
      where: { projectId: req.params.projectId },
      _max: { srNo: true },
    });
    const srNo = body.srNo ? Number(body.srNo) : (maxSr._max.srNo ?? 0) + 1;
    const row = await prisma.kpiSubject.create({
      data: {
        projectId: req.params.projectId,
        srNo,
        isoArea: body.isoArea,
        folder: body.folder || body.isoArea,
        isoClause: body.isoClause || null,
        name: body.name,
        custodian: body.custodian || "HO",
        relativePath: body.relativePath || null,
        workbookFileName: body.workbookFileName || null,
        rag: body.rag || "UNUSED",
      },
    });
    res.status(201).json(row);
  }
);

auditKpiRouter.patch(
  "/subjects/:id",
  requireRoles("admin", "office"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const data: Record<string, unknown> = {};
    for (const k of [
      "isoArea",
      "folder",
      "isoClause",
      "name",
      "custodian",
      "relativePath",
      "workbookFileName",
      "recordsCount",
      "openCount",
      "closedCount",
      "overdueCount",
      "pctClosed",
      "oldestOpenDays",
      "kraScore",
      "rag",
    ] as const) {
      if (body[k] !== undefined) data[k] = body[k];
    }
    if (body.lastRefreshedAt !== undefined) data.lastRefreshedAt = body.lastRefreshedAt ? new Date(body.lastRefreshedAt) : null;
    const row = await prisma.kpiSubject.update({ where: { id: req.params.id }, data });
    res.json(row);
  }
);

auditKpiRouter.get("/project/:projectId/role-kra", async (req, res) => {
  const rows = await prisma.kpiRoleKra.findMany({
    where: { projectId: req.params.projectId },
    orderBy: [{ roleKey: "asc" }, { kraNo: "asc" }],
  });
  res.json({ kras: rows });
});

auditKpiRouter.get("/project/:projectId/download/:sheet.csv", async (req, res) => {
  const projectId = req.params.projectId;
  const sheet = req.params.sheet;
  let csv = "";
  let filename = `Sharnam-${sheet}.csv`;

  if (sheet === "findings") {
    const rows = await prisma.auditFinding.findMany({ where: { projectId }, orderBy: { srNo: "asc" } });
    const headers = ["#", "Finding ref.", "Source", "Ref. no.", "Folder / location", "Finding", "Photo ref.", "Severity", "Status"];
    csv = toCsv(
      headers,
      rows.map((r) => [
        r.srNo,
        r.findingNo,
        r.source,
        r.refNo,
        r.folderLocation,
        r.description,
        r.photoRef,
        r.severity,
        r.status,
      ])
    );
    filename = "SITE_AUDIT_FINDINGS.csv";
  } else if (sheet === "subjects") {
    const rows = await prisma.kpiSubject.findMany({ where: { projectId }, orderBy: { srNo: "asc" } });
    const headers = [
      "#",
      "ISO area",
      "Folder",
      "ISO clause",
      "Subject",
      "Custodian",
      "Relative path",
      "Workbook file name",
      "Records",
      "Open",
      "Closed",
      "Overdue",
      "% Closed",
      "Oldest open (d)",
      "KRA score",
      "RAG",
    ];
    csv = toCsv(
      headers,
      rows.map((r) => [
        r.srNo,
        r.isoArea,
        r.folder,
        r.isoClause,
        r.name,
        r.custodian,
        r.relativePath,
        r.workbookFileName,
        r.recordsCount,
        r.openCount,
        r.closedCount,
        r.overdueCount,
        r.pctClosed,
        r.oldestOpenDays,
        r.kraScore,
        r.rag,
      ])
    );
    filename = "MASTER_KPI_SUBJECT_DATA.csv";
  } else if (sheet === "site-walk" || sheet === "dc-interview" || sheet === "folder-sample") {
    const section =
      sheet === "site-walk" ? "SiteWalk" : sheet === "dc-interview" ? "DcInterview" : "FolderSample";
    const rows = await prisma.auditChecklistItem.findMany({
      where: { projectId, section },
      orderBy: { itemNo: "asc" },
    });
    csv = toCsv(
      ["#", "Prompt", "Location checked", "Observed", "Score", "Photo ref.", "Response", "Notes"],
      rows.map((r) => [r.itemNo, r.prompt, r.locationChecked, r.observed, r.score, r.photoRef, r.response, r.notes])
    );
    filename = `SITE_AUDIT_${section.toUpperCase()}.csv`;
  } else {
    return res.status(404).json({ error: "Unknown sheet export" });
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
});

/**
 * Sharnam-branded XLSX for every KRA/KPI sheet — same rows as the CSV endpoint but
 * with the SPDC letterhead cover page (logo, project code, generation timestamp).
 * Supported: findings | subjects | role-kra | site-walk | dc-interview | folder-sample.
 */
auditKpiRouter.get("/project/:projectId/download/:sheet.xlsx", async (req, res) => {
  const projectId = req.params.projectId;
  const sheetKey = req.params.sheet;
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { code: true, name: true } });
  if (!project) return res.status(404).json({ error: "Project not found" });

  const { workbookBuffer } = await import("../services/brandedExport.js");

  let title = "";
  let filename = `Sharnam-${sheetKey}.xlsx`;
  let headers: string[] = [];
  let rows: (string | number | null | undefined)[][] = [];

  if (sheetKey === "findings") {
    const src = await prisma.auditFinding.findMany({ where: { projectId }, orderBy: { srNo: "asc" } });
    title = "Site Audit — Findings & CAPA";
    headers = ["#", "Finding ref", "Source", "Ref no", "Folder / location", "Finding", "Photo ref", "Severity", "Status", "Owner", "Due date", "Root cause", "Corrective action", "Closed at"];
    rows = src.map((r) => [
      r.srNo,
      r.findingNo,
      r.source,
      r.refNo,
      r.folderLocation,
      r.description,
      r.photoRef,
      r.severity,
      r.status,
      r.owner,
      r.dueDate ? new Date(r.dueDate).toLocaleDateString("en-IN") : null,
      r.rootCause,
      r.correctiveAction,
      r.closedAt ? new Date(r.closedAt).toLocaleDateString("en-IN") : null,
    ]);
    filename = `SITE_AUDIT_FINDINGS-${project.code}.xlsx`;
  } else if (sheetKey === "subjects") {
    const src = await prisma.kpiSubject.findMany({ where: { projectId }, orderBy: { srNo: "asc" } });
    title = "Master KPI — Subject Data";
    headers = ["#", "ISO area", "Folder", "ISO clause", "Subject", "Custodian", "Records", "Open", "Closed", "Overdue", "% closed", "Oldest open (d)", "KRA score", "RAG", "Last refreshed"];
    rows = src.map((r) => [
      r.srNo,
      r.isoArea,
      r.folder,
      r.isoClause,
      r.name,
      r.custodian,
      r.recordsCount,
      r.openCount,
      r.closedCount,
      r.overdueCount,
      r.pctClosed,
      r.oldestOpenDays,
      r.kraScore,
      r.rag,
      r.lastRefreshedAt ? new Date(r.lastRefreshedAt).toLocaleString("en-IN") : null,
    ]);
    filename = `MASTER_KPI_SUBJECTS-${project.code}.xlsx`;
  } else if (sheetKey === "role-kra") {
    const src = await prisma.kpiRoleKra.findMany({ where: { projectId }, orderBy: [{ roleKey: "asc" }, { kraNo: "asc" }] });
    title = "Master KPI — Role KRA Templates";
    headers = ["Role", "KRA #", "Description", "Consequence", "Evidence hint", "KPI code", "Target", "Red", "Amber", "Green"];
    rows = src.map((r) => [r.roleKey, r.kraNo, r.description, r.consequence, r.evidenceHint, r.kpiCode, r.target, r.redCount, r.amberCount, r.greenCount]);
    filename = `MASTER_KPI_ROLE_KRA-${project.code}.xlsx`;
  } else if (sheetKey === "site-walk" || sheetKey === "dc-interview" || sheetKey === "folder-sample") {
    const section = sheetKey === "site-walk" ? "SiteWalk" : sheetKey === "dc-interview" ? "DcInterview" : "FolderSample";
    const src = await prisma.auditChecklistItem.findMany({
      where: { projectId, section },
      orderBy: { itemNo: "asc" },
    });
    title = `Site Audit — ${section.replace(/([A-Z])/g, " $1").trim()}`;
    headers = ["#", "Prompt", "Location checked", "Observed", "Score", "Photo ref", "Response", "Notes"];
    rows = src.map((r) => [r.itemNo, r.prompt, r.locationChecked, r.observed, r.score, r.photoRef, r.response, r.notes]);
    filename = `SITE_AUDIT_${section.toUpperCase()}-${project.code}.xlsx`;
  } else {
    return res.status(400).json({ error: "Unknown sheet — use findings | subjects | role-kra | site-walk | dc-interview | folder-sample" });
  }

  const buf = workbookBuffer([{ name: title.slice(0, 31), rows: [headers, ...rows] }], {
    title,
    projectCode: project.code,
  });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buf);
});

/**
 * Cross-module KRA refresh — pulls **live** counts from the portal (RFIs, NCRs, drawings
 * overdue, checklist submissions) and rolls them into KpiSubject rows.  Any subject whose
 * `workbookFileName` matches one of the module keys below is auto-computed.  All other
 * subjects keep whatever was seeded from the KPI pack.
 *
 * Mapping (case-insensitive, prefix match on workbookFileName or name):
 *   RFI / Request for information        → open Rfi (kind RequestForInformation)
 *   NCR                                   → RFIs where rfiKind='QualityIR' with open status (proxy)
 *   Drawing register / GFC / Approval     → Drawing revisions where dueDate < now and not superseded
 *   Site Execution / Progress checklists  → ChecklistSubmission open/closed
 *   Safety                                → RFIs where rfiKind IN ('SafetyIR','SafetyChecklist')
 *   Cost / RA / COP                       → RaBill status counts
 */
auditKpiRouter.post(
  "/project/:projectId/refresh",
  requireRoles("admin", "office"),
  async (req: AuthedRequest, res) => {
    const projectId = req.params.projectId;
    const subjects = await prisma.kpiSubject.findMany({ where: { projectId } });
    if (!subjects.length) return res.json({ ok: true, subjects: 0, updated: 0 });

    const [rfis, drawings, drawingsOverdue, safetyRfis, raBills, subs] = await Promise.all([
      prisma.rfi.findMany({ where: { projectId, rfiKind: { in: ["RequestForInformation", "Manual", "ClientConcern"] } }, select: { status: true, closedAt: true, createdAt: true, dueDate: true } }),
      prisma.drawing.findMany({ where: { projectId }, select: { id: true } }),
      prisma.drawingRevision.findMany({
        where: { drawing: { projectId } },
        select: {
          plannedDate: true,
          actualDate: true,
          issuedToClientAt: true,
          receivedDate: true,
          published: true,
        },
      }),
      prisma.rfi.findMany({ where: { projectId, rfiKind: { in: ["SafetyIR", "SafetyChecklist"] } }, select: { status: true, closedAt: true, createdAt: true, dueDate: true } }),
      prisma.raBill.findMany({ where: { projectId }, select: { status: true, createdAt: true, invoiceDate: true } }),
      prisma.checklistSubmission.findMany({
        where: { assignment: { projectId } },
        select: { status: true, createdAt: true, reviewedAt: true, assignment: { select: { template: { select: { checklistType: true } } } } },
      }),
    ]);

    const now = Date.now();
    const rollupRfi = (list: typeof rfis) => {
      const open = list.filter((r) => r.status !== "Closed").length;
      const closed = list.filter((r) => r.status === "Closed").length;
      const overdue = list.filter((r) => r.status !== "Closed" && r.dueDate && new Date(r.dueDate).getTime() < now).length;
      const oldest = list
        .filter((r) => r.status !== "Closed")
        .reduce((max, r) => Math.max(max, Math.round((now - new Date(r.createdAt).getTime()) / 86400000)), 0);
      return { records: list.length, open, closed, overdue, oldest };
    };
    const rollupDrawings = () => {
      const overdue = drawingsOverdue.filter(
        (d) => d.plannedDate && !d.actualDate && new Date(d.plannedDate).getTime() < now
      ).length;
      const open = drawingsOverdue.filter((d) => !d.published).length;
      const closed = drawingsOverdue.length - open;
      const oldest = drawingsOverdue
        .filter((d) => !d.published && d.plannedDate)
        .reduce(
          (max, d) =>
            Math.max(max, Math.round((now - new Date(d.plannedDate as Date).getTime()) / 86400000)),
          0
        );
      return { records: drawings.length, open, closed, overdue, oldest };
    };
    const rollupCost = () => {
      const open = raBills.filter((r) => r.status !== "Paid" && r.status !== "Certified").length;
      const closed = raBills.length - open;
      return { records: raBills.length, open, closed, overdue: 0, oldest: 0 };
    };
    const rollupSubs = (kinds: string[]) => {
      const list = subs.filter((s) => kinds.includes(s.assignment?.template?.checklistType || ""));
      const open = list.filter((s) => s.status !== "Submitted" && s.status !== "Approved").length;
      const closed = list.length - open;
      return { records: list.length, open, closed, overdue: 0, oldest: 0 };
    };

    const rfiRoll = rollupRfi(rfis);
    const safetyRoll = rollupRfi(safetyRfis);
    const drawingRoll = rollupDrawings();
    const costRoll = rollupCost();
    const qcRoll = rollupSubs(["QualityInspection"]);
    const seRoll = rollupSubs(["SiteExecution", "ActivityInspection"]);

    function mapSubject(subjectName: string) {
      const n = subjectName.toLowerCase();
      if (n.includes("rfi") || n.includes("request for information")) return rfiRoll;
      if (n.includes("safety") || n.includes("hse")) return safetyRoll;
      if (n.includes("drawing") || n.includes("gfc") || n.includes("approval")) return drawingRoll;
      if (n.includes("ra bill") || n.includes("cop") || n.includes("payment") || n.includes("cash")) return costRoll;
      if (n.includes("quality") || n.includes("ncr") || n.includes("inspection")) return qcRoll;
      if (n.includes("progress") || n.includes("dpr") || n.includes("wpr") || n.includes("site execution")) return seRoll;
      return null;
    }
    function ragFor(records: number, overdue: number, open: number): string {
      if (records === 0) return "UNUSED";
      if (overdue > 0) return "Red";
      if (open / Math.max(records, 1) > 0.4) return "Amber";
      return "Green";
    }

    let updated = 0;
    const now2 = new Date();
    for (const s of subjects) {
      const roll = mapSubject(`${s.workbookFileName || ""} ${s.name}`);
      if (!roll) continue;
      const pctClosed = roll.records > 0 ? Math.round((roll.closed / roll.records) * 100) : 0;
      const kraScore = Math.max(0, Math.min(100, pctClosed - roll.overdue * 5));
      await prisma.kpiSubject.update({
        where: { id: s.id },
        data: {
          recordsCount: roll.records,
          openCount: roll.open,
          closedCount: roll.closed,
          overdueCount: roll.overdue,
          oldestOpenDays: roll.oldest,
          pctClosed,
          kraScore,
          rag: ragFor(roll.records, roll.overdue, roll.open),
          lastRefreshedAt: now2,
        },
      });
      updated++;
    }
    await audit("audit_kpi.refresh", { userId: req.user!.id, entity: "KpiSubject", entityId: projectId, meta: { updated, total: subjects.length } });
    res.json({ ok: true, subjects: subjects.length, updated, refreshedAt: now2 });
  }
);

auditKpiRouter.post(
  "/project/:projectId/upload",
  requireRoles("admin", "office", "employee"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    if (!req.file?.buffer?.length) return res.status(400).json({ error: "Excel file required (field: file)" });
    const pack = String(req.body?.pack || "auto");
    const name = (req.file.originalname || "").toLowerCase();
    let auditBuffer: Buffer | undefined;
    let kpiBuffer: Buffer | undefined;
    if (pack === "site-audit" || name.includes("audit")) auditBuffer = req.file.buffer;
    else if (pack === "kpi" || name.includes("kpi")) kpiBuffer = req.file.buffer;
    else {
      try {
        const wb = XLSX.read(req.file.buffer, { type: "buffer" });
        if (wb.SheetNames.includes("FINDINGS") || wb.SheetNames.includes("SITE_WALK")) auditBuffer = req.file.buffer;
        if (wb.SheetNames.includes("03_SUBJECT_DATA")) kpiBuffer = req.file.buffer;
      } catch {
        return res.status(400).json({ error: "Unrecognised workbook — use SITE_AUDIT_Pack or MASTER_KPI_DASHBOARD" });
      }
    }
    if (!auditBuffer && !kpiBuffer) {
      return res.status(400).json({ error: "Could not detect pack type — set pack=site-audit or pack=kpi" });
    }
    const stats = await seedAuditKpiFromSheets(prisma, req.params.projectId, { auditBuffer, kpiBuffer });
    res.json({ ok: true, stats });
  }
);

auditKpiRouter.post(
  "/project/:projectId/resync",
  requireRoles("admin", "office"),
  async (req, res) => {
    const stats = await seedAuditKpiFromSheets(prisma, req.params.projectId);
    res.json({ ok: true, stats });
  }
);

/** XLSX export matching client column layout */
auditKpiRouter.get("/project/:projectId/download/:sheet.xlsx", async (req, res) => {
  const projectId = req.params.projectId;
  const sheet = req.params.sheet;
  const wb = XLSX.utils.book_new();

  if (sheet === "findings") {
    const rows = await prisma.auditFinding.findMany({ where: { projectId }, orderBy: { srNo: "asc" } });
    const data = [
      ["SITE AUDIT FINDINGS AND CORRECTIVE ACTION"],
      [],
      ["#", "Finding ref.", "Source", "Ref. no.", "Folder / location", "Finding — what was actually found", "Photo ref.", "Severity", "Status"],
      ...rows.map((r) => [r.srNo, r.findingNo, r.source, r.refNo, r.folderLocation, r.description, r.photoRef, r.severity, r.status]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), "FINDINGS");
  } else if (sheet === "subjects") {
    const rows = await prisma.kpiSubject.findMany({ where: { projectId }, orderBy: { srNo: "asc" } });
    const data = [
      ["SUBJECT DATA — populated by the refresh"],
      [],
      [
        "#",
        "ISO area",
        "Folder",
        "ISO clause",
        "Subject",
        "Custodian",
        "Relative path",
        "Workbook file name",
        "Records",
        "Open",
        "Closed",
        "Overdue",
        "% Closed",
        "Oldest open (d)",
        "KRA score",
        "RAG",
      ],
      ...rows.map((r) => [
        r.srNo,
        r.isoArea,
        r.folder,
        r.isoClause,
        r.name,
        r.custodian,
        r.relativePath,
        r.workbookFileName,
        r.recordsCount,
        r.openCount,
        r.closedCount,
        r.overdueCount,
        r.pctClosed,
        r.oldestOpenDays,
        r.kraScore,
        r.rag,
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), "03_SUBJECT_DATA");
  } else {
    return res.status(404).json({ error: "Unknown sheet export" });
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="Sharnam-${sheet}.xlsx"`);
  res.send(buf);
});
