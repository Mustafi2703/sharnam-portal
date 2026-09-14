import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { audit } from "../services/audit.js";
import { errorDetail, listRuntimeLogs, pushRuntimeLog } from "../services/runtimeLog.js";
import { mockOneDrive } from "../services/mockOneDrive.js";
import {
  buildDprPack,
  buildWprPack,
} from "../services/reportPacks.js";
import { formatIstTimeHHMM, istStartOfDay, IST_TIMEZONE, ACTIVE_CANDIDATE_STAGES } from "@sharnam/shared";

/** Auto clock-out at 18:00 IST for open punches (same day after EOD, or any prior day). */
const EOD_CLOCK_OUT = "18:00";

function istHourMinute(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  return {
    hour: parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10),
    minute: parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10),
  };
}

async function applyAutoEodClockOut() {
  const today = istStartOfDay();
  const { hour } = istHourMinute();
  const pastEodToday = hour >= 18;

  const openRows = await prisma.attendance.findMany({
    where: { checkIn: { not: null }, checkOut: null, date: { lte: today } },
  });

  for (const row of openRows) {
    const rowDay = istStartOfDay(row.date);
    const isPastDay = rowDay.getTime() < today.getTime();
    if (!isPastDay && !pastEodToday) continue;

    const note = row.notes?.includes("Auto EOD") ? row.notes : [row.notes, "Auto EOD clock-out"].filter(Boolean).join("; ");
    await prisma.attendance.update({
      where: { id: row.id },
      data: { checkOut: EOD_CLOCK_OUT, notes: note },
    });
  }
}
import {
  analyticsToHtml,
  analyticsToSheets,
  buildAnalyticsPack,
  buildModuleExport,
  workbookBuffer,
  sendStampedXlsx,
  type ModuleExportKey,
} from "../services/brandedExport.js";
import {
  quotationFromRecord,
  renderQuotationDoc,
  renderQuotationHtml,
  writeQuotationFiles,
} from "../services/quotationExport.js";
import { proposalDocxFilename, resolveProposalDocxPath } from "../services/proposalTemplate.js";
import { syncProposalSummaryFile } from "../services/crmSharePoint.js";
import {
  createVersionedProposal,
  ensureProposalRevisionTrail,
  markCurrentProposalSent,
  quotationInclude,
  resolveProposalDiskPath,
  startNextProposalRevision,
} from "../services/proposalRevisions.js";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

const MODULE_KEYS: ModuleExportKey[] = [
  "rfis",
  "comms",
  "quality",
  "safety",
  "drawings",
  "progress",
  "cost",
];

reportsRouter.get("/daily/:projectId", async (req, res) => {
  const pack = await buildDprPack(req.params.projectId, req.query.date ? String(req.query.date) : undefined);
  res.json({
    type: "daily",
    date: pack.date,
    diary: pack.diary,
    checklistSubmissions: pack.submissions,
    activity: [],
    kpis: pack.kpis,
    project: pack.project,
    rfis: pack.rfis,
    safety: pack.safety,
    photos: pack.photos,
  });
});

reportsRouter.get("/weekly/:projectId", async (req, res) => {
  const pack = await buildWprPack(req.params.projectId, req.query.end ? String(req.query.end) : undefined);
  res.json({
    type: "weekly",
    start: pack.start,
    end: pack.end,
    summary: pack.kpis,
    diaries: pack.diaries,
    submissions: pack.submissions,
    meetings: pack.meetings,
    cashflow: pack.cashflow,
    project: pack.project,
    kpis: pack.kpis,
    drawings: pack.drawings,
    rfis: pack.rfis,
    safety: pack.safety,
    submittals: pack.submittals,
    htmlStub: `<h1>Weekly Project Report</h1><p>${new Date(pack.start).toDateString()} – ${new Date(pack.end).toDateString()}</p>`,
  });
});

reportsRouter.get("/dpr/:projectId/pack", async (req, res) => {
  res.json(await buildDprPack(req.params.projectId, req.query.date ? String(req.query.date) : undefined));
});

reportsRouter.get("/wpr/:projectId/pack", async (req, res) => {
  res.json(await buildWprPack(req.params.projectId, req.query.end ? String(req.query.end) : undefined));
});

reportsRouter.get("/dpr/:projectId/download.html", async (req, res) => {
  return res.status(409).json({
    error: "Official DPR Excel / PDF is exported only from DPR Maker — not from this dashboard.",
    maker: `/projects/${req.params.projectId}/dpr-maker`,
  });
});

reportsRouter.get("/wpr/:projectId/download.html", async (req, res) => {
  return res.status(409).json({
    error: "Official WPR pack is exported only from WPR Maker — not from this dashboard.",
    maker: `/projects/${req.params.projectId}/wpr-maker`,
  });
});

reportsRouter.get("/dpr/:projectId/download.xlsx", async (req, res) => {
  return res.status(409).json({
    error: "Official DPR Excel is exported only from DPR Maker — not from this dashboard.",
    maker: `/projects/${req.params.projectId}/dpr-maker`,
  });
});

reportsRouter.get("/wpr/:projectId/download.xlsx", async (req, res) => {
  return res.status(409).json({
    error: "Official WPR Excel is exported only from WPR Maker — not from this dashboard.",
    maker: `/projects/${req.params.projectId}/wpr-maker`,
  });
});

/** Workday-style analytics dashboard pack */
reportsRouter.get("/analytics/:projectId/pack", async (req, res) => {
  res.json(await buildAnalyticsPack(req.params.projectId));
});

reportsRouter.get("/:projectId/due-dates", requireAuth, async (req, res) => {
  const projectId = req.params.projectId;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 21);

  const [rfis, ncrs, meetings, legal, milestones, coord] = await Promise.all([
    prisma.rfi.findMany({
      where: { projectId, dueDate: { not: null }, status: { notIn: ["Closed", "Void"] } },
      select: { id: true, number: true, subject: true, dueDate: true, status: true },
      orderBy: { dueDate: "asc" },
      take: 40,
    }),
    prisma.qualityNcr.findMany({
      where: { projectId, plannedClosure: { not: null }, status: { notIn: ["Closed"] } },
      select: { id: true, number: true, description: true, plannedClosure: true, status: true },
      orderBy: { plannedClosure: "asc" },
      take: 40,
    }),
    prisma.meetingItem.findMany({
      where: {
        meeting: { projectId },
        dueDate: { not: null },
        resolutionStatus: { notIn: ["Closed"] },
      },
      select: { id: true, description: true, dueDate: true, resolutionStatus: true, meeting: { select: { title: true } } },
      orderBy: { dueDate: "asc" },
      take: 40,
    }),
    prisma.progressLegalApproval.findMany({
      where: { projectId, requiredBy: { not: null }, status: { notIn: ["Received", "Closed"] } },
      select: { id: true, approvalId: true, description: true, requiredBy: true, status: true },
      orderBy: { requiredBy: "asc" },
      take: 40,
    }),
    prisma.progressMilestone.findMany({
      where: { projectId, plannedEnd: { not: null }, status: { notIn: ["Complete", "Closed"] } },
      select: { id: true, code: true, activity: true, plannedEnd: true, status: true },
      orderBy: { plannedEnd: "asc" },
      take: 40,
    }),
    prisma.designCoordinationIssue.findMany({
      where: { projectId, dueDate: { not: null } },
      select: { id: true, title: true, dueDate: true, priority: true },
      orderBy: { dueDate: "asc" },
      take: 40,
    }),
  ]);

  const items = [
    ...rfis.map((r) => ({
      id: r.id,
      kind: "RFI",
      title: `${r.number || "RFI"} · ${r.subject}`,
      due: r.dueDate,
      status: r.status,
      href: `/projects/${projectId}/rfis`,
    })),
    ...ncrs.map((n) => ({
      id: n.id,
      kind: "NCR",
      title: `${n.number || "NCR"} · ${n.description}`,
      due: n.plannedClosure,
      status: n.status,
      href: `/projects/${projectId}/hub/quality`,
    })),
    ...meetings.map((m) => ({
      id: m.id,
      kind: "Action",
      title: `${m.meeting.title} · ${m.description}`,
      due: m.dueDate,
      status: m.resolutionStatus,
      href: `/projects/${projectId}/comms`,
    })),
    ...legal.map((l) => ({
      id: l.id,
      kind: "Legal",
      title: `${l.approvalId} · ${l.description}`,
      due: l.requiredBy,
      status: l.status,
      href: `/projects/${projectId}/progress`,
    })),
    ...milestones.map((m) => ({
      id: m.id,
      kind: "Milestone",
      title: `${m.code || ""} ${m.activity}`.trim(),
      due: m.plannedEnd,
      status: m.status,
      href: `/projects/${projectId}/progress`,
    })),
    ...coord.map((c) => ({
      id: c.id,
      kind: "Coordination",
      title: c.title,
      due: c.dueDate,
      status: c.priority,
      href: `/projects/${projectId}/hub/drawings`,
    })),
  ]
    .filter((i) => i.due)
    .sort((a, b) => new Date(a.due as Date).getTime() - new Date(b.due as Date).getTime());

  const overdue = items.filter((i) => new Date(i.due as Date) < today).length;
  const dueSoon = items.filter((i) => {
    const d = new Date(i.due as Date);
    return d >= today && d <= horizon;
  }).length;

  res.json({ overdue, dueSoon, items });
});

reportsRouter.get("/analytics/:projectId/download.xlsx", async (req, res) => {
  const pack = await buildAnalyticsPack(req.params.projectId);
  const buf = workbookBuffer(analyticsToSheets(pack), {
    title: "Project analytics dashboard",
    projectCode: pack.project.code,
  });
  const fname = `Sharnam-Analytics-${pack.project.code}.xlsx`;
  await sendStampedXlsx(res, buf, fname);
});

reportsRouter.get("/analytics/:projectId/download.html", async (req, res) => {
  const pack = await buildAnalyticsPack(req.params.projectId);
  const html = analyticsToHtml(pack);
  const fname = `Sharnam-Analytics-${pack.project.code}.html`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
  res.send(html);
});

reportsRouter.get("/module/:projectId/:module/download.xlsx", async (req, res) => {
  const module = String(req.params.module) as ModuleExportKey;
  if (!MODULE_KEYS.includes(module)) return res.status(400).json({ error: "Unknown module" });
  const pack = await buildModuleExport(req.params.projectId, module);
  const code = (await prisma.project.findUnique({ where: { id: req.params.projectId }, select: { code: true } }))?.code || "project";
  const buf = workbookBuffer(pack.sheets, { title: pack.title, projectCode: code });
  const fname = `Sharnam-${module}-${code}.xlsx`;
  await sendStampedXlsx(res, buf, fname);
});

reportsRouter.get("/module/:projectId/:module/download.html", async (req, res) => {
  const module = String(req.params.module) as ModuleExportKey;
  if (!MODULE_KEYS.includes(module)) return res.status(400).json({ error: "Unknown module" });
  const pack = await buildModuleExport(req.params.projectId, module);
  const code = (await prisma.project.findUnique({ where: { id: req.params.projectId }, select: { code: true } }))?.code || "project";
  const fname = `Sharnam-${module}-${code}.html`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
  res.send(pack.html);
});

export const auditRouter = Router();
auditRouter.use(requireAuth);
auditRouter.use(requireRoles("admin", "office"));

auditRouter.get("/", async (req, res) => {
  const take = Math.min(Number(req.query.take || 100), 500);
  try {
    const events = await prisma.auditEvent.findMany({
      take,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { fullName: true, email: true, role: true } } },
    });
    res.json(events);
  } catch (err) {
    pushRuntimeLog({
      level: "error",
      source: "audit.list",
      message: "Could not read audit trail",
      detail: errorDetail(err),
    });
    res.json([]);
  }
});

export const crmRouter = Router();
crmRouter.use(requireAuth);

