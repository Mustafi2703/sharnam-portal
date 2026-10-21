import { Router } from "express";
import { guardProjectParam, guardRecord } from "../modules/_shared/projectAccess.js";
import multer from "multer";
import * as XLSX from "xlsx";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { seedAuditKpiFromSheets, seedChecklistForAudit } from "../modules/audit-kpi/seedFromSheets.js";
import { audit } from "../services/audit.js";
import { mockOneDrive } from "../services/mockOneDrive.js";
import {
  auditScoreFor,
  countUnlinkedLowScores,
  isAuditClosed,
  listProjectAudits,
  nextAuditRef,
  resolveAudit,
} from "../modules/audit-kpi/audits.js";
import { listDriveSuggestions } from "../modules/audit-kpi/driveSuggestions.js";
import { computeKpiSnapshot, snapshotTrendWeek } from "../modules/audit-kpi/snapshot.js";
import { refreshProjectSubjects } from "../modules/audit-kpi/subjectSources.js";
import {
  SITE_WALK_EVIDENCE_FOLDER,
  asFraction,
  findingTiming,
  kpiRag,
  roleKraResult,
  mergeDetailPatch,
  parseDetail,
  subjectPctClosed,
  subjectRag,
  type DetailMap,
} from "../modules/audit-kpi/scoring.js";

export const auditKpiRouter = Router();
auditKpiRouter.use(requireAuth);
guardProjectParam(auditKpiRouter);
guardRecord(auditKpiRouter, "/findings/:id", async (id) => {
  const row = await prisma.auditFinding.findUnique({ where: { id }, select: { projectId: true } });
  return row?.projectId;
});
guardRecord(auditKpiRouter, "/checklist/:id", async (id) => {
  const row = await prisma.auditChecklistItem.findUnique({ where: { id }, select: { projectId: true } });
  return row?.projectId;
});
guardRecord(auditKpiRouter, "/subjects/:id", async (id) => {
  const row = await prisma.kpiSubject.findUnique({ where: { id }, select: { projectId: true } });
  return row?.projectId;
});
guardRecord(auditKpiRouter, "/role-kra/:id", async (id) => {
  const row = await prisma.kpiRoleKra.findUnique({ where: { id }, select: { projectId: true } });
  return row?.projectId;
});
guardRecord(auditKpiRouter, "/trend/:id", async (id) => {
  const row = await prisma.kpiTrendWeek.findUnique({ where: { id }, select: { projectId: true } });
  return row?.projectId;
});
guardRecord(
  auditKpiRouter,
  "/audits/:auditId",
  async (id) => {
    const row = await prisma.siteAudit.findUnique({ where: { id }, select: { projectId: true } });
    return row?.projectId;
  },
  "auditId"
);

const editors = ["admin", "office", "employee"] as const;
const walkEditors = ["admin", "office", "employee", "site_employee"] as const;

function presentFinding<T extends { dueDate: Date | null; closedAt: Date | null; status: string }>(row: T) {
  return { ...row, ...findingTiming(row) };
}

function presentChecklist<T extends { detailJson: string | null }>(row: T) {
  return { ...row, detail: parseDetail(row.detailJson) };
}

function presentSubject<T extends Parameters<typeof subjectRag>[0] & { pctClosed: number | null; rag: string }>(row: T) {
  return { ...row, pctClosed: subjectPctClosed(row), rag: subjectRag(row) };
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function csvEscape(v: unknown) {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: unknown[][]) {
  return [headers.join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");
}

/** @deprecated Prefer GET /audits/:auditId/dashboard. Resolves to the latest open audit. */
auditKpiRouter.get("/project/:projectId/dashboard", async (req, res) => {
  const projectId = req.params.projectId;
  const audit = await resolveAudit(projectId, req.query.auditId ? String(req.query.auditId) : null);
  const [findings, snap, auditScore] = await Promise.all([
    prisma.auditFinding.findMany({
      where: { projectId, ...(audit ? { siteAuditId: audit.id } : {}) },
      orderBy: { srNo: "asc" },
      include: { siteAudit: { select: { id: true, auditRef: true } } },
    }),
    computeKpiSnapshot(projectId),
    audit ? auditScoreFor(audit.id) : Promise.resolve(null),
  ]);
  const closedFindings = findings.filter((row) => row.status === "Closed").length;
  res.json({
    audit,
    auditScore,
    kpi: snap.kpi,
    totals: {
      findings: findings.length,
      openFindings: findings.length - closedFindings,
      closedFindings,
      checklistItems: auditScore ? auditScore.walkChecks + auditScore.folders : 0,
      subjects: snap.presented.length,
      overdueSubjects: snap.presented.filter((row) => row.overdueCount > 0).length,
      ragCounts: {
        RED: snap.roll.totals.red,
        AMBER: snap.roll.totals.amber,
        GREEN: snap.roll.totals.green,
        UNUSED: snap.roll.totals.unused,
      },
      avgClosurePct: Math.round(snap.roll.totals.pctClosed * 100),
    },
    findings: findings.map(presentFinding),
    subjects: snap.presented.slice(0, 50),
    subjectCount: snap.presented.length,
  });
});

auditKpiRouter.get("/project/:projectId/audits", async (req, res) => {
  const audits = await listProjectAudits(req.params.projectId);
  res.json({ audits });
});

auditKpiRouter.post(
  "/project/:projectId/audits",
  requireRoles(...editors),
  async (req: AuthedRequest, res) => {
    const projectId = req.params.projectId;
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { code: true } });
    if (!project) return res.status(404).json({ error: "Project not found" });
    const body = req.body || {};
    const planned = body.plannedDate ? new Date(String(body.plannedDate)) : null;
    const row = await prisma.siteAudit.create({
      data: {
        projectId,
        title: body.title ? String(body.title) : "Site document audit",
        auditRef: await nextAuditRef(projectId, project.code),
        status: "Planned",
        leadAuditor: body.leadAuditor ? String(body.leadAuditor) : null,
        plannedDate: planned,
        auditDate: body.auditDate ? new Date(String(body.auditDate)) : planned,
      },
    });
    const seeded = await seedChecklistForAudit(prisma, projectId, row.id);
    res.status(201).json({ audit: row, checklistAdded: seeded.checklistAdded });
  }
);

