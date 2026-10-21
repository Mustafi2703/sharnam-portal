import { Router } from "express";
import { guardProjectParam, guardRecord } from "../modules/_shared/projectAccess.js";
import multer from "multer";
import * as XLSX from "xlsx";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { seedAuditKpiFromSheets } from "../modules/audit-kpi/seedFromSheets.js";
import { audit } from "../services/audit.js";
import { mockOneDrive } from "../services/mockOneDrive.js";
import {
  SITE_WALK_EVIDENCE_FOLDER,
  asFraction,
  auditVerdict,
  findingTiming,
  findingsOpen,
  mergeDetailPatch,
  parseDetail,
  rollupAreas,
  subjectPctClosed,
  subjectRag,
  tallyScores,
  WALK_SECTIONS,
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

auditKpiRouter.get("/project/:projectId/dashboard", async (req, res) => {
  const projectId = req.params.projectId;
  const [findings, subjects, siteAudit, checklist] = await Promise.all([
    prisma.auditFinding.findMany({ where: { projectId }, orderBy: { srNo: "asc" } }),
    prisma.kpiSubject.findMany({ where: { projectId }, orderBy: { srNo: "asc" } }),
    prisma.siteAudit.findFirst({ where: { projectId }, orderBy: { createdAt: "desc" } }),
    prisma.auditChecklistItem.findMany({
      where: { projectId, section: { in: ["SiteWalk", "FolderSample"] } },
      select: { section: true, itemNo: true, score: true },
    }),
  ]);

  const walk = checklist.filter((r) => r.section === "SiteWalk");
  const folders = checklist.filter((r) => r.section === "FolderSample");
  const walkTally = tallyScores(walk.map((r) => r.score));
  const folderTally = tallyScores(folders.map((r) => r.score));
  const combined = tallyScores([...walk.map((r) => r.score), ...folders.map((r) => r.score)]);
  const critical = findings.filter((f) => f.severity === "Critical").length;
  const raised = findings.filter((f) => f.findingNo).length;
  const openBySheet = findingsOpen(findings.map((f) => f.status));
  const sections = WALK_SECTIONS.map((sec) => {
    const inBand = walk.filter((r) => r.itemNo >= sec.from && r.itemNo <= sec.to);
    const tally = tallyScores(inBand.map((r) => r.score));
    return { title: sec.title, checks: inBand.length, met: tally.met, notMet: tally.notMet, score: tally.score };
  });

  const presentedSubjects = subjects.map((s) => presentSubject(s));
  const roll = rollupAreas(presentedSubjects);
  const oldest = presentedSubjects.reduce((max, s) => Math.max(max, s.oldestOpenDays || 0), 0);
  const siteOverdue = presentedSubjects.filter((s) => s.custodian === "SITE" && s.overdueCount > 0).length;
  const hoOverdue = presentedSubjects.filter((s) => s.custodian === "HO" && s.overdueCount > 0).length;
  const withOverdue = presentedSubjects.filter((s) => s.overdueCount > 0).length;

  const closedFindings = findings.filter((f) => f.status === "Closed").length;
  res.json({
    audit: siteAudit,
    auditScore: {
      folders: folders.length,
      walkChecks: walk.length,
      scored: combined.scored,
      notMet: combined.notMet,
      overall: combined.score,
      critical,
      folderScore: folderTally.score,
      walkScore: walkTally.score,
      findingsRaised: raised,
      findingsOpen: openBySheet,
      verdict: auditVerdict(combined.score, critical),
      sections,
    },
    kpi: {
      subjects: roll.totals.subjects,
      records: roll.totals.records,
      open: roll.totals.open,
      closed: roll.totals.closed,
      pctClosed: roll.totals.pctClosed,
      avgKra: roll.totals.avgKra,
      overdueItems: roll.totals.overdue,
      red: roll.totals.red,
      amber: roll.totals.amber,
      green: roll.totals.green,
      inUse: roll.totals.subjects - roll.totals.unused,
      unused: roll.totals.unused,
      areas: roll.areas,
      health: [
        { indicator: "Subjects with any overdue item", value: withOverdue, target: "0", source: "All subjects" },
        { indicator: "Total overdue items on the project", value: roll.totals.overdue, target: "0", source: "All subjects" },
        { indicator: "Oldest open item (days)", value: oldest, target: "<= 14", source: "All subjects" },
        { indicator: "Overall closure rate", value: roll.totals.pctClosed, target: ">= 90%", source: "All subjects" },
        { indicator: "Average KRA score", value: roll.totals.avgKra, target: ">= 90%", source: "KRA score column" },
        { indicator: "Subjects red-rated", value: roll.totals.red, target: "0", source: "RAG" },
        { indicator: "SITE subjects with overdue", value: siteOverdue, target: "0", source: "Site custodian" },
        { indicator: "HO subjects with overdue", value: hoOverdue, target: "0", source: "Head office" },
        { indicator: "Subjects never used", value: roll.totals.unused, target: "Falling", source: "Adoption measure" },
      ],
    },
    totals: {
      findings: findings.length,
      openFindings: findings.length - closedFindings,
      closedFindings,
      checklistItems: checklist.length,
      subjects: presentedSubjects.length,
      overdueSubjects: withOverdue,
      ragCounts: {
        RED: roll.totals.red,
        AMBER: roll.totals.amber,
        GREEN: roll.totals.green,
        UNUSED: roll.totals.unused,
      },
      avgClosurePct: Math.round(roll.totals.pctClosed * 100),
    },
    findings: findings.map(presentFinding),
    subjects: presentedSubjects.slice(0, 50),
    subjectCount: presentedSubjects.length,
  });
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
  const rows = await prisma.auditFinding.findMany({
    where: { projectId: req.params.projectId },
    orderBy: { srNo: "asc" },
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
    const siteAudit = await prisma.siteAudit.findFirst({ where: { projectId }, select: { id: true } });
    const row = await prisma.auditFinding.create({
      data: {
        projectId,
        siteAuditId: siteAudit?.id || null,
        findingNo,
        srNo: body.srNo ? Number(body.srNo) : maxSr + 1,
        description: String(body.description),
        severity: body.severity || "Minor",
        status: body.status || "Open",
        ...findingData(body, req.user!.fullName),
      },
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

auditKpiRouter.get("/project/:projectId/checklist", async (req, res) => {
  const section = req.query.section ? String(req.query.section) : undefined;
  const rows = await prisma.auditChecklistItem.findMany({
    where: { projectId: req.params.projectId, ...(section ? { section } : {}) },
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
    const requestedNo = body.itemNo != null && body.itemNo !== "" ? Number(body.itemNo) : null;
    if (requestedNo != null) {
      const existing = await prisma.auditChecklistItem.findUnique({
        where: { projectId_section_itemNo: { projectId, section, itemNo: requestedNo } },
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
      where: { projectId, section },
      _max: { itemNo: true },
    });
    const itemNo = requestedNo ?? (maxNo._max.itemNo ?? 0) + 1;
    const siteAudit = await prisma.siteAudit.findFirst({ where: { projectId }, select: { id: true } });
    const row = await prisma.auditChecklistItem.create({
      data: {
        projectId,
        siteAuditId: siteAudit?.id || null,
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
        evidenceUrl: saved.url,
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
  const kras = rows.map((row) => {
    const owns = rows.find((r) => r.roleKey === row.roleKey && r.kraNo === "OWNS");
    const area = owns?.description || "";
    const owned = area === "All areas" || !area ? presented : presented.filter((s) => s.isoArea === area);
    const kraValues = owned.map((s) => asFraction(s.kraScore)).filter((n): n is number => n != null);
    return {
      ...row,
      subjectCount: owned.length,
      redCount: owned.filter((s) => s.rag === "RED").length,
      amberCount: owned.filter((s) => s.rag === "AMBER").length,
      greenCount: owned.filter((s) => s.rag === "GREEN").length,
      avgKra: kraValues.length ? kraValues.reduce((a, n) => a + n, 0) / kraValues.length : 0,
    };
  });
  res.json({ kras });
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
    const data = {
      description: body.description ? String(body.description) : null,
      consequence: body.consequence ? String(body.consequence) : null,
      evidenceHint: body.evidenceHint ? String(body.evidenceHint) : null,
      target: body.target ? String(body.target) : null,
      lineKind: body.lineKind ? String(body.lineKind) : kraNo.startsWith("KRA") ? "kra" : "kpi",
      holder: body.holder ? String(body.holder) : null,
      selfScore: body.selfScore != null ? String(body.selfScore) : null,
      reviewerScore: body.reviewerScore != null ? String(body.reviewerScore) : null,
      actual: body.actual != null ? String(body.actual) : null,
      periodRag: body.periodRag ? String(body.periodRag) : null,
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
    for (const k of [
      "description",
      "consequence",
      "evidenceHint",
      "target",
      "holder",
      "selfScore",
      "reviewerScore",
      "actual",
      "periodRag",
      "lineKind",
      "roleKey",
      "kraNo",
    ] as const) {
      if (body[k] !== undefined) data[k] = body[k] === "" ? null : String(body[k]);
    }
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
      create: { projectId, weekEnding, sortOrder: count + 1, ...data },
      update: data,
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
    const row = await prisma.kpiTrendWeek.update({ where: { id: existing.id }, data });
    res.json(row);
  }
);

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
    const existing = await prisma.siteAudit.findFirst({ where: { projectId }, orderBy: { createdAt: "asc" } });
    const title = data.title ? String(data.title) : "Site document audit";
    delete data.title;
    const row = existing
      ? await prisma.siteAudit.update({ where: { id: existing.id }, data: { ...data, ...(body.title !== undefined ? { title } : {}) } })
      : await prisma.siteAudit.create({
          data: {
            id: `${projectId}-audit-demo`,
            projectId,
            title,
            status: "Planned",
            ...data,
          },
        });
    res.json(row);
  }
);

auditKpiRouter.get("/project/:projectId/drive-suggestions", async (req, res) => {
  const projectId = req.params.projectId;
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { code: true } });
  if (!project) return res.status(404).json({ error: "Project not found" });
  const items = await prisma.auditChecklistItem.findMany({
    where: { projectId, section: "FolderSample" },
    select: { detailJson: true, locationChecked: true, notes: true, response: true, prompt: true },
  });
  const acceptedFolders = new Set<string>();
  const acceptedFiles = new Set<string>();
  for (const item of items) {
    const detail = parseDetail(item.detailJson);
    for (const key of [detail.folder, detail.path, item.locationChecked]) {
      if (key) acceptedFolders.add(key.toLowerCase());
    }
    const blob = `${detail.sampled || ""} ${detail.recordsInLog || ""} ${item.notes || ""} ${item.response || ""}`.toLowerCase();
    for (const part of blob.split(/[;\n,]/)) {
      const name = part.trim();
      if (name) acceptedFiles.add(name);
    }
  }

  const suggestions: Array<{
    kind: "folder" | "file";
    area: string;
    folder: string;
    path: string;
    name: string;
    fileCount?: number;
    accepted: boolean;
  }> = [];
  const roots = mockOneDrive.listChildren(project.code, "").filter((n) => n.type === "folder" && /^\d{2}_/.test(n.name));
  for (const area of roots) {
    for (const kid of mockOneDrive.listChildren(project.code, area.path)) {
      if (kid.type !== "folder") continue;
      const files = mockOneDrive.listChildren(project.code, kid.path).filter((f) => f.type === "file");
      if (!files.length) continue;
      const accepted = acceptedFolders.has(kid.name.toLowerCase()) || acceptedFolders.has(kid.path.toLowerCase());
      suggestions.push({
        kind: "folder",
        area: area.name,
        folder: kid.name,
        path: kid.path,
        name: kid.name,
        fileCount: files.length,
        accepted,
      });
      for (const file of files.slice(0, 12)) {
        suggestions.push({
          kind: "file",
          area: area.name,
          folder: kid.name,
          path: file.path,
          name: file.name,
          accepted: acceptedFiles.has(file.name.toLowerCase()),
        });
      }
    }
  }
  res.json({ suggestions: suggestions.slice(0, 300) });
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
    const siteAudit = await prisma.siteAudit.findFirst({ where: { projectId }, select: { id: true } });
    const row = await prisma.auditChecklistItem.create({
      data: {
        projectId,
        siteAuditId: siteAudit?.id || null,
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

  const buf = await workbookBuffer([{ name: title.slice(0, 31), rows: [headers, ...rows] }], {
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
    let updated = 0;
    const now2 = new Date();
    for (const s of subjects) {
      const roll = mapSubject(`${s.workbookFileName || ""} ${s.name}`);
      if (!roll) continue;
      const figures = subjectFigures(
        {
          recordsCount: roll.records,
          openCount: roll.open,
          closedCount: roll.closed,
          overdueCount: roll.overdue,
          oldestOpenDays: roll.oldest,
        },
        s
      );
      await prisma.kpiSubject.update({
        where: { id: s.id },
        data: { ...figures, lastRefreshedAt: now2 },
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
  requireRoles(...editors),
  async (req, res) => {
    const stats = await seedAuditKpiFromSheets(prisma, req.params.projectId);
    res.json({ ok: true, stats });
  }
);