crmRouter.get("/leads", async (_req, res) => {
  const leads = await prisma.lead.findMany({
    include: {
      owner: { select: { fullName: true } },
      project: { select: { id: true, code: true, name: true, status: true } },
      quotations: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, quotationNo: true, status: true, projectId: true, awardedProjectId: true, currentRevisionNo: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(leads);
});

crmRouter.get("/leads/:id", async (req, res) => {
  const lead = await prisma.lead.findUnique({
    where: { id: req.params.id },
    include: {
      owner: { select: { fullName: true } },
      project: { select: { id: true, code: true, name: true, status: true } },
      quotations: {
        orderBy: { createdAt: "desc" },
        select: { id: true, quotationNo: true, status: true, projectId: true, awardedProjectId: true, currentRevisionNo: true },
      },
    },
  });
  if (!lead) return res.status(404).json({ error: "Lead not found" });
  res.json({
    ...lead,
    clientName: lead.contactName || lead.title,
  });
});

crmRouter.post("/leads", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const lead = await prisma.lead.create({
    data: {
      title: req.body.title,
      contactName: req.body.contactName,
      email: req.body.email,
      phone: req.body.phone,
      stage: req.body.stage || "New",
      value: req.body.value != null ? Number(req.body.value) : null,
      projectId: req.body.projectId,
      ownerId: req.user!.id,
      latestStatus: req.body.latestStatus || null,
      latestSubStatus: req.body.latestSubStatus || null,
      landmark: req.body.landmark || null,
      district: req.body.district || null,
      state: req.body.state || null,
      pinCode: req.body.pinCode || null,
      segment: req.body.segment || null,
      subSegment: req.body.subSegment || null,
      sector: req.body.sector || null,
      projectType: req.body.projectType || null,
      description: req.body.description || null,
    },
  });
  res.status(201).json(lead);
});

/**
 * Bulk lead import — matches the "Data - July 2026.xlsx" master sheet the CRM team
 * maintains. Columns expected (case-insensitive, extra columns ignored):
 *   Sr No | Project Name | Latest Status | Latest Sub Status | Latest Status Update |
 *   Landmark | District | State | Pin Code | Segment | Sub-Segment | Sector |
 *   Project Type | Description
 *
 * Idempotent: upserts on (srNo + sourceSheet). The user can re-upload the same file
 * and only new / changed rows will move.
 */
const crmUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
crmRouter.post(
  "/leads/import",
  requireRoles("admin", "office"),
  crmUpload.single("file"),
  async (req: AuthedRequest, res) => {
    if (!req.file) return res.status(400).json({ error: "Upload an .xlsx file" });
    const XLSX = (await import("../lib/xlsx.js")).default;
    const wb = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
    const sourceSheet = String(req.body.sourceSheet || req.file.originalname || "Leads sheet");
    const sheetName = String(req.body.sheet || wb.SheetNames[0] || "");
    const ws = wb.Sheets[sheetName];
    if (!ws) return res.status(400).json({ error: `Sheet "${sheetName}" not found in workbook` });
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });

    const pick = (row: Record<string, unknown>, keys: string[]): string => {
      const lowered = new Map(Object.entries(row).map(([k, v]) => [k.trim().toLowerCase(), v]));
      for (const k of keys) {
        const v = lowered.get(k.toLowerCase());
        if (v != null && String(v).trim() !== "") return String(v).trim();
      }
      return "";
    };
    const parseSrNo = (v: string) => {
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : null;
    };
    const parseDate = (v: string) => {
      if (!v) return null;
      const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(v);
      if (dmy) {
        const y = dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
        const d = new Date(Date.UTC(y, Number(dmy[2]) - 1, Number(dmy[1])));
        return Number.isFinite(d.getTime()) ? d : null;
      }
      const d = new Date(v);
      return Number.isFinite(d.getTime()) ? d : null;
    };

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const raw of rows) {
      const title = pick(raw, ["Project Name", "Title", "Opportunity"]);
      if (!title) {
        skipped++;
        continue;
      }
      const srNo = parseSrNo(pick(raw, ["Sr No", "S.No", "Sr.No", "Sno", "#"]));
      const data = {
        title,
        srNo,
        sourceSheet,
        latestStatus: pick(raw, ["Latest Status", "Status"]) || null,
        latestSubStatus: pick(raw, ["Latest Sub Status", "Sub Status", "Sub-Status"]) || null,
        latestStatusUpdate: parseDate(pick(raw, ["Latest Status Update", "Last Update", "Updated On"])),
        landmark: pick(raw, ["Landmark"]) || null,
        district: pick(raw, ["District"]) || null,
        state: pick(raw, ["State"]) || null,
        pinCode: pick(raw, ["Pin Code", "PIN", "Pincode"]) || null,
        segment: pick(raw, ["Segment"]) || null,
        subSegment: pick(raw, ["Sub-Segment", "Sub Segment", "SubSegment"]) || null,
        sector: pick(raw, ["Sector"]) || null,
        projectType: pick(raw, ["Project Type", "Type"]) || null,
        description: pick(raw, ["Description", "Notes", "Remarks"]) || null,
      };
      try {
        if (srNo != null) {
          const existing = await prisma.lead.findUnique({
            where: { srNo_sourceSheet: { srNo, sourceSheet } },
          });
          if (existing) {
            await prisma.lead.update({
              where: { id: existing.id },
              data: existing.projectId ? data : { ...data, stage: "New" },
            });
            updated++;
          } else {
            await prisma.lead.create({ data: { ...data, stage: "New", ownerId: req.user!.id } });
            created++;
          }
        } else {
          await prisma.lead.create({ data: { ...data, stage: "New", ownerId: req.user!.id } });
          created++;
        }
      } catch (err) {
        errors.push(`Row "${title}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    await audit("crm.leads.import", {
      userId: req.user!.id,
      entity: "Lead",
      meta: { sourceSheet, sheet: sheetName, created, updated, skipped, errorCount: errors.length },
    });

    res.json({ ok: true, sourceSheet, sheet: sheetName, created, updated, skipped, errors });
  }
);

crmRouter.get("/deals", async (_req, res) => {
  const deals = await prisma.deal.findMany({ include: { project: true }, orderBy: { createdAt: "desc" } });
  res.json(deals);
});

crmRouter.post("/deals", requireRoles("admin", "office"), async (req, res) => {
  const deal = await prisma.deal.create({
    data: {
      name: req.body.name,
      stage: req.body.stage || "Negotiation",
      value: Number(req.body.value || 0),
      projectId: req.body.projectId,
    },
  });
  res.status(201).json(deal);
});

crmRouter.patch("/leads/:id", requireRoles("admin", "office"), async (req, res) => {
  const data: Record<string, unknown> = {};
  const setIfPresent = (key: string, transform: (v: unknown) => unknown = (v) => v) => {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) data[key] = transform(req.body[key]);
  };
  setIfPresent("title");
  setIfPresent("contactName");
  setIfPresent("email");
  setIfPresent("phone");
  setIfPresent("stage");
  setIfPresent("value", (v) => (v == null || v === "" ? null : Number(v)));
  setIfPresent("latestStatus");
  setIfPresent("latestSubStatus");
  setIfPresent("latestStatusUpdate", (v) => (v ? new Date(String(v)) : null));
  setIfPresent("landmark");
  setIfPresent("district");
  setIfPresent("state");
  setIfPresent("pinCode");
  setIfPresent("segment");
  setIfPresent("subSegment");
  setIfPresent("sector");
  setIfPresent("projectType");
  setIfPresent("description");
  const lead = await prisma.lead.update({ where: { id: req.params.id }, data });
  res.json(lead);
});

crmRouter.delete("/leads/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  await prisma.lead.delete({ where: { id: req.params.id } });
  await audit("crm.leads.delete", { userId: req.user!.id, entity: "Lead", entityId: req.params.id });
  res.json({ ok: true });
});

async function resolveBidDisciplinesJson(body: { disciplineKeys?: unknown; customDisciplines?: unknown }) {
  const { resolveDisciplinesForPackage, normalizeDisciplineKey } = await import("../services/comparativeStatement.js");
  const disciplineKeys = Array.isArray(body.disciplineKeys)
    ? body.disciplineKeys.map((x: unknown) => normalizeDisciplineKey(String(x))).filter(Boolean)
    : undefined;
  const customDisciplines = Array.isArray(body.customDisciplines)
    ? (body.customDisciplines
        .map((d: { key?: string; label?: string; sheetName?: string }) => {
          const label = String(d.label || "").trim();
          if (!label) return null;
          return {
            key: normalizeDisciplineKey(d.key || label),
            label,
            sheetName: String(d.sheetName || label).trim(),
          };
        })
        .filter(Boolean) as { key: string; label: string; sheetName: string }[])
    : undefined;
  const disciplines = resolveDisciplinesForPackage({ disciplineKeys, customDisciplines });
  return disciplines.length ? JSON.stringify(disciplines) : undefined;
}

/** Convert a lead into a PMC proposal (SharePoint file + register row). No delivery project yet. */
crmRouter.post("/leads/:id/to-proposal", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const lead = await prisma.lead.findUnique({
    where: { id: req.params.id },
    include: { quotations: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!lead) return res.status(404).json({ error: "Lead not found" });
  const existing = lead.quotations.find((q) => q.status !== "Lost");
  if (existing) {
    const row = await ensureProposalRevisionTrail(existing.id);
    if (lead.stage === "New" || lead.stage === "Qualified") {
      await prisma.lead.update({ where: { id: lead.id }, data: { stage: "Proposal" } });
    }
    return res.json({ ...row, alreadyExisted: true, leadId: lead.id });
  }

  const clientName = String(req.body.clientName || lead.contactName || lead.title).trim();
  const quotationNo = String(req.body.quotationNo || "").trim() || `QTN-${Date.now()}`;
  const project = lead.projectId ? await prisma.project.findUnique({ where: { id: lead.projectId } }) : null;
  const row = await createVersionedProposal({
    projectId: project?.id || null,
    projectCode: project?.code || null,
    clientName,
    quotationNo,
    userId: req.user!.id,
    clientAddress: lead.district ? [lead.landmark, lead.district, lead.state].filter(Boolean).join(", ") : null,
    scopeSummary: lead.description || `PMC proposal for ${clientName}`,
    totalValue: lead.value || 0,
    leadId: lead.id,
  });
  await prisma.lead.update({
    where: { id: lead.id },
    data: { stage: "Proposal" },
  });
  await audit("quotation.create", {
    userId: req.user!.id,
    entity: "Quotation",
    entityId: row.id,
    meta: { fromLead: lead.id, clientName, quotationNo, revision: 0 },
  });
  const log = await quotationStatusLog(row.id);
  res.status(201).json({ ...row, log, leadId: lead.id, alreadyExisted: false });
});
crmRouter.post("/leads/:id/convert", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
  if (!lead) return res.status(404).json({ error: "Lead not found" });

  const bidDisciplinesJson = await resolveBidDisciplinesJson(req.body);
  const workPackagesJson =
    Array.isArray(req.body?.workPackages) && req.body.workPackages.length
      ? JSON.stringify(req.body.workPackages.map(String))
      : undefined;

  if (lead.projectId) {
    const project = await prisma.project.findUnique({ where: { id: lead.projectId } });
    if (!project) return res.status(404).json({ error: "Linked project not found" });

    if (bidDisciplinesJson || workPackagesJson) {
      await prisma.project.update({
        where: { id: project.id },
        data: {
          ...(bidDisciplinesJson ? { bidDisciplinesJson } : {}),
          ...(workPackagesJson ? { workPackages: workPackagesJson } : {}),
        },
      });
    }
    if (lead.stage !== "Converted") {
      await prisma.lead.update({ where: { id: lead.id }, data: { stage: "Converted" } });
    }

    const updated = bidDisciplinesJson
      ? await prisma.project.findUnique({ where: { id: project.id } })
      : project;
    return res.json({ project: updated, leadId: lead.id, alreadyConverted: true });
  }

  const code = String(req.body.code || "").trim();
  const name = String(req.body.name || lead.title).trim();
  if (!code || !name) return res.status(400).json({ error: "code and name required" });

  const { createOrReuseProject } = await import("../services/projectCreate.js");
  let project;
  try {
    const out = await createOrReuseProject({
      code,
      name,
      clientName: req.body.clientName || lead.contactName || null,
      location: req.body.location || null,
      status: "Planning",
      clientContactName: req.body.clientContactName || lead.contactName || null,
      clientEmail: req.body.clientEmail || lead.email || null,
      clientPhone: req.body.clientPhone || lead.phone || null,
      clientAddress: req.body.clientAddress || null,
      clientGst: req.body.clientGst || null,
      designConsultant: req.body.designConsultant || null,
      contractorName: req.body.contractorName || null,
      pmcName: req.body.pmcName || "SPDC",
      bidDisciplinesJson,
      workPackages: workPackagesJson,
    });
    project = out.project;
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Could not convert lead to project" });
  }

  await prisma.lead.update({
    where: { id: lead.id },
    data: { projectId: project.id, stage: "Converted" },
  });

  await prisma.deal.create({
    data: {
      name: `${name} — PMC`,
      stage: "Closed Won",
      value: lead.value || Number(req.body.value || 0),
      projectId: project.id,
    },
  });

  const memberIds: string[] = Array.isArray(req.body.memberIds) ? req.body.memberIds : [];
  for (const userId of memberIds) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId } },
      create: { projectId: project.id, userId, role: "member" },
      update: {},
    });
  }

  const vendorIds: string[] = Array.isArray(req.body.vendorIds) ? req.body.vendorIds : [];
  for (const vendorId of vendorIds) {
    await prisma.projectVendor.upsert({
      where: { projectId_vendorId: { projectId: project.id, vendorId } },
      create: { projectId: project.id, vendorId, assignedVia: "CRM convert" },
      update: {},
    });
  }

  // Always add converter as member
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: req.user!.id } },
    create: { projectId: project.id, userId: req.user!.id, role: "office" },
    update: {},
  });

  try {
    const { mockOneDrive } = await import("../services/mockOneDrive.js");
    await mockOneDrive.ensureProjectTree(project.id);
  } catch (err) {
    console.error("Project folder tree failed:", err instanceof Error ? err.message : err);
  }

  try {
    const { ensureClientVendorAndPortal, provisionProjectVendorAccess } = await import(
      "../services/crmVendorCredentials.js"
    );
    if (project.clientEmail || project.clientName) {
      await ensureClientVendorAndPortal({
        projectId: project.id,
        name: project.clientName || project.clientContactName || project.name,
        email: project.clientEmail,
        phone: project.clientPhone,
        contactName: project.clientContactName,
        address: project.clientAddress,
        gst: project.clientGst,
      });
    }
    if (vendorIds.length) {
      await provisionProjectVendorAccess({
        projectId: project.id,
        vendorIds,
        assignedVia: "CRM convert",
      });
    }
  } catch (err) {
    console.warn("CRM convert portal provisioning skipped:", err instanceof Error ? err.message : err);
  }

  res.status(201).json({ project, leadId: lead.id });
});

/* ─── Quotations (proposal desk — Drive file + status log) ─── */

const PROPOSAL_STATUSES = ["Draft", "Editing", "Sent to client", "Done", "Awarded", "Lost"] as const;

async function quotationStatusLog(entityId: string) {
  return prisma.auditEvent.findMany({
    where: { entity: "Quotation", entityId },
    orderBy: { createdAt: "desc" },
    take: 80,
    include: { user: { select: { fullName: true, email: true } } },
  });
}

const proposalUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

crmRouter.get("/quotations", async (req, res) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId.trim() : "";
  const rows = await prisma.quotation.findMany({
    where: projectId ? { projectId } : undefined,
    include: quotationInclude(),
    orderBy: { createdAt: "desc" },
  });
  res.json(rows);
});

crmRouter.get("/quotations/template.docx", async (_req, res) => {
  try {
    const src = resolveProposalDocxPath();
    res.download(src, "SPDC-PMC-Full-Proposal-Template.docx");
  } catch (e) {
    res.status(404).json({ error: e instanceof Error ? e.message : "Template not found" });
  }
});

crmRouter.get("/quotations/:id", async (req, res) => {
  const row = await ensureProposalRevisionTrail(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  const log = await quotationStatusLog(row.id);
  res.json({ ...row, log });
});

crmRouter.get("/quotations/:id/download.docx", async (req, res) => {
  const row = await ensureProposalRevisionTrail(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  try {
    const revNo = req.query.rev != null ? Number(req.query.rev) : row.currentRevisionNo;
    const rev = row.revisions.find((r) => r.revisionNo === revNo) || row.revisions[0];
    const stored = resolveProposalDiskPath(rev?.fileUrl || row.attachmentUrl);
    const src = stored || resolveProposalDocxPath();
    const name = rev?.fileName || proposalDocxFilename(row.quotationNo, row.clientName, row.currentRevisionNo);
    res.download(src, name);
  } catch (e) {
    res.status(404).json({ error: e instanceof Error ? e.message : "Proposal file not found" });
  }
});

crmRouter.get("/quotations/:id/download.html", async (req, res) => {
  const row = await prisma.quotation.findUnique({
    where: { id: req.params.id },
    include: { project: { select: { id: true, code: true } } },
  });
  if (!row) return res.status(404).json({ error: "not found" });
  const doc = quotationFromRecord(row);
  writeQuotationFiles(doc);
  const html = renderQuotationHtml(doc);
  if (row.project?.code) {
    await mockOneDrive.ensureProjectTree(row.project.id);
    await syncProposalSummaryFile(row.project.code, row.quotationNo, Buffer.from(html, "utf8"), "html");
  }
  const safe = row.quotationNo.replace(/[^a-zA-Z0-9._-]+/g, "-");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${safe}-Proposal.html"`);
  res.send(html);
});

crmRouter.get("/quotations/:id/download.doc", async (req, res) => {
  const row = await prisma.quotation.findUnique({
    where: { id: req.params.id },
    include: { project: { select: { id: true, code: true } } },
  });
  if (!row) return res.status(404).json({ error: "not found" });
  const doc = quotationFromRecord(row);
  writeQuotationFiles(doc);
  const wordHtml = renderQuotationDoc(doc);
  if (row.project?.code) {
    await mockOneDrive.ensureProjectTree(row.project.id);
    await syncProposalSummaryFile(row.project.code, row.quotationNo, Buffer.from(wordHtml, "utf8"), "doc");
  }
  const safe = row.quotationNo.replace(/[^a-zA-Z0-9._-]+/g, "-");
  res.setHeader("Content-Type", "application/msword; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${safe}-Proposal.doc"`);
  res.send(wordHtml);
});

crmRouter.post("/quotations", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const clientName = String(req.body.clientName || "").trim();
  if (!clientName) return res.status(400).json({ error: "Client name is required" });

  let projectId = req.body.projectId ? String(req.body.projectId) : null;
  const leadId = req.body.leadId ? String(req.body.leadId) : null;
  if (leadId && !projectId) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (lead?.projectId) projectId = lead.projectId;
  }
  const project = projectId ? await prisma.project.findUnique({ where: { id: projectId } }) : null;

  const quotationNo = String(req.body.quotationNo || "").trim() || `QTN-${Date.now()}`;
  let row;
  try {
    row = await createVersionedProposal({
      projectId: project?.id || null,
      projectCode: project?.code || null,
      clientName,
      quotationNo,
      userId: req.user!.id,
      clientAddress: req.body.clientAddress || null,
      clientGst: req.body.clientGst || null,
      scopeSummary: req.body.scopeSummary || `PMC proposal for ${clientName}`,
      totalValue: Number(req.body.totalValue || 0),
      currency: req.body.currency || "INR",
      validityDays: Number(req.body.validityDays || 30),
      quotationDate: req.body.quotationDate ? new Date(req.body.quotationDate) : new Date(),
      leadId: leadId || null,
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Could not create proposal file" });
  }
  if (leadId) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { stage: "Proposal" },
    }).catch(() => null);
  }
  await audit("quotation.create", {
    userId: req.user!.id,
    entity: "Quotation",
    entityId: row.id,
    meta: {
      clientName,
      quotationNo,
      status: "Draft",
      revision: 0,
      file: row.attachmentSharePointUrl || row.attachmentUrl,
    },
  });
  const log = await quotationStatusLog(row.id);
  res.status(201).json({ ...row, log });
});

crmRouter.post("/quotations/:id/revise", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  try {
    const row = await startNextProposalRevision({
      quotationId: req.params.id,
      userId: req.user!.id,
      note: req.body?.note ? String(req.body.note) : undefined,
    });
    await audit("quotation.revise", {
      userId: req.user!.id,
      entity: "Quotation",
      entityId: row.id,
      meta: { revision: row.currentRevisionNo, file: row.attachmentSharePointUrl || row.attachmentUrl },
    });
    const log = await quotationStatusLog(row.id);
    res.json({ ...row, log });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Could not start the next revision" });
  }
});

crmRouter.post(
  "/quotations/:id/revisions",
  requireRoles("admin", "office"),
  proposalUpload.single("file"),
  async (req: AuthedRequest, res) => {
    if (!req.file?.buffer) return res.status(400).json({ error: "Upload a .docx to store as the next version." });
    try {
      const row = await startNextProposalRevision({
        quotationId: req.params.id,
        userId: req.user!.id,
        note: req.body?.note ? String(req.body.note) : "Uploaded sent copy",
        buffer: req.file.buffer,
      });
      await audit("quotation.revise", {
        userId: req.user!.id,
        entity: "Quotation",
        entityId: row.id,
        meta: { revision: row.currentRevisionNo, uploaded: req.file.originalname },
      });
      const log = await quotationStatusLog(row.id);
      res.status(201).json({ ...row, log });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Could not store revision" });
    }
  }
);

crmRouter.patch("/quotations/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const before = await prisma.quotation.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "not found" });
  const nextStatus = req.body.status != null ? String(req.body.status) : before.status;
  if (req.body.status && nextStatus !== before.status && !PROPOSAL_STATUSES.includes(nextStatus as (typeof PROPOSAL_STATUSES)[number])) {
    return res.status(400).json({ error: `Status must be one of: ${PROPOSAL_STATUSES.join(", ")}` });
  }
  if (nextStatus === "Awarded" && before.status !== "Awarded") {
    return res.status(400).json({ error: "Use Award on the proposal to put a Planning job on the projects register." });
  }
  const row = await prisma.quotation.update({
    where: { id: req.params.id },
    data: {
      status: nextStatus,
      quotationNo: req.body.quotationNo ?? before.quotationNo,
      clientName: req.body.clientName ?? before.clientName,
      clientAddress: req.body.clientAddress ?? before.clientAddress,
      clientGst: req.body.clientGst ?? before.clientGst,
      scopeSummary: req.body.scopeSummary ?? before.scopeSummary,
      totalValue: req.body.totalValue != null ? Number(req.body.totalValue) : before.totalValue,
      validityDays: req.body.validityDays != null ? Number(req.body.validityDays) : before.validityDays,
    },
    include: quotationInclude(),
  });
  if (nextStatus === "Sent to client" && before.status !== "Sent to client") {
    await markCurrentProposalSent({
      quotationId: row.id,
      userId: req.user!.id,
      note: req.body.note ? String(req.body.note) : undefined,
    });
  }
  if (nextStatus !== before.status || req.body.note) {
    await audit("quotation.status", {
      userId: req.user!.id,
      entity: "Quotation",
      entityId: row.id,
      meta: {
        from: before.status,
        to: nextStatus,
        note: req.body.note || null,
        clientName: row.clientName,
        revision: row.currentRevisionNo,
      },
    });
  }
  const fresh = await ensureProposalRevisionTrail(row.id);
  const log = await quotationStatusLog(row.id);
  res.json({ ...(fresh || row), log });
});

/** Award the quotation → Planning project on the register, ready for setup. Updates the linked lead. */
crmRouter.post("/quotations/:id/award", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const qtn = await prisma.quotation.findUnique({
    where: { id: req.params.id },
    include: { lead: true, project: { select: { id: true, code: true, name: true, status: true } } },
  });
  if (!qtn) return res.status(404).json({ error: "not found" });

  if (qtn.status === "Lost") {
    return res.status(400).json({ error: "A lost proposal cannot be awarded." });
  }
  if (qtn.status === "Awarded" && (qtn.awardedProjectId || qtn.projectId)) {
    const projectId = qtn.awardedProjectId || qtn.projectId;
    const project = projectId ? await prisma.project.findUnique({ where: { id: projectId } }) : null;
    return res.json({ quotation: qtn, projectId, project, alreadyAwarded: true });
  }

  const lead = qtn.lead;
  const autoCode = `SPDC-${String(lead?.srNo || qtn.quotationNo.replace(/\D/g, "") || Date.now()).slice(-5)}`;
  const code = String(req.body.code || "").trim() || autoCode;
  const name = String(req.body.name || lead?.title || qtn.clientName).trim();
  if (!code || !name) return res.status(400).json({ error: "code and name required" });

  let projectId = (req.body.projectId as string | undefined) || qtn.projectId || lead?.projectId || undefined;
  let project = projectId ? await prisma.project.findUnique({ where: { id: projectId } }) : null;
  if (!project) {
    try {
      const { createOrReuseProject } = await import("../services/projectCreate.js");
      const out = await createOrReuseProject({
        code,
        name,
        clientName: qtn.clientName || lead?.contactName || null,
        location: lead ? [lead.landmark, lead.district, lead.state].filter(Boolean).join(", ") || null : null,
        clientAddress: qtn.clientAddress || null,
        clientGst: qtn.clientGst || null,
        clientContactName: lead?.contactName || null,
        clientEmail: lead?.email || null,
        clientPhone: lead?.phone || null,
        pmcName: "SPDC",
        status: "Planning",
      });
      project = out.project;
      projectId = project.id;
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : "Could not create project from award" });
    }
  }

  await mockOneDrive.ensureProjectTree(projectId!);
  try {
    const stored = resolveProposalDiskPath(qtn.attachmentUrl);
    if (stored && fs.existsSync(stored)) {
      const { createProjectProposalFile } = await import("../services/crmSharePoint.js");
      const file = await createProjectProposalFile(
        project!.code,
        qtn.clientName,
        qtn.quotationNo,
        qtn.currentRevisionNo || 0,
        fs.readFileSync(stored)
      );
      await prisma.quotation.update({
        where: { id: qtn.id },
        data: { attachmentUrl: file.url, attachmentSharePointUrl: file.sharePointUrl || file.url },
      });
    }
  } catch (err) {
    console.warn("Copy proposal into awarded project folder failed:", err instanceof Error ? err.message : err);
  }
  try {
    const { provisionProjectSheetPack } = await import("../services/projectSheetPack.js");
    await provisionProjectSheetPack(projectId!, req.user!.id);
  } catch (err) {
    console.error("Auto sheet provision failed:", err instanceof Error ? err.message : err);
  }

  const row = await prisma.quotation.update({
    where: { id: qtn.id },
    data: { status: "Awarded", awardedAt: new Date(), awardedProjectId: projectId, projectId },
    include: quotationInclude(),
  });

  if (qtn.leadId) {
    await prisma.lead.update({
      where: { id: qtn.leadId },
      data: { projectId, stage: "Converted", latestStatus: "Awarded" },
    });
  }

  const existingDeal = await prisma.deal.findFirst({ where: { projectId } });
  if (!existingDeal) {
    await prisma.deal.create({
      data: {
        name: `${name} — PMC`,
        stage: "Closed Won",
        value: qtn.totalValue || lead?.value || 0,
        projectId,
      },
    });
  }

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: projectId!, userId: req.user!.id } },
    create: { projectId: projectId!, userId: req.user!.id, role: "office" },
    update: {},
  });

  await audit("quotation.award", {
    userId: req.user!.id,
    entity: "Quotation",
    entityId: row.id,
    meta: { projectId, code: project!.code, leadId: qtn.leadId },
  });

  res.json({ quotation: row, projectId, project: { id: project!.id, code: project!.code, name: project!.name, status: project!.status } });
});

export const hrmRouter = Router();
const hrmUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

const ATTENDANCE_PHOTO_FOLDER =
  "03_SUPPORT_AND_RESOURCES/03.02_Resources_and_Productivity/Attendance";

function attendancePhotoLocalPath(projectCode: string, fileName: string) {
  return path.join(
    mockOneDrive.projectRoot(projectCode),
    ATTENDANCE_PHOTO_FOLDER,
    fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
  );
}

function fileNameFromPhotoUrl(photoUrl: string | null | undefined): string | null {
  if (!photoUrl) return null;
  try {
    const u = photoUrl.startsWith("http") ? new URL(photoUrl) : new URL(photoUrl, "http://local");
    const base = u.pathname.split("/").pop();
    return base ? decodeURIComponent(base) : null;
  } catch {
    const base = photoUrl.split("/").pop();
    return base || null;
  }
}

function publicPhotoUrl(attendanceId: string, kind: "in" | "out") {
  return `/api/hrm/attendance/${attendanceId}/photo/${kind}`;
}

function resolveAttendancePhotoPath(storedUrl: string, projectCode: string): string | null {
  if (storedUrl.startsWith("/uploads/")) {
    const rel = storedUrl.replace(/^\/uploads\//, "");
    const localPath = path.join(mockOneDrive.root(), rel);
    if (fs.existsSync(localPath)) return localPath;
  }
  const fname = fileNameFromPhotoUrl(storedUrl);
  if (fname) {
    const local = attendancePhotoLocalPath(projectCode, fname);
    if (fs.existsSync(local)) return local;
  }
  return null;
}

/** Stream punch selfie — local copy or SharePoint via Graph (browser cannot load SP URLs). */
hrmRouter.get("/attendance/:id/photo/:kind", requireAuth, async (req, res) => {
  const kind: "in" | "out" = req.params.kind === "out" ? "out" : "in";
  const row = await prisma.attendance.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "not found" });

  const storedUrl = kind === "in" ? row.inPhotoUrl : row.outPhotoUrl;
  if (!storedUrl) return res.status(404).json({ error: "no photo" });

  let projectCode = "OFFICE";
  if (row.projectId) {
    const proj = await prisma.project.findUnique({ where: { id: row.projectId } });
    if (proj) projectCode = proj.code;
  }

  const localPath = resolveAttendancePhotoPath(storedUrl, projectCode);
  if (localPath) {
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "private, max-age=3600");
    return res.sendFile(path.resolve(localPath));
  }

  if (storedUrl.includes("sharepoint.com")) {
    try {
      const { downloadDriveFile, sharePointPathFromWebUrl, graphConfig } = await import("../services/graph.js");
      if (graphConfig().configured && !graphConfig().mock) {
        const spPath = sharePointPathFromWebUrl(storedUrl);
        if (spPath) {
          const buf = await downloadDriveFile(spPath);
          res.setHeader("Content-Type", "image/jpeg");
          res.setHeader("Cache-Control", "private, max-age=3600");
          return res.send(buf);
        }
      }
    } catch (err) {
      console.warn("[attendance photo] SharePoint fetch failed:", err instanceof Error ? err.message : err);
    }
  }

  return res.status(404).json({
    error: "photo not on server",
    hint: "Selfie may be in SharePoint only — ask IT or re-punch after deploy",
    sharePointUrl: storedUrl.includes("sharepoint.com") ? storedUrl : undefined,
  });
});

hrmRouter.use(requireAuth);

/** HR desk metrics — office / admin only (portal UI is gated; API must match). */
const hrmDesk = requireRoles("admin", "office", "hr");
/** Field staff may punch and view roster; vendors/clients must not. */
const hrmStaff = requireRoles("admin", "office", "hr", "site_employee", "employee");
const HRMS_STAFF_ROLES = ["admin", "office", "hr", "employee", "site_employee"] as const;
const HRMS_ALL_LOGIN_ROLES = [...HRMS_STAFF_ROLES, "vendor", "client"] as const;

async function safeCount(label: string, fn: () => Promise<number>): Promise<number> {
  try {
    return await fn();
  } catch (err) {
    pushRuntimeLog({
      level: "error",
      source: "hrm.dashboard",
      message: `${label} failed — showing 0`,
      detail: errorDetail(err),
    });
    return 0;
  }
}

hrmRouter.get("/dashboard", hrmDesk, async (_req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    headcount,
    openOffers,
    pendingLeave,
    punchesToday,
    openReqs,
    activeCandidates,
    onboardedUsers,
    onboardingInProgress,
  ] = await Promise.all([
    safeCount("headcount", () =>
      prisma.user.count({
        where: {
          isActive: true,
          NOT: { email: { startsWith: "deleted." } },
          OR: [
            { role: { in: ["admin", "office", "hr", "site_employee"] } },
            { role: "employee", vendorId: null },
          ],
        },
      })
    ),
    safeCount("openOffers", () => prisma.offer.count({ where: { status: { in: ["Draft", "Approved", "Sent"] } } })),
    safeCount("pendingLeave", () => prisma.leaveRequest.count({ where: { status: "Pending" } })),
    safeCount("punchesToday", () =>
      prisma.attendance.count({
        where: { date: { gte: today, lt: tomorrow }, checkIn: { not: null } },
      })
    ),
    safeCount("openReqs", () =>
      prisma.manpowerRequisition.count({ where: { status: { in: ["Draft", "PendingHR", "Approved"] } } })
    ),
    safeCount("activeCandidates", () =>
      prisma.candidate.count({ where: { status: { in: [...ACTIVE_CANDIDATE_STAGES] } } })
    ),
    safeCount("onboardedUsers", () => prisma.offer.count({ where: { status: "Joined" } })),
    safeCount("onboardingInProgress", () => prisma.onboardingChecklist.count({ where: { userId: { not: null } } })),
  ]);

  res.json({
    headcount,
    openOffers,
    pendingLeave,
    punchesToday,
    openReqs,
    activeCandidates,
    onboardedUsers,
    onboardingInProgress,
  });
});

/** HR desk activity — audit rows + in-memory API errors (Anushka cannot open /audit). */
hrmRouter.get("/activity", hrmDesk, async (req, res) => {
  const take = Math.min(Number(req.query.take || 150), 400);
  let events: unknown[] = [];
  try {
    events = await prisma.auditEvent.findMany({
      where: {
        OR: [
          { action: { startsWith: "hrm." } },
          { action: { startsWith: "hrms." } },
          { action: { startsWith: "runtime." } },
        ],
      },
      take,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { fullName: true, email: true, role: true } } },
    });
  } catch (err) {
    pushRuntimeLog({
      level: "error",
      source: "hrm.activity",
      message: "Could not read HRMS audit events",
      detail: errorDetail(err),
    });
  }
  res.json({ events, runtime: listRuntimeLogs(120) });
});

hrmRouter.get("/employees", hrmDesk, async (req: AuthedRequest, res) => {
  const scope = String(req.query.scope || "staff");
  const includeDemo =
    String(req.query.includeDemo || "") === "1" && (req.user?.role === "admin" || req.user?.role === "office");
  const staffWhere = {
    NOT: { email: { startsWith: "deleted." } },
    OR: [
      { role: { in: ["admin", "office", "hr", "site_employee"] } },
      { role: "employee", vendorId: null },
    ],
  };
  try {
    const users = await prisma.user.findMany({
      where:
        scope === "all"
          ? {
              NOT: { email: { startsWith: "deleted." } },
              OR: [{ role: { in: [...HRMS_ALL_LOGIN_ROLES] } }, { vendorId: { not: null } }],
            }
          : { ...staffWhere, isActive: true },
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        portal: true,
        phone: true,
        isActive: true,
        createdAt: true,
        vendorId: true,
        vendor: { select: { id: true, name: true, trade: true, partyType: true } },
        memberships: { include: { project: { select: { id: true, code: true, name: true } } } },
      },
    });
    const profiles = await prisma.employeeProfile.findMany();
    let rows = users.map((u) => ({ ...u, profile: profiles.find((p) => p.userId === u.id) || null }));
    if (!includeDemo) {
      const { isDemoSeedLoginEmail } = await import("../services/keepPortalUsers.js");
      rows = rows.filter((u) => !isDemoSeedLoginEmail(u.email));
    }
    res.json(rows);
  } catch (err) {
    pushRuntimeLog({
      level: "error",
      source: "hrm.employees",
      message: "Could not list employees",
      detail: errorDetail(err),
    });
    res.status(500).json({ error: "Could not list employees" });
  }
});

/** Create / relink portal logins for all CRM directory companies with email (clients, vendors, consultants). */
hrmRouter.post("/employees/sync-directory-logins", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  try {
    const { syncAllDirectoryPortalLogins } = await import("../services/crmVendorCredentials.js");
    const out = await syncAllDirectoryPortalLogins();
    await audit("hrm.employees.sync_directory_logins", {
      userId: req.user?.id,
      entity: "User",
      meta: out,
    });
    res.json(out);
  } catch (err) {
    pushRuntimeLog({
      level: "error",
      source: "hrm.employees.sync_directory_logins",
      message: "Could not sync CRM directory logins",
      detail: errorDetail(err),
    });
    res.status(500).json({ error: "Could not sync CRM directory logins" });
  }
});

/** One-time cleanup — soft-off demo seed logins still active in the DB. Office / admin. */
hrmRouter.post("/employees/deactivate-demo-seed", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  try {
    const { isDemoSeedLoginEmail } = await import("../services/keepPortalUsers.js");
    const active = await prisma.user.findMany({
      where: { isActive: true, NOT: { email: { startsWith: "deleted." } } },
      select: { id: true, email: true, fullName: true },
    });
    const targets = active.filter((u) => isDemoSeedLoginEmail(u.email));
    if (!targets.length) {
      return res.json({ deactivated: 0, emails: [] });
    }
    await prisma.$transaction(
      targets.map((u) => prisma.user.update({ where: { id: u.id }, data: { isActive: false } }))
    );
    await audit("hrm.employees.deactivate_demo_seed", {
      userId: req.user?.id,
      entity: "User",
      meta: { count: targets.length, emails: targets.map((t) => t.email) },
    });
    res.json({ deactivated: targets.length, emails: targets.map((t) => t.email) });
  } catch (err) {
    pushRuntimeLog({
      level: "error",
      source: "hrm.employees.deactivate_demo_seed",
      message: "Could not deactivate demo seed logins",
      detail: errorDetail(err),
    });
    res.status(500).json({ error: "Could not deactivate demo logins" });
  }
});

/** Remove all demo seed portal logins (@sharnam.demo etc.) — office / admin. Live SPDC logins stay. */
hrmRouter.post("/employees/delete-demo-seed", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  try {
    const { isDemoSeedLoginEmail, isKeptPortalEmail } = await import("../services/keepPortalUsers.js");
    const active = await prisma.user.findMany({
      where: { NOT: { email: { startsWith: "deleted." } } },
      select: { id: true, email: true, fullName: true, role: true },
    });
    const targets = active.filter((u) => isDemoSeedLoginEmail(u.email) && !isKeptPortalEmail(u.email));
    if (!targets.length) {
      return res.json({ removed: 0, emails: [] });
    }
    const stamp = Date.now();
    for (const u of targets) {
      if (u.id === req.user?.id) continue;
      const retiredEmail = `deleted.${stamp}.${u.email.replace("@", "_at_")}`.slice(0, 180);
      await prisma.projectMember.deleteMany({ where: { userId: u.id } });
      await prisma.employeeProfile.deleteMany({ where: { userId: u.id } });
      await prisma.user.update({
        where: { id: u.id },
        data: {
          isActive: false,
          email: retiredEmail,
          fullName: `[Removed] ${u.fullName}`.slice(0, 200),
          vendorId: null,
        },
      });
    }
    await audit("hrm.employees.delete_demo_seed", {
      userId: req.user?.id,
      entity: "User",
      meta: { count: targets.length, emails: targets.map((t) => t.email) },
    });
    res.json({ removed: targets.length, emails: targets.map((t) => t.email) });
  } catch (err) {
    pushRuntimeLog({
      level: "error",
      source: "hrm.employees.delete_demo_seed",
      message: "Could not delete demo seed logins",
      detail: errorDetail(err),
    });
    res.status(500).json({ error: "Could not delete demo seed logins" });
  }
});

hrmRouter.post("/employees", hrmDesk, async (req: AuthedRequest, res) => {
  const bcrypt = await import("bcryptjs");
  const { portalForRole } = await import("@sharnam/shared");
  const { email, fullName, role, phone, empCode, department, designation, password, vendorId: vendorIdRaw, desk } = req.body;
  if (!email || !fullName || !role) return res.status(400).json({ error: "email, fullName, role required" });
  const roleKey = role as import("@sharnam/shared").RoleKey;
  if (String(desk || "") === "hrm" && (roleKey === "client" || roleKey === "vendor")) {
    return res.status(400).json({
      error: "HRMS Users creates SPDC staff only. Client, consultant, and vendor logins are created in CRM directories.",
    });
  }
  const existing = await prisma.user.findUnique({ where: { email: String(email).trim().toLowerCase() } });
  if (existing) return res.status(409).json({ error: "Email already has a login" });
  const hash = await bcrypt.hash(password || process.env.SEED_PASSWORD || "Demo@1234", 10);
  const linkedVendorId =
    roleKey === "client" || roleKey === "vendor" || roleKey === "employee"
      ? vendorIdRaw
        ? String(vendorIdRaw)
        : null
      : null;
  const user = await prisma.user.create({
    data: {
      email: String(email).trim().toLowerCase(),
      fullName,
      role: roleKey,
      portal: portalForRole(roleKey),
      phone,
      passwordHash: hash,
      vendorId: linkedVendorId,
    },
  });
  const org = designation ? String(designation).trim() : "";
  if (role === "client" || role === "vendor") {
    if (org || department) {
      const prefix = role === "client" ? "CLT" : "VND";
      await prisma.employeeProfile.create({
        data: {
          userId: user.id,
          empCode: `${prefix}-${Date.now().toString().slice(-6)}`,
          department: department ? String(department).trim() : null,
          designation: org || null,
          joinDate: new Date(),
        },
      });
    }
  } else {
    await prisma.employeeProfile.create({
      data: {
        userId: user.id,
        empCode: empCode || `EMP-${Date.now().toString().slice(-6)}`,
        department: department || null,
        designation: designation || null,
        joinDate: new Date(),
        ...(req.body.ctcAnnual ? { ctcAnnual: Number(req.body.ctcAnnual) } : {}),
        ...(req.body.basicMonthly ? { basicMonthly: Number(req.body.basicMonthly) } : {}),
        ...(req.body.hraMonthly ? { hraMonthly: Number(req.body.hraMonthly) } : {}),
      },
    });
  }
  await audit("hrm.employee.create", {
    userId: req.user?.id,
    entity: "User",
    entityId: user.id,
    meta: { email: user.email, role: user.role, fullName: user.fullName },
  });
  res.status(201).json(user);
});

hrmRouter.post("/assign", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  const { projectId, userId, role } = req.body;
  if (!projectId || !userId) return res.status(400).json({ error: "projectId and userId required" });
  const member = await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    create: { projectId, userId, role: role || "member" },
    update: { role: role || "member" },
  });
  await audit("hrm.assign", {
    userId: req.user?.id,
    entity: "ProjectMember",
    entityId: member.id,
    meta: { projectId, assignedUserId: userId, role: role || "member" },
  });
  res.json(member);
});

/**
 * Clears the blanket project memberships the demo seeds used to create, so staff
 * can be put on projects deliberately. Admin logins are always kept.
 */
hrmRouter.post("/assign/clear-all", requireRoles("admin"), async (req: AuthedRequest, res) => {
  const projectId = req.body?.projectId ? String(req.body.projectId) : "";
  const admins = await prisma.user.findMany({ where: { role: "admin" }, select: { id: true } });
  const keepUserIds = [...new Set([...admins.map((a) => a.id), req.user!.id])];
  const { count } = await prisma.projectMember.deleteMany({
    where: {
      ...(projectId ? { projectId } : {}),
      userId: { notIn: keepUserIds },
    },
  });
  await audit("hrm.assign.cleared", {
    userId: req.user?.id,
    entity: "ProjectMember",
    meta: { projectId: projectId || "all", removed: count },
  });
  res.json({ ok: true, removed: count });
});

hrmRouter.delete("/assign", requireRoles("admin", "office", "hr"), async (req, res) => {
  const { projectId, userId } = req.body;
  if (!projectId || !userId) return res.status(400).json({ error: "projectId and userId required" });
  await prisma.projectMember.deleteMany({ where: { projectId, userId } });
  await audit("hrm.assign.removed", {
    userId: (req as AuthedRequest).user?.id,
    entity: "ProjectMember",
    entityId: `${projectId}:${userId}`,
  });
  res.json({ ok: true });
});

hrmRouter.patch("/employees/:id", hrmDesk, async (req: AuthedRequest, res) => {
  const userId = req.params.id;
  const { email, fullName, role, phone, empCode, department, designation, password, isActive, ctcAnnual, basicMonthly, hraMonthly } = req.body;
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) return res.status(404).json({ error: "User not found" });
  if (existing.role === "admin" && req.user?.role !== "admin") {
    return res.status(403).json({ error: "Only admin can edit admin accounts" });
  }

  const data: Record<string, unknown> = {};
  if (fullName) data.fullName = String(fullName).trim();
  if (phone !== undefined) data.phone = phone ? String(phone).trim() : null;
  if (email && String(email).trim().toLowerCase() !== existing.email) {
    const nextEmail = String(email).trim().toLowerCase();
    const clash = await prisma.user.findUnique({ where: { email: nextEmail } });
    if (clash && clash.id !== userId) return res.status(409).json({ error: "Email already in use" });
    data.email = nextEmail;
  }
  if (role) {
    const { portalForRole } = await import("@sharnam/shared");
    const roleKey = role as import("@sharnam/shared").RoleKey;
    if ((roleKey === "admin" || existing.role === "admin") && req.user?.role !== "admin") {
      return res.status(403).json({ error: "Only admin can change admin accounts" });
    }
    data.role = roleKey;
    data.portal = portalForRole(roleKey);
  }
  if (typeof isActive === "boolean") {
    if (existing.role === "admin" && req.user?.role !== "admin") {
      return res.status(403).json({ error: "Only admin can deactivate admin accounts" });
    }
    data.isActive = isActive;
  }
  if (password && String(password).length >= 6) {
    const bcrypt = await import("bcryptjs");
    data.passwordHash = await bcrypt.hash(String(password), 10);
  }
  if (
    !Object.keys(data).length &&
    empCode === undefined &&
    department === undefined &&
    designation === undefined &&
    ctcAnnual === undefined &&
    basicMonthly === undefined &&
    hraMonthly === undefined
  ) {
    return res.status(400).json({ error: "Nothing to update" });
  }

  const user =
    Object.keys(data).length > 0
      ? await prisma.user.update({ where: { id: userId }, data })
      : existing;

  const effectiveRole = (data.role as string | undefined) || existing.role;
  const external = effectiveRole === "client" || effectiveRole === "vendor";
  const profilePatch: Record<string, unknown> = {};
  if (!external && empCode !== undefined) {
    profilePatch.empCode = empCode || `EMP-${Date.now().toString().slice(-6)}`;
  }
  if (department !== undefined) profilePatch.department = department || null;
  if (designation !== undefined) profilePatch.designation = designation || null;
  if (ctcAnnual !== undefined && ctcAnnual !== "") profilePatch.ctcAnnual = Number(ctcAnnual);
  if (basicMonthly !== undefined && basicMonthly !== "") profilePatch.basicMonthly = Number(basicMonthly);
  if (hraMonthly !== undefined && hraMonthly !== "") profilePatch.hraMonthly = Number(hraMonthly);
  if (ctcAnnual === "" || ctcAnnual === null) profilePatch.ctcAnnual = null;
  if (basicMonthly === "" || basicMonthly === null) profilePatch.basicMonthly = null;
  if (hraMonthly === "" || hraMonthly === null) profilePatch.hraMonthly = null;
  if (Object.keys(profilePatch).length) {
    const prefix = effectiveRole === "client" ? "CLT" : effectiveRole === "vendor" ? "VND" : "EMP";
    await prisma.employeeProfile.upsert({
      where: { userId },
      create: {
        userId,
        empCode: (profilePatch.empCode as string) || `${prefix}-${Date.now().toString().slice(-6)}`,
        department: (profilePatch.department as string | null) ?? null,
        designation: (profilePatch.designation as string | null) ?? null,
        joinDate: new Date(),
      },
      update: profilePatch,
    });
  }

  const profile = await prisma.employeeProfile.findUnique({ where: { userId } });
  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    include: { project: { select: { id: true, code: true, name: true } } },
  });
  await audit("hrm.employee.updated", { userId: req.user?.id, entity: "User", entityId: userId });
  res.json({ ...user, profile, memberships });
});

hrmRouter.delete("/employees/:id", hrmDesk, async (req: AuthedRequest, res) => {
  const userId = req.params.id;
  if (userId === req.user?.id) return res.status(400).json({ error: "Cannot remove your own account" });

  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) return res.status(404).json({ error: "User not found" });
  const { isKeptPortalEmail, isDemoSeedLoginEmail } = await import("../services/keepPortalUsers.js");
  if (isKeptPortalEmail(existing.email)) {
    return res.status(403).json({
      error: "This login is on the live SPDC / Twinoxis list and cannot be deleted.",
    });
  }
  const demoSeed = isDemoSeedLoginEmail(existing.email);
  if (existing.role === "admin" && req.user?.role !== "admin" && !demoSeed) {
    return res.status(403).json({ error: "Only admin can remove admin accounts" });
  }

  await prisma.projectMember.deleteMany({ where: { userId } });
  await prisma.employeeProfile.deleteMany({ where: { userId } });

  const stamp = Date.now();
  const retiredEmail = `deleted.${stamp}.${existing.email.replace("@", "_at_")}`.slice(0, 180);
  await prisma.user.update({
    where: { id: userId },
    data: {
      isActive: false,
      email: retiredEmail,
      fullName: `[Removed] ${existing.fullName}`.slice(0, 200),
    },
  });
  await audit("hrm.employee.removed", { userId: req.user?.id, entity: "User", entityId: userId });
  res.json({ ok: true, softDeleted: true });
});

hrmRouter.get("/attendance/today", hrmStaff, async (req: AuthedRequest, res) => {
  await applyAutoEodClockOut();
  const date = istStartOfDay();
  const row = await prisma.attendance.findUnique({
    where: { userId_date: { userId: req.user!.id, date } },
    include: {
      user: { select: { fullName: true, role: true, email: true } },
    },
  });
  if (!row) return res.json(null);
  let project = null;
  if (row.projectId) {
    project = await prisma.project.findUnique({
      where: { id: row.projectId },
      select: { id: true, code: true, name: true, location: true },
    });
  }
  res.json({
    ...row,
    project,
    inPhotoUrl: row.inPhotoUrl ? publicPhotoUrl(row.id, "in") : row.inPhotoUrl,
    outPhotoUrl: row.outPhotoUrl ? publicPhotoUrl(row.id, "out") : row.outPhotoUrl,
  });
});

hrmRouter.get("/attendance", hrmStaff, async (req, res) => {
  await applyAutoEodClockOut();
  const date = req.query.date ? new Date(String(req.query.date)) : istStartOfDay();
  if (req.query.date) date.setHours(0, 0, 0, 0);
  const rows = await prisma.attendance.findMany({
    where: { date },
    include: { user: { select: { fullName: true, role: true, email: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const projectIds = [...new Set(rows.map((r) => r.projectId).filter(Boolean))] as string[];
  const projects =
    projectIds.length > 0
      ? await prisma.project.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, code: true, name: true, location: true },
        })
      : [];
  const projectById = Object.fromEntries(projects.map((p) => [p.id, p]));
  res.json(
    rows.map((r) => ({
      ...r,
      project: r.projectId ? projectById[r.projectId] ?? null : null,
      inPhotoUrl: r.inPhotoUrl ? publicPhotoUrl(r.id, "in") : r.inPhotoUrl,
      outPhotoUrl: r.outPhotoUrl ? publicPhotoUrl(r.id, "out") : r.outPhotoUrl,
    }))
  );
});

/** Selfie + GPS punch — multipart: selfie (required), kind, lat, lng, accuracy, projectId */
hrmRouter.post(
  "/attendance/punch",
  requireRoles("admin", "office", "hr", "site_employee", "employee"),
  hrmUpload.single("selfie"),
  async (req: AuthedRequest, res) => {
    if (!req.file) return res.status(400).json({ error: "selfie photo required" });

    const kind: "in" | "out" = req.body.kind === "out" ? "out" : "in";
    const lat = parseFloat(String(req.body.lat ?? ""));
    const lng = parseFloat(String(req.body.lng ?? ""));
    const acc = parseFloat(String(req.body.accuracy ?? ""));
    const projectId = typeof req.body.projectId === "string" ? req.body.projectId.trim() : "";

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "GPS location required — allow location access on your device" });
    }

    const isSiteEmployee = req.user!.role === "site_employee";
    if (isSiteEmployee && !projectId) {
      return res.status(400).json({ error: "Select the site / project for check-in" });
    }

    await applyAutoEodClockOut();
    const date = istStartOfDay();
    const timeStr = formatIstTimeHHMM();

    let geofenceOk = false;
    let matchedSite: string | undefined;
    let projectCode = "OFFICE";
    if (projectId) {
      const proj = await prisma.project.findUnique({ where: { id: projectId } });
      if (proj) {
        projectCode = proj.code;
        matchedSite = proj.location || proj.code;
        geofenceOk = true;
      }
    }

    const person = (req.user!.fullName || req.user!.email || "user").replace(/[^a-zA-Z0-9._-]/g, "_");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const folder = "03_SUPPORT_AND_RESOURCES/03.02_Resources_and_Productivity/Attendance";
    const fname = `${kind}-${person}-${stamp}.jpg`;
    const saved = await mockOneDrive.upload(projectCode, folder, fname, req.file.buffer);
    const photoUrl = saved.url;

    const punchedAt = new Date().toISOString();

    const row = await prisma.attendance.upsert({
      where: { userId_date: { userId: req.user!.id, date } },
      create: {
        userId: req.user!.id,
        date,
        status: "Present",
        checkIn: kind === "in" ? timeStr : undefined,
        checkOut: kind === "out" ? timeStr : undefined,
        inLat: kind === "in" ? lat : null,
        inLng: kind === "in" ? lng : null,
        inAccuracy: kind === "in" && Number.isFinite(acc) ? acc : null,
        outLat: kind === "out" ? lat : null,
        outLng: kind === "out" ? lng : null,
        outAccuracy: kind === "out" && Number.isFinite(acc) ? acc : null,
        inSiteName: kind === "in" ? matchedSite ?? null : null,
        outSiteName: kind === "out" ? matchedSite ?? null : null,
        inGeofenceOk: kind === "in" ? geofenceOk : false,
        outGeofenceOk: kind === "out" ? geofenceOk : false,
        inPhotoUrl: kind === "in" ? photoUrl : null,
        outPhotoUrl: kind === "out" ? photoUrl : null,
        projectId: projectId || null,
      },
      update:
        kind === "in"
          ? {
              status: "Present",
              checkIn: timeStr,
              inLat: lat,
              inLng: lng,
              inAccuracy: Number.isFinite(acc) ? acc : undefined,
              inSiteName: matchedSite ?? undefined,
              inGeofenceOk: geofenceOk,
              inPhotoUrl: photoUrl,
              projectId: projectId || undefined,
            }
          : {
              checkOut: timeStr,
              outLat: lat,
              outLng: lng,
              outAccuracy: Number.isFinite(acc) ? acc : undefined,
              outSiteName: matchedSite ?? undefined,
              outGeofenceOk: geofenceOk,
              outPhotoUrl: photoUrl,
            },
    });

    await audit("hrm.attendance.punch", {
      userId: req.user!.id,
      entity: "Attendance",
      entityId: row.id,
      meta: {
        kind,
        punchedAt,
        localTime: timeStr,
        projectCode,
        projectId: projectId || null,
        siteName: matchedSite ?? null,
        lat,
        lng,
        accuracyM: Number.isFinite(acc) ? Math.round(acc) : null,
        mapsUrl: `https://www.google.com/maps?q=${lat},${lng}`,
        geofenceOk,
        provider: saved.provider,
        photoPath: saved.path,
        photoUrl: photoUrl,
        sharePointPath: saved.sharePointPath ?? null,
        sharePointUrl: saved.sharePointUrl ?? null,
        checkIn: row.checkIn,
        checkOut: row.checkOut,
      },
    });

    res.json({
      ...row,
      inPhotoUrl: kind === "in" ? publicPhotoUrl(row.id, "in") : row.inPhotoUrl,
      outPhotoUrl: kind === "out" ? publicPhotoUrl(row.id, "out") : row.outPhotoUrl,
      provider: saved.provider,
      photoPath: saved.path,
      sharePointPath: saved.sharePointPath ?? null,
      sharePointUrl: saved.sharePointUrl ?? null,
      sharePointWarning:
        process.env.MOCK_ONEDRIVE === "false" && saved.provider !== "sharepoint"
          ? "Photo saved on server only — SharePoint upload failed. Ask IT to verify Render env vars and Graph permissions."
          : undefined,
    });
  }
);