auditKpiRouter.get("/audits/:auditId", async (req, res) => {
  const audit = await prisma.siteAudit.findUnique({ where: { id: req.params.auditId } });
  if (!audit) return res.status(404).json({ error: "Not found" });
  const auditScore = await auditScoreFor(audit.id);
  res.json({ audit, auditScore });
});

auditKpiRouter.get("/audits/:auditId/checklist", async (req, res) => {
  const section = req.query.section ? String(req.query.section) : undefined;
  const rows = await prisma.auditChecklistItem.findMany({
    where: { siteAuditId: req.params.auditId, ...(section ? { section } : {}) },
    orderBy: [{ section: "asc" }, { itemNo: "asc" }],
  });
  res.json({ items: rows.map(presentChecklist) });
});

auditKpiRouter.get("/audits/:auditId/dashboard", async (req, res) => {
  const audit = await prisma.siteAudit.findUnique({ where: { id: req.params.auditId } });
  if (!audit) return res.status(404).json({ error: "Not found" });
  const auditScore = await auditScoreFor(audit.id);
  res.json({ audit, auditScore });
});

function findingData(body: Record<string, unknown>, userName?: string) {
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
    "preventiveAction",
    "owner",
    "rootCause",
    "verifiedBy",
    "isoArea",
    "subjectCode",
  ] as const) {
    if (body[k] !== undefined) data[k] = body[k] === "" ? null : body[k];
  }
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(String(body.dueDate)) : null;
  if (body.closedAt !== undefined) data.closedAt = body.closedAt ? new Date(String(body.closedAt)) : null;
  if (body.status === "Closed" && data.closedAt === undefined && body.closedAt === undefined) data.closedAt = new Date();
  if (!data.owner && userName && body.owner === undefined) data.owner = userName;
  return data;
}

auditKpiRouter.get("/project/:projectId/findings", async (req, res) => {
  const auditId = req.query.auditId ? String(req.query.auditId) : undefined;
  const rows = await prisma.auditFinding.findMany({
    where: { projectId: req.params.projectId, ...(auditId ? { siteAuditId: auditId } : {}) },
    orderBy: { srNo: "asc" },
    include: { siteAudit: { select: { id: true, auditRef: true } } },
  });
  res.json({ findings: rows.map(presentFinding) });
});

auditKpiRouter.post(
  "/project/:projectId/findings",
  requireRoles(...editors),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    if (!body.description) return res.status(400).json({ error: "description required" });
    const projectId = req.params.projectId;
    const existingNos = await prisma.auditFinding.findMany({
      where: { projectId },
      select: { findingNo: true, srNo: true },
    });
    let findingNo = String(body.findingNo || "").trim();
    if (findingNo) {
      const existing = await prisma.auditFinding.findUnique({
        where: { projectId_findingNo: { projectId, findingNo } },
      });
      if (existing) {
        const row = await prisma.auditFinding.update({
          where: { id: existing.id },
          data: findingData(body),
        });
        return res.json(presentFinding(row));
      }
    } else {
      const used = new Set(existingNos.map((r) => r.findingNo));
      let n = existingNos.length + 1;
      findingNo = `SF-${String(n).padStart(3, "0")}`;
      while (used.has(findingNo)) {
        n += 1;
        findingNo = `SF-${String(n).padStart(3, "0")}`;
      }
    }
    const maxSr = existingNos.reduce((m, r) => Math.max(m, r.srNo || 0), 0);
    let siteAuditId: string | null = null;
    if (body.siteAuditId) {
      const linked = await prisma.siteAudit.findFirst({
        where: { id: String(body.siteAuditId), projectId },
        select: { id: true },
      });
      if (!linked) return res.status(400).json({ error: "Audit not found on this project" });
      siteAuditId = linked.id;
    } else {
      const siteAudit = await resolveAudit(projectId);
      siteAuditId = siteAudit?.id || null;
    }
    const row = await prisma.auditFinding.create({
      data: {
        projectId,
        siteAuditId,
        findingNo,
        srNo: body.srNo ? Number(body.srNo) : maxSr + 1,
        description: String(body.description),
        severity: body.severity || "Minor",
        status: body.status || "Open",
        ...findingData(body, req.user!.fullName),
      },
      include: { siteAudit: { select: { id: true, auditRef: true } } },
    });
    res.status(201).json(presentFinding(row));
  }
);

