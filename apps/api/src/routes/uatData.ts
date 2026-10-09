/**
 * Admin · UAT data desk — load the Arvind week data SPDC shared, and list the leftover
 * test projects / logins so an admin can clear them before client UAT.
 */
import { Router } from "express";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { prisma } from "../prisma.js";
import { audit } from "../services/audit.js";

export const uatDataRouter = Router();
uatDataRouter.use(requireAuth);
uatDataRouter.use(requireRoles("admin"));

type LoadState = {
  status: "idle" | "running" | "done" | "failed";
  startedAt?: string;
  finishedAt?: string;
  startedBy?: string;
  summary?: Record<string, unknown>;
  error?: string;
};
let loadState: LoadState = { status: "idle" };

const KEEP_CODES = ["SPDC-ARVIND-NTX", "SPDC-ARVIND-01"];
/** Logins created by tests / demos — never real SPDC people. */
const TEST_EMAIL = /(\.test$|@example\.(com|org)$|@local\.test$|^test[._-]|\.demo$|@no-login\.)/i;

uatDataRouter.get("/status", async (_req, res) => {
  const arvind = await prisma.project.findMany({
    where: { code: { in: KEEP_CODES } },
    select: { id: true, code: true, name: true, _count: { select: { drawings: true, rfis: true } } },
  });
  res.json({ load: loadState, arvind });
});

/** Runs the Arvind NTX + dormitory week pack in the background (several minutes, files to SharePoint). */
uatDataRouter.post("/load-arvind", async (req: AuthedRequest, res) => {
  if (loadState.status === "running") return res.status(409).json({ error: "The Arvind data is already loading.", load: loadState });
  loadState = { status: "running", startedAt: new Date().toISOString(), startedBy: req.user!.email };
  await audit("uat.load_arvind", { userId: req.user!.id });
  res.status(202).json({ load: loadState });
  void (async () => {
    try {
      const { seedArvindSitePack } = await import("../services/arvindSiteSeed.js");
      // Logins and project teams are set up; credential emails are not queued (staff keep their own passwords).
      const out = (await seedArvindSitePack(prisma as never, { skipInviteEmails: true })) as Record<string, unknown>;
      // Checklist templates for the Arvind projects: Quality catalog, SPDC HSE pack (F-01/F-02/F-03), Activity F-02.
      const templates: Record<string, unknown> = {};
      try {
        const hse = await prisma.checklistTemplate.count({ where: { source: "SPDC HSE Pack" } });
        if (!hse) {
          const { seedSpdcSafetyPack } = await import("../services/safetyPackSeed.js");
          templates.safety = (await seedSpdcSafetyPack()).templates.length;
        } else templates.safety = `${hse} already loaded`;
      } catch (err) {
        templates.safety = `failed: ${err instanceof Error ? err.message : err}`;
      }
      try {
        const { seedActivityChecklist } = await import("../services/activityChecklistSeed.js");
        templates.activity = (await seedActivityChecklist())?.items ?? "format not found";
      } catch (err) {
        templates.activity = `failed: ${err instanceof Error ? err.message : err}`;
      }
      const arvindProjects = await prisma.project.findMany({ where: { code: { in: KEEP_CODES } }, select: { id: true, code: true } });
      const { syncQualityChecklistCatalog } = await import("../services/qualityChecklistCatalog.js");
      const hseAndActivity = await prisma.checklistTemplate.findMany({
        where: { OR: [{ source: "SPDC HSE Pack" }, { checklistType: "ActivityInspection", isActive: true }] },
        select: { id: true },
      });
      for (const p of arvindProjects) {
        try {
          const q = await syncQualityChecklistCatalog(p.id);
          templates[`${p.code} quality`] = q.assigned;
        } catch (err) {
          templates[`${p.code} quality`] = `failed: ${err instanceof Error ? err.message : err}`;
        }
        for (const t of hseAndActivity) {
          await prisma.checklistAssignment.upsert({
            where: { projectId_templateId: { projectId: p.id, templateId: t.id } },
            create: { projectId: p.id, templateId: t.id },
            update: {},
          });
        }
        templates[`${p.code} safety+activity`] = hseAndActivity.length;
      }
      // Placeholder rows from the DPR demo day are not SPDC data — remove them; recompute QAP status with the current rule.
      const ids = arvindProjects.map((p) => p.id);
      const demoSafety = await prisma.safetyRecord.deleteMany({ where: { projectId: { in: ids }, title: { startsWith: "[DPR-DEMO]" } } });
      const demoCubes = await prisma.cubeTest.deleteMany({ where: { projectId: { in: ids }, description: { startsWith: "[DPR-DEMO]" } } });
      const { qapStatusFromRow } = await import("../services/qualityDashboardSheets.js");
      let qapFixed = 0;
      for (const q of await prisma.qapActivity.findMany({ where: { projectId: { in: ids } } })) {
        let daily: Record<string, boolean> = {};
        try {
          daily = q.dailyChecks ? JSON.parse(q.dailyChecks) : {};
        } catch {
          daily = {};
        }
        const flags = qapStatusFromRow({
          srNo: q.srNo,
          section: q.section || q.activity,
          description: q.description || "",
          frequency: q.frequency || "",
          codeOfConformance: q.codeOfConformance || "",
          testAgency: q.testAgency || "",
          contractorPerformer: q.contractorPerformer || "",
          contractorChecker: q.contractorChecker || "",
          pmcRole: q.pmcRole || "",
          clientRole: q.clientRole || "",
          records: q.records || "",
          remarks: q.remarks || "",
          dailyChecks: daily,
        } as never);
        if (flags.status !== q.status) {
          await prisma.qapActivity.update({ where: { id: q.id }, data: { status: flags.status, completedAt: flags.status === "Done" ? q.completedAt || new Date() : null } });
          qapFixed++;
        }
      }
      templates.cleanup = { demoSafety: demoSafety.count, demoCubes: demoCubes.count, qapStatusFixed: qapFixed };
      const summary: Record<string, unknown> = { templates: JSON.stringify(templates) };
      for (const [k, v] of Object.entries(out || {})) {
        if (k === "templates") continue;
        if (v == null || typeof v !== "object") summary[k] = v;
        else if (Array.isArray(v)) summary[k] = `${v.length} item(s)`;
        else summary[k] = "loaded";
      }
      loadState = { ...loadState, status: "done", finishedAt: new Date().toISOString(), summary };
    } catch (err) {
      loadState = { ...loadState, status: "failed", finishedAt: new Date().toISOString(), error: err instanceof Error ? err.message : String(err) };
    }
  })();
});

