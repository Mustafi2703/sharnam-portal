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