auditKpiRouter.patch(
  "/findings/:id",
  requireRoles(...editors),
  async (req: AuthedRequest, res) => {
    const existing = await prisma.auditFinding.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const row = await prisma.auditFinding.update({
      where: { id: existing.id },
      data: findingData(req.body || {}),
    });
    res.json(presentFinding(row));
  }
);

function checklistWrite(body: Record<string, unknown>, existingDetail?: string | null) {
  const data: Record<string, unknown> = {};
  for (const k of ["locationChecked", "observed", "photoRef", "response", "notes", "prompt"] as const) {
    if (body[k] !== undefined) data[k] = body[k] === "" ? null : body[k];
  }
  if (body.score !== undefined) {
    const raw = String(body.score).trim().toUpperCase();
    if (raw === "" || raw === "N/A" || raw === "NA") data.score = null;
    else {
      const n = Number(body.score);
      data.score = n === 0 || n === 1 || n === 2 ? n : null;
    }
  }
  if (body.detail && typeof body.detail === "object") {
    const patch: DetailMap = {};
    for (const [k, v] of Object.entries(body.detail as Record<string, unknown>)) {
      patch[k] = v == null ? "" : String(v);
    }
    data.detailJson = mergeDetailPatch(existingDetail, patch);
  }
  return data;
}

/** @deprecated Prefer GET /audits/:auditId/checklist. Resolves to the latest open audit. */
auditKpiRouter.get("/project/:projectId/checklist", async (req, res) => {
  const section = req.query.section ? String(req.query.section) : undefined;
  const audit = await resolveAudit(req.params.projectId, req.query.auditId ? String(req.query.auditId) : null);
  const rows = await prisma.auditChecklistItem.findMany({
    where: {
      projectId: req.params.projectId,
      ...(audit ? { siteAuditId: audit.id } : {}),
      ...(section ? { section } : {}),
    },
    orderBy: [{ section: "asc" }, { itemNo: "asc" }],
  });
  res.json({ items: rows.map(presentChecklist) });
});

auditKpiRouter.patch(
  "/checklist/:id",
  requireRoles(...walkEditors),
  async (req: AuthedRequest, res) => {
    const existing = await prisma.auditChecklistItem.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (req.user!.role === "site_employee" && existing.section !== "SiteWalk") {
      return res.status(403).json({ error: "Site staff can update the site walk only" });
    }
    const parent = await prisma.siteAudit.findUnique({ where: { id: existing.siteAuditId }, select: { status: true } });
    if (parent && isAuditClosed(parent.status) && req.body?.score !== undefined) {
      return res.status(400).json({ error: "This audit is closed. Scores are read-only." });
    }
    const detail = req.body?.detail;
    if (detail && typeof detail === "object" && "findingRef" in detail) {
      const ref = String((detail as { findingRef?: unknown }).findingRef || "").trim();
      if (ref) {
        const finding = await prisma.auditFinding.findFirst({
          where: { projectId: existing.projectId, findingNo: ref, siteAuditId: existing.siteAuditId },
          select: { id: true },
        });
        if (!finding) return res.status(400).json({ error: "Finding ref is not on this audit" });
      }
    }
    const row = await prisma.auditChecklistItem.update({
      where: { id: existing.id },
      data: checklistWrite(req.body || {}, existing.detailJson),
    });
    res.json(presentChecklist(row));
  }
);

auditKpiRouter.post(
  "/project/:projectId/checklist",
  requireRoles(...editors),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const section = String(body.section || "").trim();
    const prompt = String(body.prompt || "").trim();
    if (!section || !prompt) return res.status(400).json({ error: "section and prompt required" });
    if (section === "FolderSample" && body.locationChecked) {
      const detail = body.detail && typeof body.detail === "object" ? { ...body.detail } : {};
      if (!detail.folder) detail.folder = String(body.locationChecked);
      body.detail = detail;
    }
    const projectId = req.params.projectId;
    const audit = body.siteAuditId
      ? await prisma.siteAudit.findFirst({ where: { id: String(body.siteAuditId), projectId } })
      : await resolveAudit(projectId);
    if (!audit) return res.status(400).json({ error: "Create an audit before adding rows" });
    const requestedNo = body.itemNo != null && body.itemNo !== "" ? Number(body.itemNo) : null;
    if (requestedNo != null) {
      const existing = await prisma.auditChecklistItem.findUnique({
        where: { siteAuditId_section_itemNo: { siteAuditId: audit.id, section, itemNo: requestedNo } },
      });
      if (existing) {
        const row = await prisma.auditChecklistItem.update({
          where: { id: existing.id },
          data: checklistWrite(body, existing.detailJson),
        });
        return res.json(presentChecklist(row));
      }
    }
    const maxNo = await prisma.auditChecklistItem.aggregate({
      where: { siteAuditId: audit.id, section },
      _max: { itemNo: true },
    });
    const itemNo = requestedNo ?? (maxNo._max.itemNo ?? 0) + 1;
    const row = await prisma.auditChecklistItem.create({
      data: {
        projectId,
        siteAuditId: audit.id,
        section,
        itemNo,
        prompt,
        ...checklistWrite(body),
      },
    });
    res.status(201).json(presentChecklist(row));
  }
);