/** Portal mail switch — on only for the listed test mailboxes / domains. */
uatDataRouter.get("/mail", async (_req, res) => {
  const { loadMailSwitch } = await import("../services/mailSwitch.js");
  res.json(await loadMailSwitch());
});
uatDataRouter.put("/mail", async (req: AuthedRequest, res) => {
  const { setMailSwitch } = await import("../services/mailSwitch.js");
  const allow = Array.isArray(req.body?.allow) ? req.body.allow.map(String) : String(req.body?.allow || "").split(/[\s,;]+/);
  try {
    const state = await setMailSwitch({ live: Boolean(req.body?.live), allow }, req.user!.email);
    await audit("uat.mail_switch", { userId: req.user!.id, meta: { live: state.live, allow: state.allow } });
    res.json(state);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Could not save." });
  }
});

/** Sends one proof mail to a listed test mailbox. */
uatDataRouter.post("/mail/test", async (req: AuthedRequest, res) => {
  const { portalMailLive, allowedRecipients } = await import("../services/mailSwitch.js");
  const to = String(req.body?.to || "").trim();
  if (!portalMailLive()) return res.status(400).json({ error: "Mail is switched off." });
  if (!allowedRecipients([to]).length) return res.status(400).json({ error: "That address is not on the test list." });
  const { sendGraphHtmlMail } = await import("../services/graphHtmlMail.js");
  await sendGraphHtmlMail({ to: [to], subject: "[SPDC Portal] UAT mail test", bodyHtml: "<p>This is a UAT test message from the SPDC portal.</p>" });
  res.json({ ok: true });
});

/** ── Simulate working days (UAT) — fills every register as a running site would; removable in one click. ── */
type SimState = { status: "idle" | "running" | "done" | "failed"; projectCode?: string; done: number; total: number; summary: Record<string, number>; error?: string };
let simState: SimState = { status: "idle", done: 0, total: 0, summary: {} };

uatDataRouter.get("/projects", async (_req, res) => {
  res.json(await prisma.project.findMany({ select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }));
});

uatDataRouter.get("/simulate/status", (_req, res) => res.json(simState));

