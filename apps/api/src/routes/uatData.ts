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

/** Clean-up keeps the Voltamp project(s) once they exist; until then it keeps the two Arvind UAT projects. */
async function cleanupKeepCodes(): Promise<string[]> {
  const volt = await prisma.project.findMany({
    where: { OR: [{ code: { contains: "VOLTAMP" } }, { name: { contains: "Voltamp" } }] },
    select: { code: true },
  });
  return volt.length ? volt.map((p) => p.code) : KEEP_CODES;
}
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

/** Which environment is this? Commit, database (host + name only — never credentials), live row counts, storage and mail state. */
uatDataRouter.get("/environment", async (_req, res) => {
  let commit = "local";
  try {
    const fs = await import("fs");
    const path = await import("path");
    commit = fs.readFileSync(path.resolve(process.cwd(), ".deploy-revision"), "utf8").trim().slice(0, 7) || "local";
  } catch {
    /* local run */
  }
  let host = "";
  let name = "";
  try {
    const u = new URL(process.env.DATABASE_URL || "");
    host = u.hostname.length > 10 ? `${u.hostname.slice(0, 4)}…${u.hostname.slice(-6)}` : u.hostname;
    name = u.pathname.replace(/^\//, "");
  } catch {
    /* no mysql url */
  }
  const [users, activeUsers, projects, candidates, offers, employees] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.project.count(),
    prisma.candidate.count(),
    prisma.offer.count(),
    prisma.employeeProfile.count(),
  ]);
  const { graphConfig } = await import("../services/graph.js");
  const { mailSwitchState } = await import("../services/mailSwitch.js");
  const cfg = graphConfig();
  res.json({
    commit,
    nodeEnv: process.env.NODE_ENV || "",
    database: { host, name },
    counts: { users, activeUsers, projects, candidates, offers, employees },
    sharePoint: { live: cfg.configured && !cfg.mock, site: process.env.SHAREPOINT_SITE_URL || process.env.GRAPH_SHAREPOINT_SITE_URL || "" },
    mail: mailSwitchState(),
    serverTime: new Date().toISOString(),
  });
});

/** ── Clean logins: keep Voltamp project members, admins, protected SPDC accounts and you; remove the rest (soft-delete, same as HRMS). ── */
async function loginCleanupPlan(selfId: string) {
  const { isKeptPortalEmail } = await import("../services/keepPortalUsers.js");
  const volt = await prisma.project.findMany({
    where: { OR: [{ code: { contains: "VOLTAMP" } }, { name: { contains: "Voltamp" } }] },
    select: { id: true, code: true },
  });
  const members = volt.length
    ? await prisma.projectMember.findMany({ where: { projectId: { in: volt.map((p) => p.id) } }, select: { userId: true } })
    : [];
  const voltIds = new Set(members.map((m) => m.userId));
  const users = await prisma.user.findMany({
    where: { isActive: true, NOT: { email: { startsWith: "deleted." } } },
    select: { id: true, email: true, fullName: true, role: true, vendorId: true },
    orderBy: { fullName: "asc" },
  });
  const ids = users.map((u) => u.id);
  const profiles = await prisma.employeeProfile.findMany({ where: { userId: { in: ids } }, select: { userId: true, empCode: true, ctcAnnual: true, designation: true } });
  const slips = await prisma.payslip.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _count: { _all: true } });
  const profileBy = new Map(profiles.map((p) => [p.userId, p]));
  const slipBy = new Map(slips.map((x) => [x.userId, x._count._all]));
  const keep: { id: string; email: string; fullName: string; role: string; why: string }[] = [];
  const hr: typeof keep = [];
  const other: typeof keep = [];
  for (const u of users) {
    const row = { id: u.id, email: u.email, fullName: u.fullName, role: u.role, why: "" };
    if (u.id === selfId) keep.push({ ...row, why: "you" });
    else if (u.role === "admin") keep.push({ ...row, why: "admin" });
    else if (isKeptPortalEmail(u.email)) keep.push({ ...row, why: "protected SPDC / UAT account" });
    else if (voltIds.has(u.id)) keep.push({ ...row, why: "Voltamp project member" });
    else {
      const prof = profileBy.get(u.id);
      const slipCount = slipBy.get(u.id) || 0;
      if (slipCount > 0 || prof?.ctcAnnual) hr.push({ ...row, why: `HR record${slipCount ? `, ${slipCount} payslip(s)` : ""}${prof?.designation ? ` · ${prof.designation}` : ""}` });
      else other.push({ ...row, why: u.vendorId ? "client / vendor / consultant login" : "no HR record" });
    }
  }
  return { voltamp: volt.map((p) => p.code), keep, hr, other };
}

uatDataRouter.get("/logins-cleanup-preview", async (req: AuthedRequest, res) => {
  res.json(await loginCleanupPlan(req.user!.id));
});

uatDataRouter.post("/logins-cleanup", async (req: AuthedRequest, res) => {
  if (String(req.body?.confirm || "") !== "REMOVE") return res.status(400).json({ error: "Type REMOVE to confirm." });
  const wanted = new Set<string>(Array.isArray(req.body?.userIds) ? req.body.userIds.map(String) : []);
  const plan = await loginCleanupPlan(req.user!.id);
  // Only people the plan classes as removable — kept accounts can never be named here.
  const targets = [...plan.hr, ...plan.other].filter((u) => wanted.has(u.id));
  let removed = 0;
  for (const u of targets) {
    await prisma.projectMember.deleteMany({ where: { userId: u.id } });
    await prisma.employeeProfile.deleteMany({ where: { userId: u.id } });
    await prisma.user.update({
      where: { id: u.id },
      data: {
        isActive: false,
        email: `deleted.${Date.now()}.${u.email.replace("@", "_at_")}`.slice(0, 180),
        fullName: `[Removed] ${u.fullName}`.slice(0, 200),
      },
    });
    removed++;
  }
  await audit("uat.logins_cleanup", { userId: req.user!.id, meta: { removed, kept: plan.keep.length } });
  res.json({ ok: true, removed, kept: plan.keep.length });
});