auditKpiRouter.post(
  "/checklist/:id/evidence",
  requireRoles(...walkEditors),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    if (!req.file?.buffer?.length) return res.status(400).json({ error: "Photo or file required" });
    const item = await prisma.auditChecklistItem.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: "Not found" });
    if (item.section !== "SiteWalk") return res.status(400).json({ error: "Evidence upload is for a site walk line" });
    const project = await prisma.project.findUnique({ where: { id: item.projectId }, select: { code: true } });
    if (!project) return res.status(404).json({ error: "Project not found" });
    const saved = await mockOneDrive.upload(
      project.code,
      `${SITE_WALK_EVIDENCE_FOLDER}/${item.itemNo}`,
      req.file.originalname || "evidence",
      req.file.buffer,
      req.file.mimetype || "application/octet-stream"
    );
    await mockOneDrive.touchFolder(item.projectId, `${SITE_WALK_EVIDENCE_FOLDER}/${item.itemNo}`);
    const photoRef = req.file.originalname || saved.path.split("/").pop() || "evidence";
    const row = await prisma.auditChecklistItem.update({
      where: { id: item.id },
      data: {
        photoRef,
        evidenceUrl: saved.sharePointUrl || saved.url,
        evidenceName: photoRef,
      },
    });
    await audit("audit_kpi.evidence", {
      userId: req.user!.id,
      entity: "AuditChecklistItem",
      entityId: item.id,
      meta: { projectId: item.projectId, path: saved.path },
    });
    res.status(201).json(presentChecklist(row));
  }
);

function readKraScore(v: unknown): { ok: true; value: string | null } | { ok: false } {
  if (v == null || String(v).trim() === "") return { ok: true, value: null };
  const s = String(v).trim();
  if (!/^[1-5]$/.test(s)) return { ok: false };
  return { ok: true, value: s };
}

function intField(v: unknown, fallback = 0) {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function subjectFigures(body: Record<string, unknown>, base?: {
  recordsCount: number;
  openCount: number;
  closedCount: number;
  overdueCount: number;
  oldestOpenDays: number | null;
  kraScore: number | null;
}) {
  const recordsCount = body.recordsCount !== undefined ? intField(body.recordsCount) : base?.recordsCount ?? 0;
  const openCount = body.openCount !== undefined ? intField(body.openCount) : base?.openCount ?? 0;
  const closedCount = body.closedCount !== undefined ? intField(body.closedCount) : base?.closedCount ?? 0;
  const overdueCount = body.overdueCount !== undefined ? intField(body.overdueCount) : base?.overdueCount ?? 0;
  const oldestOpenDays =
    body.oldestOpenDays !== undefined
      ? body.oldestOpenDays === "" || body.oldestOpenDays == null
        ? null
        : intField(body.oldestOpenDays)
      : base?.oldestOpenDays ?? null;
  let kraScore = base?.kraScore ?? null;
  if (body.kraScore !== undefined) {
    if (body.kraScore === "" || body.kraScore == null) kraScore = null;
    else kraScore = asFraction(Number(body.kraScore));
  }
  const figures = { recordsCount, openCount, closedCount, overdueCount, oldestOpenDays, kraScore };
  return { ...figures, pctClosed: subjectPctClosed(figures), rag: subjectRag(figures) };
}

auditKpiRouter.get("/project/:projectId/subjects", async (req, res) => {
  const rows = await prisma.kpiSubject.findMany({
    where: { projectId: req.params.projectId },
    orderBy: { srNo: "asc" },
  });
  res.json({ subjects: rows.map((row) => presentSubject(row)) });
});

auditKpiRouter.post(
  "/project/:projectId/subjects",
  requireRoles(...editors),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    if (!body.name || !body.isoArea) return res.status(400).json({ error: "name and isoArea required" });
    const projectId = req.params.projectId;
    const maxSr = await prisma.kpiSubject.aggregate({ where: { projectId }, _max: { srNo: true } });
    const srNo = body.srNo ? Number(body.srNo) : (maxSr._max.srNo ?? 0) + 1;
    const figures = subjectFigures(body);
    const existing = await prisma.kpiSubject.findUnique({ where: { projectId_srNo: { projectId, srNo } } });
    if (existing) {
      const row = await prisma.kpiSubject.update({
        where: { id: existing.id },
        data: {
          isoArea: body.isoArea,
          folder: body.folder || body.isoArea,
          isoClause: body.isoClause || existing.isoClause,
          name: body.name,
          custodian: body.custodian || existing.custodian,
          ...subjectFigures(body, existing),
        },
      });
      return res.json(presentSubject(row));
    }
    const row = await prisma.kpiSubject.create({
      data: {
        projectId,
        srNo,
        isoArea: body.isoArea,
        folder: body.folder || body.isoArea,
        isoClause: body.isoClause || null,
        name: body.name,
        custodian: body.custodian || "HO",
        relativePath: body.relativePath || null,
        workbookFileName: body.workbookFileName || null,
        ...figures,
      },
    });
    res.status(201).json(presentSubject(row));
  }
);

auditKpiRouter.patch(
  "/subjects/:id",
  requireRoles(...editors),
  async (req: AuthedRequest, res) => {
    const existing = await prisma.kpiSubject.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const body = req.body || {};
    const portalFields = ["recordsCount", "openCount", "closedCount", "overdueCount", "oldestOpenDays", "pctClosed", "rag"] as const;
    if (existing.dataSource?.startsWith("portal:") && portalFields.some((key) => body[key] !== undefined)) {
      return res.status(400).json({ error: "This subject is filled from the portal. Run refresh instead." });
    }
    const data: Record<string, unknown> = { ...subjectFigures(body, existing) };
    for (const k of ["isoArea", "folder", "isoClause", "name", "custodian", "relativePath", "workbookFileName"] as const) {
      if (body[k] !== undefined) data[k] = body[k] === "" ? null : body[k];
    }
    if (body.name === "") return res.status(400).json({ error: "name required" });
    const row = await prisma.kpiSubject.update({ where: { id: existing.id }, data });
    res.json(presentSubject(row));
  }
);