hrmRouter.post("/attendance", requireRoles("admin", "office", "hr", "site_employee", "employee"), async (req: AuthedRequest, res) => {
  await applyAutoEodClockOut();
  const date = new Date(req.body.date || Date.now());
  date.setHours(0, 0, 0, 0);
  const kind: "in" | "out" = req.body.kind === "out" ? "out" : "in";
  const timeStr = formatIstTimeHHMM();
  const geo = req.body.geo || {};
  const lat = typeof geo.lat === "number" ? geo.lat : req.body.lat;
  const lng = typeof geo.lng === "number" ? geo.lng : req.body.lng;
  const acc = typeof geo.accuracy === "number" ? geo.accuracy : req.body.accuracy;
  const siteName: string | undefined = req.body.siteName;
  const projectId: string | undefined = req.body.projectId;

  let geofenceOk = false;
  let matchedSite: string | undefined = siteName;
  if (projectId && typeof lat === "number" && typeof lng === "number") {
    const proj = await prisma.project.findUnique({ where: { id: projectId } });
    if (proj) {
      matchedSite = matchedSite || proj.location || proj.code;
      geofenceOk = true;
    }
  }

  const row = await prisma.attendance.upsert({
    where: { userId_date: { userId: req.user!.id, date } },
    create: {
      userId: req.user!.id,
      date,
      status: req.body.status || "Present",
      checkIn: kind === "in" ? req.body.checkIn || timeStr : undefined,
      checkOut: kind === "out" ? req.body.checkOut || timeStr : undefined,
      inLat: kind === "in" ? lat ?? null : null,
      inLng: kind === "in" ? lng ?? null : null,
      inAccuracy: kind === "in" ? acc ?? null : null,
      outLat: kind === "out" ? lat ?? null : null,
      outLng: kind === "out" ? lng ?? null : null,
      outAccuracy: kind === "out" ? acc ?? null : null,
      inSiteName: kind === "in" ? matchedSite ?? null : null,
      outSiteName: kind === "out" ? matchedSite ?? null : null,
      inGeofenceOk: kind === "in" ? geofenceOk : false,
      outGeofenceOk: kind === "out" ? geofenceOk : false,
      inPhotoUrl: kind === "in" ? req.body.photoUrl || null : null,
      outPhotoUrl: kind === "out" ? req.body.photoUrl || null : null,
      projectId: projectId || null,
      notes: req.body.notes || null,
    },
    update:
      kind === "in"
        ? {
            status: req.body.status || undefined,
            checkIn: req.body.checkIn || timeStr,
            inLat: lat ?? undefined,
            inLng: lng ?? undefined,
            inAccuracy: acc ?? undefined,
            inSiteName: matchedSite ?? undefined,
            inGeofenceOk: geofenceOk,
            inPhotoUrl: req.body.photoUrl || undefined,
            projectId: projectId || undefined,
          }
        : {
            status: req.body.status || undefined,
            checkOut: req.body.checkOut || timeStr,
            outLat: lat ?? undefined,
            outLng: lng ?? undefined,
            outAccuracy: acc ?? undefined,
            outSiteName: matchedSite ?? undefined,
            outGeofenceOk: geofenceOk,
            outPhotoUrl: req.body.photoUrl || undefined,
          },
  });
  res.json(row);
});