/** ── Find any login by e-mail and, if needed, bring it back (switch on, drop "[Removed]", set role / password). ── */
const STAFF_ROLES = ["admin", "office", "hr", "site_employee"];
const RESTORE_ROLES = ["site_employee", "employee", "hr", "office", "client", "vendor"];

uatDataRouter.get("/user", async (req, res) => {
  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "Enter an e-mail address." });
  const user = await prisma.user.findFirst({
    where: { email },
    include: { memberships: { include: { project: { select: { code: true } } } } },
  });
  if (!user) return res.json({ found: false, email });
  const { isHiddenPortalListUser } = await import("../services/keepPortalUsers.js");
  const reasons: string[] = [];
  if (!user.isActive) reasons.push("The login is switched off, so Access and the staff pickers skip it.");
  if (user.fullName.startsWith("[Removed]")) reasons.push('The name starts with "[Removed]" — an earlier clean-up marked it removed.');
  if (user.email.startsWith("deleted.")) reasons.push('The address starts with "deleted." — it was soft-deleted.');
  if (isHiddenPortalListUser(user.email)) reasons.push("It is a seeded demo login, hidden on purpose.");
  if (!STAFF_ROLES.includes(user.role) && !(user.role === "employee" && !user.vendorId)) {
    reasons.push(`Role "${user.role}" is not a staff role, so it is not on the HRMS Users page — it lists under Office → Access (client / vendor / consultant logins).`);
  }
  res.json({
    found: true,
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    portal: user.portal,
    isActive: user.isActive,
    vendorId: user.vendorId,
    projects: user.memberships.map((m) => m.project.code),
    hiddenBecause: reasons,
  });
});

uatDataRouter.post("/user/restore", async (req: AuthedRequest, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const user = email ? await prisma.user.findFirst({ where: { email } }) : null;
  if (!user) return res.status(404).json({ error: "No login with that e-mail." });
  const role = req.body?.role ? String(req.body.role) : "";
  if (role && !RESTORE_ROLES.includes(role)) return res.status(400).json({ error: `Role must be one of: ${RESTORE_ROLES.join(", ")}.` });
  if (role && user.role === "admin") return res.status(400).json({ error: "An admin login's role is not changed here." });
  const password = String(req.body?.password || "");
  if (password && password.length < 8) return res.status(400).json({ error: "Password needs at least 8 characters." });
  const data: Record<string, unknown> = { isActive: true };
  if (user.fullName.startsWith("[Removed]")) data.fullName = user.fullName.replace(/^\[Removed\]\s*/, "") || user.email;
  if (req.body?.fullName) data.fullName = String(req.body.fullName).trim().slice(0, 200);
  if (role) {
    const { portalForRole } = await import("@sharnam/shared");
    data.role = role;
    data.portal = portalForRole(role as never);
    // Staff roles are not tied to a client / vendor organisation.
    if (["site_employee", "hr", "office"].includes(role)) data.vendorId = null;
  }
  if (password) data.passwordHash = await (await import("bcryptjs")).hash(password, 10);
  const updated = await prisma.user.update({ where: { id: user.id }, data });
  await audit("uat.user_restore", { userId: req.user!.id, meta: { email, role: role || undefined, passwordSet: Boolean(password) } });
  res.json({ ok: true, email: updated.email, fullName: updated.fullName, role: updated.role, isActive: updated.isActive });
});

/** What the clean-up would touch: every project except Arvind, and test-looking logins. Nothing is changed here. */
uatDataRouter.get("/cleanup-preview", async (req: AuthedRequest, res) => {
  const keepCodes = await cleanupKeepCodes();
  const projects = await prisma.project.findMany({
    where: { code: { notIn: keepCodes } },
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
    where: { project: { code: { in: keepCodes } } },
    select: { userId: true },
  });
  const keepIds = new Set(arvindMembers.map((m) => m.userId));
  res.json({
    keep: keepCodes,
    projects,
    testLogins: users.filter((u) => TEST_EMAIL.test(u.email) && !keepIds.has(u.id) && u.email !== "office@sharnam.demo"),
  });
});

/** Deactivate test logins (reversible — they can be re-activated under Users). */
uatDataRouter.post("/deactivate-logins", async (req: AuthedRequest, res) => {
  const keepCodes = await cleanupKeepCodes();
  const ids: string[] = Array.isArray(req.body?.userIds) ? req.body.userIds.map(String) : [];
  if (String(req.body?.confirm || "") !== "DEACTIVATE") return res.status(400).json({ error: 'Type DEACTIVATE to confirm.' });
  const targets = await prisma.user.findMany({ where: { id: { in: ids }, NOT: { id: req.user!.id } }, select: { id: true, email: true } });
  const keepIds = new Set(
    (await prisma.projectMember.findMany({ where: { project: { code: { in: keepCodes } } }, select: { userId: true } })).map((m) => m.userId),
  );
  const safe = targets.filter((u) => TEST_EMAIL.test(u.email) && !keepIds.has(u.id) && u.email !== "office@sharnam.demo");
  await prisma.user.updateMany({ where: { id: { in: safe.map((u) => u.id) } }, data: { isActive: false } });
  await audit("uat.deactivate_logins", { userId: req.user!.id, meta: { emails: safe.map((u) => u.email) } });
  res.json({ ok: true, deactivated: safe.length, skipped: ids.length - safe.length });
});