auditKpiRouter.get("/project/:projectId/role-kra", async (req, res) => {
  const projectId = req.params.projectId;
  const [rows, subjects] = await Promise.all([
    prisma.kpiRoleKra.findMany({ where: { projectId }, orderBy: [{ roleKey: "asc" }, { kraNo: "asc" }] }),
    prisma.kpiSubject.findMany({ where: { projectId } }),
  ]);
  const presented = subjects.map((s) => presentSubject(s));
  const byRole = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byRole.get(row.roleKey) || [];
    list.push(row);
    byRole.set(row.roleKey, list);
  }
  const roleSummary = new Map<string, ReturnType<typeof roleKraResult> & { holder: string | null; subjectCount: number; redCount: number; amberCount: number; greenCount: number; avgKra: number | null; subjectKraScored: number }>();
  for (const [roleKey, lines] of byRole) {
    const owns = lines.find((row) => row.kraNo === "OWNS");
    const area = owns?.description || "";
    const owned = area === "All areas" || !area ? presented : presented.filter((s) => s.isoArea === area);
    const kraValues = owned.map((s) => asFraction(s.kraScore)).filter((n): n is number => n != null);
    const scores = lines
      .filter((row) => row.lineKind === "kra")
      .map((row) => (/^[1-5]$/.test(row.reviewerScore || "") ? Number(row.reviewerScore) : null));
    const outcome = roleKraResult(scores);
    roleSummary.set(roleKey, {
      ...outcome,
      holder: owns?.holder || lines.find((row) => row.holder)?.holder || null,
      subjectCount: owned.length,
      redCount: owned.filter((s) => s.rag === "RED").length,
      amberCount: owned.filter((s) => s.rag === "AMBER").length,
      greenCount: owned.filter((s) => s.rag === "GREEN").length,
      avgKra: kraValues.length ? kraValues.reduce((a, n) => a + n, 0) / kraValues.length : null,
      subjectKraScored: kraValues.length,
    });
  }
  const kras = rows.map((row) => {
    const summary = roleSummary.get(row.roleKey);
    const auto = row.lineKind === "kpi" ? kpiRag(row.target, row.actual) : null;
    const score = row.lineKind === "kra" && /^[1-5]$/.test(row.reviewerScore || "") ? row.reviewerScore : null;
    return {
      ...row,
      score,
      periodRag: auto ?? row.periodRag,
      ragAutomatic: auto != null,
      subjectCount: summary?.subjectCount ?? 0,
      redCount: summary?.redCount ?? 0,
      amberCount: summary?.amberCount ?? 0,
      greenCount: summary?.greenCount ?? 0,
      avgKra: summary?.avgKra ?? null,
      subjectKraScored: summary?.subjectKraScored ?? 0,
      kraAverage: summary?.kraAverage ?? null,
      kraScored: summary?.kraScored ?? 0,
      kraLines: summary?.kraLines ?? 0,
      result: summary?.result ?? "INCOMPLETE",
      holder: row.holder || summary?.holder || null,
    };
  });
  const roles = [...roleSummary.entries()].map(([roleKey, summary]) => ({ roleKey, ...summary }));
  res.json({ kras, roles });
});

auditKpiRouter.post(
  "/project/:projectId/role-kra",
  requireRoles(...editors),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const roleKey = String(body.roleKey || "").trim();
    const kraNo = String(body.kraNo || "").trim();
    if (!roleKey || !kraNo) return res.status(400).json({ error: "roleKey and kraNo required" });
    const projectId = req.params.projectId;
    const existing = await prisma.kpiRoleKra.findFirst({ where: { projectId, roleKey, kraNo } });
    const self = readKraScore(body.selfScore);
    const reviewer = readKraScore(body.reviewerScore);
    if (!self.ok || !reviewer.ok) return res.status(400).json({ error: "Score must be a whole number from 1 to 5" });
    const lineKind = body.lineKind ? String(body.lineKind) : kraNo.startsWith("KRA") ? "kra" : "kpi";
    const target = body.target ? String(body.target) : existing?.target || null;
    const actual = body.actual != null && body.actual !== "" ? String(body.actual) : existing?.actual || null;
    const auto = lineKind === "kpi" ? kpiRag(target, actual) : null;
    const data = {
      description: body.description ? String(body.description) : null,
      consequence: body.consequence ? String(body.consequence) : null,
      evidenceHint: body.evidenceHint ? String(body.evidenceHint) : null,
      target,
      lineKind,
      holder: body.holder ? String(body.holder) : null,
      selfScore: body.selfScore !== undefined ? self.value : existing?.selfScore || null,
      reviewerScore: body.reviewerScore !== undefined ? reviewer.value : existing?.reviewerScore || null,
      actual,
      periodRag: auto ?? (body.periodRag ? String(body.periodRag) : null),
    };
    const row = existing
      ? await prisma.kpiRoleKra.update({ where: { id: existing.id }, data })
      : await prisma.kpiRoleKra.create({ data: { projectId, roleKey, kraNo, ...data } });
    res.status(existing ? 200 : 201).json(row);
  }
);