uatDataRouter.post("/simulate", async (req: AuthedRequest, res) => {
  if (simState.status === "running") return res.status(409).json({ error: "A simulation is already running.", state: simState });
  const project = await prisma.project.findUnique({ where: { id: String(req.body?.projectId || "") }, select: { id: true, code: true } });
  if (!project) return res.status(404).json({ error: "Project not found." });
  if (String(req.body?.confirm || "").trim().toUpperCase() !== project.code.toUpperCase()) {
    return res.status(400).json({ error: `Type the project code ${project.code} to confirm.` });
  }
  const days = Math.min(30, Math.max(1, Math.round(Number(req.body?.days) || 1)));
  simState = { status: "running", projectCode: project.code, done: 0, total: days, summary: {} };
  await audit("uat.simulate", { userId: req.user!.id, meta: { project: project.code, days } });
  res.status(202).json(simState);
  void (async () => {
    try {
      const { simulateDay, simDayKey } = await import("../services/simulateDay.js");
      const today = new Date();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
        if (d.getDay() === 0) {
          simState.done += 1; // Sunday: site closed
          continue;
        }
        const out = await simulateDay({ projectId: project.id, dateKey: simDayKey(d), userId: req.user!.id, today });
        for (const [k, v] of Object.entries(out)) simState.summary[k] = (simState.summary[k] || 0) + v;
        simState.done += 1;
      }
      simState.status = "done";
    } catch (err) {
      simState.status = "failed";
      simState.error = err instanceof Error ? err.message : String(err);
    }
  })();
});

uatDataRouter.post("/simulate/remove", async (req: AuthedRequest, res) => {
  const project = await prisma.project.findUnique({ where: { id: String(req.body?.projectId || "") }, select: { id: true, code: true } });
  if (!project) return res.status(404).json({ error: "Project not found." });
  if (String(req.body?.confirm || "").trim().toUpperCase() !== project.code.toUpperCase()) {
    return res.status(400).json({ error: `Type the project code ${project.code} to confirm.` });
  }
  const { removeSimulation } = await import("../services/simulateDay.js");
  const out = await removeSimulation(project.id);
  await audit("uat.simulate_remove", { userId: req.user!.id, meta: { project: project.code, ...out } });
  res.json({ ok: true, removed: out });
});

/** What the clean-up would touch: every project except Arvind, and test-looking logins. Nothing is changed here. */
uatDataRouter.get("/cleanup-preview", async (req: AuthedRequest, res) => {
  const projects = await prisma.project.findMany({
    where: { code: { notIn: KEEP_CODES } },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      createdAt: true,
      _count: { select: { drawings: true, rfis: true, members: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const users = await prisma.user.findMany({
    where: { isActive: true, NOT: { id: req.user!.id } },
    select: { id: true, email: true, fullName: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  // Logins on the Arvind projects are the UAT parties — never offered for switch-off.
  const arvindMembers = await prisma.projectMember.findMany({
    where: { project: { code: { in: KEEP_CODES } } },
    select: { userId: true },
  });
  const keepIds = new Set(arvindMembers.map((m) => m.userId));
  res.json({
    keep: KEEP_CODES,
    projects,
    testLogins: users.filter((u) => TEST_EMAIL.test(u.email) && !keepIds.has(u.id) && u.email !== "office@sharnam.demo"),
  });
});

/** Deactivate test logins (reversible — they can be re-activated under Users). */
uatDataRouter.post("/deactivate-logins", async (req: AuthedRequest, res) => {
  const ids: string[] = Array.isArray(req.body?.userIds) ? req.body.userIds.map(String) : [];
  if (String(req.body?.confirm || "") !== "DEACTIVATE") return res.status(400).json({ error: 'Type DEACTIVATE to confirm.' });
  const targets = await prisma.user.findMany({ where: { id: { in: ids }, NOT: { id: req.user!.id } }, select: { id: true, email: true } });
  const keepIds = new Set(
    (await prisma.projectMember.findMany({ where: { project: { code: { in: KEEP_CODES } } }, select: { userId: true } })).map((m) => m.userId),
  );
  const safe = targets.filter((u) => TEST_EMAIL.test(u.email) && !keepIds.has(u.id) && u.email !== "office@sharnam.demo");
  await prisma.user.updateMany({ where: { id: { in: safe.map((u) => u.id) } }, data: { isActive: false } });
  await audit("uat.deactivate_logins", { userId: req.user!.id, meta: { emails: safe.map((u) => u.email) } });
  res.json({ ok: true, deactivated: safe.length, skipped: ids.length - safe.length });
});