/* ─── departments, leave types, balances, holidays ─── */

async function distinctDepartmentNames(): Promise<string[]> {
  const [profiles, reqs, posts] = await Promise.all([
    prisma.employeeProfile.findMany({ where: { department: { not: null } }, select: { department: true }, distinct: ["department"] }),
    prisma.manpowerRequisition.findMany({ select: { department: true }, distinct: ["department"] }),
    prisma.jobPosting.findMany({ where: { department: { not: null } }, select: { department: true }, distinct: ["department"] }),
  ]);
  return [...new Set([...profiles, ...reqs, ...posts].map((r) => String(r.department || "").trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

hrmRouter.get("/departments", hrmStaff, async (_req, res) => {
  try {
    const rows = await prisma.hrmDepartment.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
    if (rows.length) return res.json(rows);
  } catch {
    /* table may not be migrated yet */
  }
  const names = await distinctDepartmentNames();
  res.json(names.map((name) => ({ id: name, code: name.slice(0, 12).toUpperCase().replace(/\s+/g, "_"), name, headName: null })));
});

hrmRouter.post("/departments", hrmDesk, async (req, res) => {
  const name = String(req.body.name || "").trim();
  const code = String(req.body.code || name.slice(0, 12)).trim().toUpperCase().replace(/\s+/g, "_");
  if (!name) return res.status(400).json({ error: "name required" });
  try {
    const row = await prisma.hrmDepartment.upsert({
      where: { code },
      create: { code, name, headName: req.body.headName ? String(req.body.headName).trim() : null },
      update: { name, headName: req.body.headName ? String(req.body.headName).trim() : null, isActive: true },
    });
    await audit("hrms.department.upsert", { userId: (req as AuthedRequest).user?.id, entity: "HrmDepartment", entityId: row.id });
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not save department — run database migration" });
  }
});

hrmRouter.delete("/departments/:id", hrmDesk, async (req, res) => {
  try {
    await prisma.hrmDepartment.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Department not found" });
  }
});

hrmRouter.get("/leave-types", hrmStaff, async (_req, res) => {
  const rows = await prisma.leaveType.findMany({ orderBy: { name: "asc" } });
  res.json(rows);
});

hrmRouter.post("/leave-types", hrmDesk, async (req, res) => {
  const row = await prisma.leaveType.upsert({
    where: { code: String(req.body.code || req.body.name || "").toUpperCase() },
    create: {
      code: String(req.body.code || req.body.name).toUpperCase(),
      name: req.body.name,
      daysPerYear: Number(req.body.daysPerYear || 0),
      isPaid: req.body.isPaid !== false,
      carryForward: !!req.body.carryForward,
      requiresApproval: req.body.requiresApproval !== false,
      colour: req.body.colour || null,
    },
    update: {
      name: req.body.name,
      daysPerYear: Number(req.body.daysPerYear || 0),
      isPaid: req.body.isPaid !== false,
      carryForward: !!req.body.carryForward,
      requiresApproval: req.body.requiresApproval !== false,
      colour: req.body.colour || null,
    },
  });
  res.json(row);
});

hrmRouter.get("/holidays", async (req, res) => {
  const year = Number(req.query.year || new Date().getFullYear());
  const from = new Date(year, 0, 1);
  const to = new Date(year + 1, 0, 1);
  const rows = await prisma.holiday.findMany({ where: { date: { gte: from, lt: to } }, orderBy: { date: "asc" } });
  res.json(rows);
});

hrmRouter.post("/holidays", hrmDesk, async (req, res) => {
  const rows: Array<{ date: string; name: string; region?: string; isOptional?: boolean }> = Array.isArray(req.body) ? req.body : [req.body];
  const created = [];
  for (const r of rows) {
    if (!r.date || !r.name) continue;
    const date = new Date(r.date);
    date.setHours(0, 0, 0, 0);
    const row = await prisma.holiday.upsert({
      where: { date_name: { date, name: r.name } },
      create: { date, name: r.name, region: r.region || "India", isOptional: !!r.isOptional },
      update: { region: r.region || "India", isOptional: !!r.isOptional },
    });
    created.push(row);
  }
  res.status(201).json(created);
});

hrmRouter.delete("/holidays/:id", hrmDesk, async (req, res) => {
  await prisma.holiday.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

hrmRouter.get("/leave-balances", hrmStaff, async (req: AuthedRequest, res) => {
  const year = Number(req.query.year || new Date().getFullYear());
  const userId = String(req.query.userId || req.user!.id);
  const rows = await prisma.leaveBalance.findMany({
    where: { userId, year },
    include: { leaveType: true },
  });
  res.json(rows);
});

hrmRouter.post("/leave-balances", hrmDesk, async (req, res) => {
  const { userId, leaveTypeId, year, entitled } = req.body;
  if (!userId || !leaveTypeId || !year) return res.status(400).json({ error: "userId, leaveTypeId, year required" });
  const row = await prisma.leaveBalance.upsert({
    where: { userId_leaveTypeId_year: { userId, leaveTypeId, year: Number(year) } },
    create: { userId, leaveTypeId, year: Number(year), entitled: Number(entitled || 0), used: 0, balance: Number(entitled || 0) },
    update: { entitled: Number(entitled || 0), balance: Number(entitled || 0) - (await prisma.leaveBalance.findUnique({ where: { userId_leaveTypeId_year: { userId, leaveTypeId, year: Number(year) } } }))!.used },
  });
  res.json(row);
});

/* ─── employee documents (metadata only for now; upload endpoint later) ─── */

hrmRouter.get("/documents/:userId", async (req, res) => {
  const rows = await prisma.employeeDocument.findMany({ where: { userId: req.params.userId }, orderBy: { createdAt: "desc" } });
  res.json(rows);
});

hrmRouter.post("/documents", hrmDesk, async (req, res) => {
  const row = await prisma.employeeDocument.create({
    data: {
      userId: req.body.userId,
      category: req.body.category || "General",
      title: req.body.title,
      fileUrl: req.body.fileUrl,
      storagePath: req.body.storagePath || null,
      issuedOn: req.body.issuedOn ? new Date(req.body.issuedOn) : null,
      validTill: req.body.validTill ? new Date(req.body.validTill) : null,
    },
  });
  res.status(201).json(row);
});

hrmRouter.post("/employees/provision-vaults", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  try {
    const userId = String(req.body?.userId || req.query.userId || "").trim() || undefined;
    const { provisionAllEmployeeVaults } = await import("../services/hrEmployeeVault.js");
    const out = await provisionAllEmployeeVaults({ userId, syncDocs: true });
    await audit("hrm.employees.provision_vaults", {
      userId: req.user?.id,
      entity: "EmployeeDocument",
      meta: { count: out.provisioned, userId: userId || null },
    });
    res.json(out);
  } catch (err) {
    pushRuntimeLog({
      level: "error",
      source: "hrm.employees.provision_vaults",
      message: "Could not provision employee vaults",
      detail: errorDetail(err),
    });
    res.status(500).json({ error: "Could not provision employee vaults" });
  }
});

hrmRouter.get("/employee-files", async (req: AuthedRequest, res) => {
  const userId = String(req.query.userId || "");
  if (!userId) return res.status(400).json({ error: "userId required" });
  const isHr = req.user!.role === "admin" || req.user!.role === "office" || req.user!.role === "hr";
  if (!isHr && req.user!.id !== userId) return res.status(403).json({ error: "Forbidden" });
  const rows = await prisma.employeeDocument.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  res.json(rows);
});

hrmRouter.post(
  "/employee-files",
  hrmDesk,
  hrmUpload.array("files", 12),
  async (req: AuthedRequest, res) => {
    const userId = String(req.body.userId || "");
    if (!userId) return res.status(400).json({ error: "userId required" });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "employee not found" });
    const files = (req.files as Express.Multer.File[] | undefined) || [];
    if (!files.length) return res.status(400).json({ error: "Upload at least one file" });
    const category = String(req.body.category || "General");
    const titleBase = String(req.body.title || "").trim();
    const profile = await prisma.employeeProfile.findFirst({ where: { userId } });
    const {
      employeeVaultRelPath,
      vaultSubfolderForCategory,
      vaultFileNameForUpload,
      ensureEmployeeVault,
    } = await import("../services/hrEmployeeVault.js");
    await ensureEmployeeVault({ userId, fullName: user.fullName, email: user.email, profile });
    const vaultRel = employeeVaultRelPath(profile, user.fullName);
    const subfolder = vaultSubfolderForCategory(category);
    const created = [];
    for (const file of files) {
      const safeName = vaultFileNameForUpload({
        category,
        profile,
        fullName: user.fullName,
        originalName: file.originalname,
      });
      const saved = await mockOneDrive.upload(
        "_HR",
        `${vaultRel}/${subfolder}`,
        safeName,
        file.buffer
      );
      const url = saved.sharePointUrl || saved.url || `/uploads/onedrive/_HR/${saved.path}`;
      created.push(
        await prisma.employeeDocument.create({
          data: {
            userId,
            category,
            title: titleBase || file.originalname || category,
            fileUrl: url,
            storagePath: saved.sharePointPath || saved.path,
            issuedOn: req.body.issuedOn ? new Date(req.body.issuedOn) : new Date(),
          },
        })
      );
    }
    await audit("hrm.files.upload", {
      userId: req.user!.id,
      entity: "EmployeeDocument",
      entityId: userId,
      meta: { count: created.length, category },
    });
    res.status(201).json(created);
  }
);

hrmRouter.delete("/employee-files/:id", hrmDesk, async (req: AuthedRequest, res) => {
  await prisma.employeeDocument.delete({ where: { id: req.params.id } });
  await audit("hrm.files.delete", { userId: req.user!.id, entity: "EmployeeDocument", entityId: req.params.id });
  res.json({ ok: true });
});

/* ─────────────────── HRMS Documents (Appointment / Relieving / Exit / Asset / Offer) ───────────────────
 * Two ways to add:
 *   1. Fill the form -> we build a .docx from the template stored in apps/api/formats/hrms/<kind>.docx
 *      (branded with the Sharnam letterhead) and store both the .docx and a print-ready HTML/PDF path.
 *   2. Upload the signed / scanned copy back -> attaches the file to the same record.
 * All artefacts land under 06_HR_AND_ADMIN/06.01_Letters on the mock OneDrive / SharePoint tree.
 */
const HRMS_DOC_KINDS = [
  "Appointment",
  "Relieving",
  "Exit",
  "AssetReturn",
  "Offer",
  "Confirmation",
  "Promotion",
  "Warning",
  "Experience",
] as const;
type HrmsDocKind = (typeof HRMS_DOC_KINDS)[number];

const HRMS_DOC_FOLDER = "06_HR_AND_ADMIN/06.01_Letters";

function hrmsDocRefNo(kind: HrmsDocKind) {
  const yy = new Date().getFullYear();
  const yn = String(yy).slice(-2);
  const nx = String(yy + 1).slice(-2);
  const seq = String(Date.now()).slice(-4);
  const codeMap: Record<HrmsDocKind, string> = {
    Appointment: "OL",
    Offer: "OF",
    Relieving: "RL",
    Exit: "EX",
    AssetReturn: "AR",
    Confirmation: "CF",
    Promotion: "PR",
    Warning: "WR",
    Experience: "EC",
  };
  return `SPDC/HR/${codeMap[kind]}/${yn}-${nx}/${seq}`;
}

hrmRouter.get("/hrms-documents", hrmDesk, async (req, res) => {
  const rows = await prisma.hrmsDocument.findMany({
    where: {
      ...(req.query.kind ? { kind: String(req.query.kind) } : {}),
      ...(req.query.employeeUserId ? { employeeUserId: String(req.query.employeeUserId) } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Number(req.query.limit) || 200,
  });
  const uploaderIds = Array.from(new Set(rows.map((r) => r.createdById).filter(Boolean))) as string[];
  const users = uploaderIds.length
    ? await prisma.user.findMany({ where: { id: { in: uploaderIds } }, select: { id: true, fullName: true, email: true } })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  res.json(rows.map((r) => ({ ...r, createdBy: r.createdById ? userMap.get(r.createdById) || null : null })));
});

/**
 * Create an HRMS letter — either fill the form and generate, or paste ready file URL later.
 * Body:
 *   kind (required), employeeName (required), employeeUserId?, designation?, department?,
 *   effectiveDate?, data (json blob for the template placeholders)
 */
hrmRouter.post("/hrms-documents", hrmDesk, async (req: AuthedRequest, res) => {
  const kindRaw = String(req.body.kind || "");
  if (!(HRMS_DOC_KINDS as readonly string[]).includes(kindRaw)) {
    return res.status(400).json({ error: `kind must be one of ${HRMS_DOC_KINDS.join(" | ")}` });
  }
  const kind = kindRaw as HrmsDocKind;
  const employeeName = String(req.body.employeeName || "").trim();
  if (!employeeName) return res.status(400).json({ error: "employeeName required" });

  const refNo = String(req.body.refNo || hrmsDocRefNo(kind));
  const dataJson = req.body.data && typeof req.body.data === "object" ? JSON.stringify(req.body.data) : String(req.body.data || "{}");

  const row = await prisma.hrmsDocument.create({
    data: {
      kind,
      refNo,
      employeeUserId: req.body.employeeUserId || null,
      employeeName,
      candidateEmail: req.body.candidateEmail || null,
      designation: req.body.designation || null,
      department: req.body.department || null,
      effectiveDate: req.body.effectiveDate ? new Date(req.body.effectiveDate) : null,
      dataJson,
      status: "Draft",
      createdById: req.user!.id,
    },
  });
  await audit("hrm.docs.create", { userId: req.user!.id, entity: "HrmsDocument", entityId: row.id, meta: { kind, refNo } });
  res.status(201).json(row);
});

/**
 * Generate the branded .docx and .pdf-ready HTML from the stored form data.
 * Templates live in apps/api/formats/hrms/<kind>.docx (or fallback .html/.txt).
 * Also stamps the Sharnam logo via brandedExport if the fallback path is used.
 */
hrmRouter.post("/hrms-documents/:id/generate", hrmDesk, async (req: AuthedRequest, res) => {
  const row = await prisma.hrmsDocument.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "not found" });

  const { generateHrmsLetter } = await import("../services/hrmsLetter.js");
  let gen: Awaited<ReturnType<typeof generateHrmsLetter>>;
  try {
    gen = await generateHrmsLetter(row);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Letter generate failed" });
  }

  const updated = await prisma.hrmsDocument.update({
    where: { id: row.id },
    data: {
      generatedDocxUrl: gen.docxUrl || row.generatedDocxUrl,
      generatedPdfUrl: gen.pdfUrl || row.generatedPdfUrl,
      storagePath: gen.storagePath || row.storagePath,
      sharePointUrl: gen.sharePointUrl || row.sharePointUrl,
      status: "Generated",
    },
  });
  if (updated.employeeUserId && (updated.kind === "Appointment" || updated.kind === "Offer" || updated.kind === "Promotion")) {
    const fileUrl = updated.sharePointUrl || updated.generatedPdfUrl || "";
    const { attachHrmsLetterToEmployeeVault } = await import("../services/hrmsLetter.js");
    await attachHrmsLetterToEmployeeVault(updated, { fileUrl, storagePath: updated.storagePath, signed: false });
  }
  await audit("hrm.docs.generate", { userId: req.user!.id, entity: "HrmsDocument", entityId: row.id, meta: { kind: row.kind, refNo: row.refNo } });
  res.json(updated);
});

hrmRouter.get("/hrms-documents/:id/preview", hrmDesk, async (req, res) => {
  const row = await prisma.hrmsDocument.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "not found" });
  const { renderHrmsLetterHtml } = await import("../services/hrmsLetter.js");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(renderHrmsLetterHtml(row));
});

/** Upload the signed / scanned copy back and attach to the same record. */
hrmRouter.post(
  "/hrms-documents/:id/upload",
  hrmDesk,
  hrmUpload.single("file"),
  async (req: AuthedRequest, res) => {
    const row = await prisma.hrmsDocument.findUnique({ where: { id: req.params.id } });
    if (!row) return res.status(404).json({ error: "not found" });
    if (!req.file) return res.status(400).json({ error: "file required" });
    const safeRef = row.refNo.replace(/[^a-zA-Z0-9._-]/g, "_");
    const ext = /\.([a-zA-Z0-9]{2,5})$/.exec(req.file.originalname || "")?.[0] || ".bin";
    const saved = await mockOneDrive.upload(
      "_HR",
      HRMS_DOC_FOLDER,
      `${row.kind}-${safeRef}-signed-${Date.now()}${ext}`,
      req.file.buffer
    );
    const updated = await prisma.hrmsDocument.update({
      where: { id: row.id },
      data: {
        uploadedFileUrl: saved.url || `/uploads/office/${saved.path}`,
        sharePointUrl: saved.sharePointUrl || saved.url || row.sharePointUrl,
        storagePath: saved.path,
        status: "Signed",
      },
    });
    const signedUrl = updated.uploadedFileUrl || updated.sharePointUrl || "";
    const { attachHrmsLetterToEmployeeVault } = await import("../services/hrmsLetter.js");
    await attachHrmsLetterToEmployeeVault(updated, {
      fileUrl: signedUrl,
      storagePath: updated.storagePath,
      signed: true,
    });
    await audit("hrm.docs.upload", { userId: req.user!.id, entity: "HrmsDocument", entityId: row.id, meta: { kind: row.kind, refNo: row.refNo } });
    res.json(updated);
  }
);

hrmRouter.patch("/hrms-documents/:id", hrmDesk, async (req: AuthedRequest, res) => {
  const before = await prisma.hrmsDocument.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "not found" });
  const data: Record<string, unknown> = {};
  for (const k of ["employeeName", "candidateEmail", "designation", "department", "status"] as const) {
    if (req.body[k] != null) data[k] = req.body[k];
  }
  if (req.body.effectiveDate !== undefined) data.effectiveDate = req.body.effectiveDate ? new Date(req.body.effectiveDate) : null;
  if (req.body.data && typeof req.body.data === "object") data.dataJson = JSON.stringify(req.body.data);
  const row = await prisma.hrmsDocument.update({ where: { id: req.params.id }, data });
  res.json(row);
});