auditKpiRouter.patch(
  "/role-kra/:id",
  requireRoles(...editors),
  async (req: AuthedRequest, res) => {
    const existing = await prisma.kpiRoleKra.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const body = req.body || {};
    const data: Record<string, unknown> = {};
    if (body.selfScore !== undefined) {
      const self = readKraScore(body.selfScore);
      if (!self.ok) return res.status(400).json({ error: "Score must be a whole number from 1 to 5" });
      data.selfScore = self.value;
    }
    if (body.reviewerScore !== undefined) {
      const reviewer = readKraScore(body.reviewerScore);
      if (!reviewer.ok) return res.status(400).json({ error: "Score must be a whole number from 1 to 5" });
      data.reviewerScore = reviewer.value;
    }
    for (const k of [
      "description",
      "consequence",
      "evidenceHint",
      "target",
      "holder",
      "actual",
      "periodRag",
      "lineKind",
      "roleKey",
      "kraNo",
    ] as const) {
      if (body[k] !== undefined) data[k] = body[k] === "" ? null : String(body[k]);
    }
    const target = "target" in data ? (data.target as string | null) : existing.target;
    const actual = "actual" in data ? (data.actual as string | null) : existing.actual;
    const lineKind = String(data.lineKind ?? existing.lineKind ?? "");
    const auto = lineKind === "kpi" ? kpiRag(target, actual) : null;
    if (auto) data.periodRag = auto;
    const row = await prisma.kpiRoleKra.update({ where: { id: existing.id }, data });
    res.json(row);
  }
);

auditKpiRouter.get("/project/:projectId/trend", async (req, res) => {
  const rows = await prisma.kpiTrendWeek.findMany({
    where: { projectId: req.params.projectId },
    orderBy: [{ sortOrder: "asc" }, { weekEnding: "asc" }],
  });
  const withMovement = rows.map((row, i) => {
    const prev = i > 0 ? rows[i - 1].overdueCount : null;
    const movement =
      row.overdueCount == null || prev == null ? null : row.overdueCount - prev;
    return { ...row, movement };
  });
  res.json({ weeks: withMovement });
});

auditKpiRouter.post(
  "/project/:projectId/trend/snapshot",
  requireRoles(...editors),
  async (req, res) => {
    const out = await snapshotTrendWeek(req.params.projectId, { force: req.query.force === "1" });
    if (!out.ok) {
      return res.status(409).json({ error: "This week was typed by hand.", week: out.week, weekEnding: out.weekEnding });
    }
    res.json({ ok: true, week: out.week, weekEnding: out.weekEnding });
  }
);

auditKpiRouter.post(
  "/project/:projectId/trend",
  requireRoles(...editors),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const weekEnding = String(body.weekEnding || "").trim();
    if (!weekEnding) return res.status(400).json({ error: "weekEnding required" });
    const projectId = req.params.projectId;
    const count = await prisma.kpiTrendWeek.count({ where: { projectId } });
    const data = {
      recordsCount: body.recordsCount === "" || body.recordsCount == null ? null : intField(body.recordsCount),
      openCount: body.openCount === "" || body.openCount == null ? null : intField(body.openCount),
      closedCount: body.closedCount === "" || body.closedCount == null ? null : intField(body.closedCount),
      pctClosed: body.pctClosed === "" || body.pctClosed == null ? null : asFraction(Number(body.pctClosed)),
      overdueCount: body.overdueCount === "" || body.overdueCount == null ? null : intField(body.overdueCount),
      subjectsRed: body.subjectsRed === "" || body.subjectsRed == null ? null : intField(body.subjectsRed),
      kraScore: body.kraScore === "" || body.kraScore == null ? null : asFraction(Number(body.kraScore)),
      oldestOpenDays: body.oldestOpenDays === "" || body.oldestOpenDays == null ? null : intField(body.oldestOpenDays),
      notYetUsed: body.notYetUsed === "" || body.notYetUsed == null ? null : intField(body.notYetUsed),
      comment: body.comment ? String(body.comment) : null,
    };
    const row = await prisma.kpiTrendWeek.upsert({
      where: { projectId_weekEnding: { projectId, weekEnding } },
      create: { projectId, weekEnding, sortOrder: count + 1, source: "manual", ...data },
      update: { ...data, source: "manual" },
    });
    res.status(201).json(row);
  }
);

auditKpiRouter.patch(
  "/trend/:id",
  requireRoles(...editors),
  async (req: AuthedRequest, res) => {
    const existing = await prisma.kpiTrendWeek.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const body = req.body || {};
    const data: Record<string, unknown> = {};
    for (const k of [
      "recordsCount",
      "openCount",
      "closedCount",
      "overdueCount",
      "subjectsRed",
      "oldestOpenDays",
      "notYetUsed",
    ] as const) {
      if (body[k] !== undefined) data[k] = body[k] === "" || body[k] == null ? null : intField(body[k]);
    }
    if (body.pctClosed !== undefined) data.pctClosed = body.pctClosed === "" || body.pctClosed == null ? null : asFraction(Number(body.pctClosed));
    if (body.kraScore !== undefined) data.kraScore = body.kraScore === "" || body.kraScore == null ? null : asFraction(Number(body.kraScore));
    if (body.comment !== undefined) data.comment = body.comment ? String(body.comment) : null;
    if (body.weekEnding) data.weekEnding = String(body.weekEnding);
    data.source = "manual";
    const row = await prisma.kpiTrendWeek.update({ where: { id: existing.id }, data });
    res.json(row);
  }
);

