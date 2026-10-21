/**
 * QAP plan lines, role map, IR list and re-offer. Mounted on the checklist router.
 */
import type { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { listQapLines, qpiForRange, refreshQapWeek, weekRange } from "../services/qapQuality.js";
import { createReoffer } from "../services/qapIrFlow.js";
import { rowIsHeader } from "../services/qapQuality.js";

const SPDC = ["admin", "office", "employee", "site_employee"] as const;

export function mountQapQuality(router: Router) {
  router.get("/project/:projectId/qap/plan-lines", requireAuth, async (req: AuthedRequest, res) => {
    const pkg = req.query.package == null ? undefined : String(req.query.package);
    const lines = await listQapLines(req.params.projectId, pkg);
    res.json({
      lines: lines.map((l) => ({
        ...l,
        canRaise: !l.isHeader && !rowIsHeader(l),
      })),
    });
  });

  router.get("/project/:projectId/qap/roles", requireAuth, async (req: AuthedRequest, res) => {
    const projectId = req.params.projectId;
    await listQapLines(projectId);
    const lines = await prisma.qapLine.findMany({ where: { projectId } });
    const labels = new Map<string, string>();
    const add = (label: string | null | undefined, party: string) => {
      const text = String(label || "").trim();
      if (!text) return;
      labels.set(`${party}\u0001${text}`, party);
    };
    for (const l of lines) {
      add(l.contractorPerformer, "Contractor");
      add(l.contractorChecker, "Contractor");
      add(l.pmcRole, "PMC");
      add(l.clientRole, "Client");
    }
    const saved = await prisma.qapRoleAssignment.findMany({
      where: { projectId },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        vendor: { select: { id: true, name: true } },
        contact: { select: { id: true, personName: true, email: true, orgSection: true } },
      },
    });
    const byKey = new Map(saved.map((s) => [`${s.party}\u0001${s.roleLabel}`, s]));
    const roles = [...labels.entries()].map(([key, party]) => {
      const roleLabel = key.split("\u0001")[1];
      const row = byKey.get(key);
      return {
        roleLabel,
        party,
        userId: row?.userId || null,
        vendorId: row?.vendorId || null,
        contactId: row?.contactId || null,
        userName: row?.user?.fullName || null,
        vendorName: row?.vendor?.name || null,
        contactName: row?.contact?.personName || null,
        mapped: !!(row?.userId || row?.vendorId || row?.contactId),
      };
    });
    const [users, vendors, contacts] = await Promise.all([
      prisma.projectMember.findMany({
        where: { projectId },
        include: { user: { select: { id: true, fullName: true, email: true, role: true } } },
      }),
      prisma.projectVendor.findMany({ where: { projectId }, include: { vendor: { select: { id: true, name: true } } } }),
      prisma.communicationContact.findMany({
        where: { projectId, isSectionHeader: false },
        select: { id: true, personName: true, email: true, orgSection: true, designation: true },
        orderBy: { sortOrder: "asc" },
      }),
    ]);
    res.json({
      roles,
      unmapped: roles.filter((r) => !r.mapped).map((r) => `${r.party}: ${r.roleLabel}`),
      users: users.map((m) => m.user),
      vendors: vendors.map((v) => v.vendor),
      contacts,
    });
  });

  router.put("/project/:projectId/qap/roles", requireRoles(...SPDC), async (req: AuthedRequest, res) => {
    const projectId = req.params.projectId;
    const items = Array.isArray(req.body?.roles) ? req.body.roles : [];
    for (const item of items) {
      const roleLabel = String(item.roleLabel || "").trim();
      const party = String(item.party || "").trim();
      if (!roleLabel || !["Contractor", "PMC", "Client"].includes(party)) continue;
      await prisma.qapRoleAssignment.upsert({
        where: { projectId_roleLabel_party: { projectId, roleLabel, party } },
        create: {
          projectId,
          roleLabel,
          party,
          userId: item.userId || null,
          vendorId: item.vendorId || null,
          contactId: item.contactId || null,
        },
        update: {
          userId: item.userId || null,
          vendorId: item.vendorId || null,
          contactId: item.contactId || null,
        },
      });
    }
    res.json({ ok: true });
  });

  router.get("/project/:projectId/qap/line/:lineId/irs", requireAuth, async (req: AuthedRequest, res) => {
    const line = await prisma.qapLine.findFirst({ where: { id: req.params.lineId, projectId: req.params.projectId } });
    if (!line) return res.status(404).json({ error: "QAP line not found" });
    const irs = await prisma.rfi.findMany({
      where: { projectId: req.params.projectId, qapLineId: line.id, rfiKind: "QualityIR" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        number: true,
        irNumber: true,
        status: true,
        createdAt: true,
        previousIrId: true,
        formDataJson: true,
      },
    });
    res.json({
      line,
      irs: irs.map((r) => {
        let form: Record<string, string> = {};
        try {
          form = r.formDataJson ? JSON.parse(r.formDataJson) : {};
        } catch {
          form = {};
        }
        return {
          id: r.id,
          number: r.irNumber || r.number,
          date: r.createdAt,
          location: form.location || "",
          result: form.result || "Pending",
          status: r.status,
          previousIrId: r.previousIrId,
          shortNotice: form.shortNotice === "true",
          elementOrLot: form.elementOrLot || "",
          source: form.source || "",
        };
      }),
    });
  });

  router.post("/project/:projectId/qap/reoffer", requireAuth, async (req: AuthedRequest, res) => {
    const out = await createReoffer({ projectId: req.params.projectId, rfiId: String(req.body?.rfiId || ""), user: req.user! });
    if ("error" in out) return res.status(out.status ?? 400).json({ error: out.error });
    res.status(201).json(out.rfi);
  });

  router.post("/project/:projectId/qap/add-to-week", requireRoles(...SPDC), async (req: AuthedRequest, res) => {
    const projectId = req.params.projectId;
    const weekLabel = String(req.body?.weekLabel || "").trim();
    const workPackage = req.body?.workPackage ? String(req.body.workPackage) : null;
    const lineIds: string[] = Array.isArray(req.body?.lineIds) ? req.body.lineIds.map(String) : [];
    if (!weekLabel) return res.status(400).json({ error: "weekLabel is required" });
    const lines = await prisma.qapLine.findMany({
      where: { projectId, ...(lineIds.length ? { id: { in: lineIds } } : {}), ...(workPackage ? { workPackage } : {}) },
      orderBy: { sortOrder: "asc" },
    });
    let added = 0;
    for (const line of lines) {
      const exists = await prisma.qapActivity.findFirst({
        where: { projectId, weekLabel, qapLineId: line.id },
      });
      if (exists) continue;
      await prisma.qapActivity.create({
        data: {
          projectId,
          weekLabel,
          qapLineId: line.id,
          workPackage: line.workPackage,
          srNo: line.srNo,
          section: line.section,
          activity: line.activity || line.section || "Activity",
          description: line.description,
          frequency: line.frequency,
          codeOfConformance: line.codeOfConformance,
          testAgency: line.testAgency,
          contractorPerformer: line.contractorPerformer,
          contractorChecker: line.contractorChecker,
          pmcRole: line.pmcRole,
          clientRole: line.clientRole,
          records: line.records,
          discipline: line.discipline,
          isHeader: line.isHeader,
          status: line.isHeader ? "Header" : "Not started",
        },
      });
      added += 1;
    }
    res.json({ added, weekLabel });
  });

  router.get("/project/:projectId/qap/ir-kpis", requireAuth, async (req: AuthedRequest, res) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId }, select: { startDate: true } });
    const weekLabel = String(req.query.week || "");
    const range = weekRange(weekLabel, project?.startDate || null);
    const summaries = await refreshQapWeek(req.params.projectId, weekLabel || undefined);
    const irs = await prisma.rfi.findMany({
      where: {
        projectId: req.params.projectId,
        rfiKind: "QualityIR",
        createdAt: { gte: range.start, lte: range.end },
      },
      select: { id: true, status: true, createdAt: true, previousIrId: true, formDataJson: true, updatedAt: true },
    });
    let firstPass = 0;
    let rejected = 0;
    let deferred = 0;
    let responseHours = 0;
    let responseN = 0;
    for (const ir of irs) {
      let form: Record<string, string> = {};
      try {
        form = ir.formDataJson ? JSON.parse(ir.formDataJson) : {};
      } catch {
        form = {};
      }
      const code = String(form.result || "").charAt(0).toUpperCase();
      if (!ir.previousIrId && (code === "A" || code === "B") && /approved/i.test(ir.status)) firstPass += 1;
      if (code === "C") rejected += 1;
      if (code === "D") deferred += 1;
      if (form.inspectedAt) {
        const dt = Date.parse(form.inspectedAt) - ir.createdAt.getTime();
        if (dt > 0) {
          responseHours += dt / 3600000;
          responseN += 1;
        }
      }
    }
    const due = summaries.reduce((n, s) => n + (typeof s.due === "number" ? (s.due as number) : 0), 0);
    const raised = summaries.reduce((n, s) => n + (typeof s.raised === "number" ? (s.raised as number) : 0), 0);
    const overdue = summaries.filter((s) => s.status === "Overdue").length;
    const qpiWeeks = [];
    for (let i = 0; i < 3; i++) {
      const end = new Date(range.end);
      end.setDate(end.getDate() - i * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      qpiWeeks.push(await qpiForRange(req.params.projectId, start, end, `Week ending ${end.toISOString().slice(0, 10)}`));
    }
    res.json({
      due,
      raised,
      overdue,
      irsRaised: irs.length,
      firstTimeApprovalRate: irs.length ? Math.round((firstPass / irs.length) * 1000) / 10 : null,
      rejected,
      deferred,
      avgResponseHours: responseN ? Math.round((responseHours / responseN) * 10) / 10 : null,
      qpi: qpiWeeks,
    });
  });
}