hrmRouter.delete("/hrms-documents/:id", hrmDesk, async (req: AuthedRequest, res) => {
  await prisma.hrmsDocument.delete({ where: { id: req.params.id } });
  await audit("hrm.docs.delete", { userId: req.user!.id, entity: "HrmsDocument", entityId: req.params.id });
  res.json({ ok: true });
});

hrmRouter.get("/leave", hrmDesk, async (_req, res) => {
  const rows = await prisma.leaveRequest.findMany({
    include: { user: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(rows);
});

hrmRouter.post("/leave", requireRoles("admin", "office", "hr", "site_employee", "employee"), async (req: AuthedRequest, res) => {
  const from = new Date(req.body.fromDate);
  const to = new Date(req.body.toDate);
  const halfDay = !!req.body.halfDay;
  const days = Number(req.body.days) || Math.max(halfDay ? 0.5 : 1, Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const row = await prisma.leaveRequest.create({
    data: {
      userId: req.user!.id,
      leaveTypeId: req.body.leaveTypeId || null,
      fromDate: from,
      toDate: to,
      days,
      halfDay,
      reason: req.body.reason,
    },
    include: { leaveType: true },
  });
  res.status(201).json(row);
});

hrmRouter.patch("/leave/:id", hrmDesk, async (req: AuthedRequest, res) => {
  const before = await prisma.leaveRequest.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "not found" });
  const status = String(req.body.status);
  const row = await prisma.leaveRequest.update({
    where: { id: req.params.id },
    data: {
      status,
      approverId: req.user!.id,
      decidedAt: new Date(),
      decisionNote: req.body.decisionNote || null,
    },
  });
  if (status === "Approved" && before.status !== "Approved" && before.leaveTypeId) {
    const year = new Date(before.fromDate).getFullYear();
    const bal = await prisma.leaveBalance.findUnique({
      where: { userId_leaveTypeId_year: { userId: before.userId, leaveTypeId: before.leaveTypeId, year } },
    });
    if (bal) {
      const used = bal.used + before.days;
      await prisma.leaveBalance.update({
        where: { id: bal.id },
        data: { used, balance: bal.entitled - used },
      });
    }
  }
  res.json(row);
});

const HR_HEAD_EMAIL = "anushka.jha@spdc.in";
function canApproveVoucher(user?: { email?: string; role?: string } | null) {
  if (!user) return false;
  if (user.role === "admin" || user.role === "hr") return true;
  if (user.email?.toLowerCase() === HR_HEAD_EMAIL) return true;
  return user.role === "office";
}

function parseVoucherParticulars(raw: unknown): { particular: string; amount: number; date?: string; qty?: number; rate?: number; category?: string }[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

hrmRouter.get("/vouchers", requireRoles("admin", "office", "hr", "employee", "site_employee"), async (req: AuthedRequest, res) => {
  const mine = !canApproveVoucher(req.user);
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";
  const rows = await prisma.expenseVoucher.findMany({
    where: {
      ...(mine ? { userId: req.user!.id } : {}),
      ...(projectId ? { projectId } : {}),
    },
    include: {
      user: { select: { fullName: true, email: true } },
      approver: { select: { fullName: true } },
      project: { select: { id: true, code: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(
    rows.map((row) => ({
      ...row,
      particulars: parseVoucherParticulars(row.particularsJson),
    }))
  );
});

hrmRouter.post("/vouchers", requireRoles("admin", "office", "hr", "employee", "site_employee"), async (req: AuthedRequest, res) => {
  const particulars = parseVoucherParticulars(req.body.particulars);
  const lineSum = particulars.reduce((s, l) => s + Number(l.amount || 0), 0);
  const amount = Number(req.body.amount || lineSum);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Amount required" });
  const description =
    String(req.body.description || "").trim() ||
    particulars
      .map((l) => l.particular)
      .filter(Boolean)
      .join("; ");
  if (!description) return res.status(400).json({ error: "Particulars required" });
  const count = await prisma.expenseVoucher.count({ where: { userId: req.user!.id } });
  const voucherNo = `VOU-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
  const row = await prisma.expenseVoucher.create({
    data: {
      voucherNo,
      userId: req.user!.id,
      projectId: req.body.projectId || null,
      voucherDate: req.body.voucherDate ? new Date(req.body.voucherDate) : new Date(),
      category: String(req.body.category || "Site"),
      description,
      amount,
      status: "Submitted",
      particularsJson: particulars.length ? JSON.stringify(particulars) : null,
    },
    include: { user: { select: { fullName: true } }, project: { select: { id: true, code: true, name: true } } },
  });
  await audit("hrm.voucher.raise", { userId: req.user!.id, entity: "ExpenseVoucher", entityId: row.id });
  res.status(201).json({ ...row, particulars });
});

hrmRouter.patch("/vouchers/:id", hrmDesk, async (req: AuthedRequest, res) => {
  if (!canApproveVoucher(req.user)) return res.status(403).json({ error: "HR approval only" });
  const before = await prisma.expenseVoucher.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "not found" });
  const status = String(req.body.status || "");
  if (!["Approved", "Rejected", "Paid"].includes(status)) {
    return res.status(400).json({ error: "status must be Approved, Rejected, or Paid" });
  }
  const row = await prisma.expenseVoucher.update({
    where: { id: before.id },
    data: {
      status,
      approverId: req.user!.id,
      decidedAt: new Date(),
      decisionNote: req.body.decisionNote || null,
    },
  });
  await audit("hrm.voucher.decide", { userId: req.user!.id, entity: "ExpenseVoucher", entityId: row.id, meta: { status } });
  res.json(row);
});