/** @deprecated Prefer PATCH /audits/:auditId. Resolves to the latest open audit. */
auditKpiRouter.patch(
  "/project/:projectId/header",
  requireRoles(...editors),
  async (req: AuthedRequest, res) => {
    const projectId = req.params.projectId;
    const body = req.body || {};
    const data: Record<string, unknown> = {};
    for (const k of [
      "title",
      "auditRef",
      "status",
      "leadAuditor",
      "documentController",
      "projectManager",
      "independentOfProject",
      "areasWalked",
      "accompaniedBy",
      "interviewee",
      "intervieweeRole",
      "scopeNotes",
    ] as const) {
      if (body[k] !== undefined) data[k] = body[k] === "" ? null : String(body[k]);
    }
    if (body.plannedDate !== undefined) data.plannedDate = body.plannedDate ? new Date(String(body.plannedDate)) : null;
    if (body.auditDate !== undefined) data.auditDate = body.auditDate ? new Date(String(body.auditDate)) : null;
    const existing = await resolveAudit(projectId, req.query.auditId ? String(req.query.auditId) : body.auditId ? String(body.auditId) : null);
    if (data.status === "Closed") {
      const targetId = existing?.id;
      if (targetId) {
        const unlinked = await countUnlinkedLowScores(targetId);
        if (unlinked > 0) {
          return res.status(400).json({ error: `${unlinked} scores below 2 have no finding` });
        }
      }
      data.closedAt = new Date();
    }
    const title = data.title ? String(data.title) : "Site document audit";
    delete data.title;
    if (existing) {
      const row = await prisma.siteAudit.update({
        where: { id: existing.id },
        data: { ...data, ...(body.title !== undefined ? { title } : {}) },
      });
      return res.json(row);
    }
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { code: true } });
    const row = await prisma.siteAudit.create({
      data: {
        projectId,
        title,
        auditRef: await nextAuditRef(projectId, project?.code || "PROJECT"),
        status: "Planned",
        ...data,
      },
    });
    res.json(row);
  }
);

auditKpiRouter.patch(
  "/audits/:auditId",
  requireRoles(...editors),
  async (req: AuthedRequest, res) => {
    const existing = await prisma.siteAudit.findUnique({ where: { id: req.params.auditId } });
    if (!existing) return res.status(404).json({ error: "Not found" });
    req.params.projectId = existing.projectId;
    req.body = { ...(req.body || {}), auditId: existing.id };
    req.query.auditId = existing.id;
    // Reuse the project header writer by calling the same updates here.
    const body = req.body || {};
    const data: Record<string, unknown> = {};
    for (const k of [
      "title",
      "auditRef",
      "status",
      "leadAuditor",
      "documentController",
      "projectManager",
      "independentOfProject",
      "areasWalked",
      "accompaniedBy",
      "interviewee",
      "intervieweeRole",
      "scopeNotes",
    ] as const) {
      if (body[k] !== undefined) data[k] = body[k] === "" ? null : String(body[k]);
    }
    if (body.plannedDate !== undefined) data.plannedDate = body.plannedDate ? new Date(String(body.plannedDate)) : null;
    if (body.auditDate !== undefined) data.auditDate = body.auditDate ? new Date(String(body.auditDate)) : null;
    if (data.status === "Closed") {
      const unlinked = await countUnlinkedLowScores(existing.id);
      if (unlinked > 0) return res.status(400).json({ error: `${unlinked} scores below 2 have no finding` });
      data.closedAt = new Date();
    }
    if (body.title !== undefined) data.title = body.title ? String(body.title) : existing.title;
    const row = await prisma.siteAudit.update({ where: { id: existing.id }, data });
    res.json(row);
  }
);

auditKpiRouter.get("/project/:projectId/drive-suggestions", async (req, res) => {
  const out = await listDriveSuggestions(req.params.projectId, { refresh: req.query.refresh === "1" });
  if (!out) return res.status(404).json({ error: "Project not found" });
  res.json(out);
});

auditKpiRouter.post(
  "/project/:projectId/drive-accept",
  requireRoles(...editors),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const kind = body.kind === "file" ? "file" : "folder";
    const folder = String(body.folder || "").trim();
    const area = String(body.area || "").trim();
    const filePath = String(body.path || "").trim();
    const name = String(body.name || folder || filePath).trim();
    if (!folder && !filePath) return res.status(400).json({ error: "folder or path required" });
    const projectId = req.params.projectId;
    const rows = await prisma.auditChecklistItem.findMany({ where: { projectId, section: "FolderSample" } });
    const match = rows.find((row) => {
      const detail = parseDetail(row.detailJson);
      return (
        (folder && (detail.folder || "").toLowerCase() === folder.toLowerCase()) ||
        (filePath && (detail.path || "").toLowerCase() === filePath.toLowerCase()) ||
        (folder && (row.locationChecked || "").toLowerCase() === folder.toLowerCase())
      );
    });
    if (kind === "file" && match) {
      const detail = parseDetail(match.detailJson);
      const already = `${detail.sampled || ""}`.toLowerCase().includes(name.toLowerCase());
      if (already) return res.json(presentChecklist(match));
      const sampled = detail.sampled ? `${detail.sampled}; ${name}` : name;
      const row = await prisma.auditChecklistItem.update({
        where: { id: match.id },
        data: { detailJson: mergeDetailPatch(match.detailJson, { sampled, recordsInLog: detail.recordsInLog || String(1) }) },
      });
      return res.json(presentChecklist(row));
    }
    if (match && kind === "folder") return res.json(presentChecklist(match));

    const maxNo = rows.reduce((m, r) => Math.max(m, r.itemNo), 0);
    const siteAudit = await resolveAudit(projectId, req.query.auditId ? String(req.query.auditId) : null);
    if (!siteAudit) return res.status(400).json({ error: "Create an audit before adding checklist items." });
    const row = await prisma.auditChecklistItem.create({
      data: {
        projectId,
        siteAuditId: siteAudit.id,
        section: "FolderSample",
        itemNo: maxNo + 1,
        prompt: kind === "file" ? name : folder || name,
        locationChecked: filePath || folder,
        detailJson: JSON.stringify({
          area,
          folder: folder || name,
          path: filePath,
          subject: kind === "file" ? name : folder,
          sampled: kind === "file" ? name : "",
          recordsInLog: kind === "file" ? "1" : "",
        }),
      },
    });
    res.status(201).json(presentChecklist(row));
  }
);

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
    const audit = await resolveAudit(projectId, req.query.auditId ? String(req.query.auditId) : null);
    const rows = await prisma.auditChecklistItem.findMany({
      where: { projectId, section, ...(audit ? { siteAuditId: audit.id } : {}) },
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
    const byRole = new Map<string, typeof src>();
    for (const row of src) {
      const list = byRole.get(row.roleKey) || [];
      list.push(row);
      byRole.set(row.roleKey, list);
    }
    const outcome = new Map<string, ReturnType<typeof roleKraResult>>();
    for (const [key, lines] of byRole) {
      outcome.set(
        key,
        roleKraResult(
          lines
            .filter((row) => row.lineKind === "kra")
            .map((row) => (/^[1-5]$/.test(row.reviewerScore || "") ? Number(row.reviewerScore) : null))
        )
      );
    }
    title = "Master KPI - Role KRA Templates";
    headers = ["Role", "KRA #", "Description", "Target", "Self", "Reviewer", "Score", "Actual", "RAG", "KRA average", "Result"];
    rows = src.map((row) => {
      const result = outcome.get(row.roleKey);
      const auto = row.lineKind === "kpi" ? kpiRag(row.target, row.actual) : null;
      const score = row.lineKind === "kra" && /^[1-5]$/.test(row.reviewerScore || "") ? row.reviewerScore : "";
      return [
        row.roleKey,
        row.kraNo,
        row.description,
        row.target || row.consequence,
        row.selfScore,
        row.reviewerScore,
        score,
        row.actual,
        auto ?? row.periodRag,
        result?.kraAverage ?? "",
        result?.result ?? "",
      ];
    });
    filename = `MASTER_KPI_ROLE_KRA-${project.code}.xlsx`;
  } else if (sheetKey === "site-walk" || sheetKey === "dc-interview" || sheetKey === "folder-sample") {
    const section = sheetKey === "site-walk" ? "SiteWalk" : sheetKey === "dc-interview" ? "DcInterview" : "FolderSample";
    const audit = await resolveAudit(projectId, req.query.auditId ? String(req.query.auditId) : null);
    const src = await prisma.auditChecklistItem.findMany({
      where: { projectId, section, ...(audit ? { siteAuditId: audit.id } : {}) },
      orderBy: { itemNo: "asc" },
    });
    title = `Site Audit — ${section.replace(/([A-Z])/g, " $1").trim()}`;
    headers = ["#", "Prompt", "Location checked", "Observed", "Score", "Photo ref", "Response", "Notes"];
    rows = src.map((r) => [r.itemNo, r.prompt, r.locationChecked, r.observed, r.score, r.photoRef, r.response, r.notes]);
    filename = `SITE_AUDIT_${section.toUpperCase()}-${project.code}.xlsx`;
  } else {
    return res.status(400).json({ error: "Unknown sheet — use findings | subjects | role-kra | site-walk | dc-interview | folder-sample" });
  }

  const buf = await workbookBuffer([{ name: title.slice(0, 31), rows: [headers, ...rows] }], {
    title,
    projectCode: project.code,
  });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buf);
});

/** Fills mapped subjects from their own portal register. Unmapped subjects stay typed. */
auditKpiRouter.post(
  "/project/:projectId/refresh",
  requireRoles(...editors),
  async (req: AuthedRequest, res) => {
    const projectId = req.params.projectId;
    const out = await refreshProjectSubjects(projectId);
    await audit("audit_kpi.refresh", {
      userId: req.user!.id,
      entity: "KpiSubject",
      entityId: projectId,
      meta: { updated: out.updated, total: out.subjects },
    });
    res.json({ ok: true, ...out });
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
  requireRoles(...editors),
  async (req, res) => {
    const stats = await seedAuditKpiFromSheets(prisma, req.params.projectId);
    res.json({ ok: true, stats });
  }
);
