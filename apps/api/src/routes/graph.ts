import { Router } from "express";
import multer from "multer";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { fileURLToPath } from "url";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { audit } from "../services/audit.js";
import { graphConfig, probeSharePoint, listDriveChildren, graphFetch, ensureProjectSharePointTree, uploadToProjectLibrary, listProjectLibrary } from "../services/graph.js";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

async function runRepoScript(scriptRel: string, args: string[] = []) {
  const { stdout, stderr } = await execFileAsync("npx", ["tsx", scriptRel, ...args], {
    cwd: repoRoot,
    env: process.env,
    timeout: 300_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

export const graphRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

graphRouter.get("/status", requireAuth, async (_req, res) => {
  const health = await probeSharePoint();
  res.json(health);
});

/** Admin/office — live SharePoint fetch test (site + default library root) */
graphRouter.post("/test-sharepoint", requireAuth, requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const health = await probeSharePoint();
  if (!health.tokenOk || !health.siteOk || !health.driveId) {
    return res.status(502).json({ ok: false, health });
  }

  let children: unknown[] = [];
  try {
    const listed = await listDriveChildren(health.driveId);
    children = listed.value || [];
  } catch (err) {
    return res.status(502).json({
      ok: false,
      health,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  await audit("graph.test.sharepoint", {
    userId: req.user!.id,
    meta: { siteId: health.siteId, driveId: health.driveId, count: children.length },
  });

  res.json({
    ok: true,
    health,
    items: children.slice(0, 25),
  });
});

/** Admin — optional mail probe (does not send unless body.to provided) */
graphRouter.post("/test-mail", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
  const cfg = graphConfig();
  if (!cfg.configured || !cfg.mailbox) {
    return res.status(400).json({ error: "Graph or GRAPH_MAIL_FROM not configured" });
  }

  const to = typeof req.body?.to === "string" ? req.body.to.trim() : "";
  if (!to) {
    // Dry check: resolve mailbox user
    try {
      const user = await graphFetch<{ id: string; mail?: string; userPrincipalName?: string }>(
        `/users/${encodeURIComponent(cfg.mailbox)}?$select=id,mail,userPrincipalName,displayName`
      );
      return res.json({ ok: true, dryRun: true, mailbox: user });
    } catch (err) {
      return res.status(502).json({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        hint: "Confirm shared mailbox exists and Mail.Send / User.Read.All (or equivalent) is consented",
      });
    }
  }

  try {
    await graphFetch(`/users/${encodeURIComponent(cfg.mailbox)}/sendMail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject: "Sharnam Portal — Graph mail test",
          body: {
            contentType: "Text",
            content: "This is a test message from the Sharnam portal Microsoft Graph integration.",
          },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: true,
      }),
    });
    await audit("graph.test.mail", { userId: req.user!.id, meta: { to, from: cfg.mailbox } });
    res.json({ ok: true, sent: true, from: cfg.mailbox, to });
  } catch (err) {
    res.status(502).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

/** Admin — seed live UAT team + comms matrix, meetings, NCR/CAR, RFI, QAP on SPDC-DEMO-01 */
graphRouter.post("/seed-live-team", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
  try {
    const { seedSpdcLiveTeam } = await import("../services/spdcLiveTeamSeed.js");
    const result = await seedSpdcLiveTeam();
    await audit("graph.seed.live.team", {
      userId: req.user!.id,
      meta: { projectCode: result.project.code, users: Object.keys(result.userIds).length },
    });
    res.json({
      ok: true,
      project: { id: result.project.id, code: result.project.code },
      users: Object.keys(result.userIds),
      password: result.password,
      meeting: result.meeting?.title,
      rfi: result.rfi?.number,
      notify: result.notify,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

/** Admin — create SPDC-UAT-LIVE with DPR week, WPR, finance COP + SharePoint upload */
graphRouter.post("/seed-uat-live-project", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
  try {
    const { seedUatLiveProject } = await import("../services/uatDemoProjectSeed.js");
    const uploadCops = req.body?.uploadCops !== false;
    const result = await seedUatLiveProject(undefined, { uploadCops });
    await audit("graph.seed.uat.live", { userId: req.user!.id, meta: { projectCode: result.project.code } });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

/** Admin — send 15-email comms UAT pack via Graph (preview = baibhab only, all = full team) */
graphRouter.post("/send-comms-uat-pack", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
  const mode = String(req.body?.mode || "preview").trim().toLowerCase();
  if (!["preview", "all", "team"].includes(mode)) {
    return res.status(400).json({ error: "mode must be preview, all, or team" });
  }
  try {
    const { stdout, stderr } = await runRepoScript("apps/api/scripts/send-comms-flow-demo-pack.ts", [mode]);
    await audit("graph.send.comms.uat", { userId: req.user!.id, meta: { mode } });
    res.json({ ok: true, mode, stdout, stderr: stderr || undefined });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stdout = typeof err === "object" && err && "stdout" in err ? String((err as { stdout: Buffer }).stdout) : "";
    res.status(502).json({ ok: false, error: msg, stdout: stdout.slice(0, 2000) || undefined });
  }
});

graphRouter.get("/config", requireAuth, requireRoles("admin", "office"), (_req, res) => {
  const cfg = graphConfig();
  res.json({
    configured: cfg.configured,
    mockOneDrive: cfg.mock,
    siteUrl: cfg.siteUrl || null,
    mailbox: cfg.mailbox || null,
    tenantConfigured: Boolean(cfg.tenantId),
    clientConfigured: Boolean(cfg.clientId),
    secretConfigured: Boolean(cfg.clientSecret),
    projectOnline: false,
  });
});

/** Admin/office — create Sharnam Portal/{projectCode} library tree on SharePoint */
graphRouter.post(
  "/ensure-project-tree",
  requireAuth,
  requireRoles("admin", "office"),
  async (req: AuthedRequest, res) => {
    const projectCode = String(req.body?.projectCode || "SPDC-DEMO-01").trim();
    if (!projectCode) return res.status(400).json({ error: "projectCode required" });
    try {
      const result = await ensureProjectSharePointTree(projectCode);
      await audit("graph.ensure.project.tree", {
        userId: req.user!.id,
        meta: { projectCode, rootFolder: result.rootFolder, count: result.folders.length },
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(502).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
);

/** Admin/office — multipart file upload straight to project SharePoint sandbox */
graphRouter.post(
  "/upload-file",
  requireAuth,
  requireRoles("admin", "office"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "file required" });
    const projectCode = String(req.body?.projectCode || "SPDC-DEMO-01").trim();
    const folder = String(req.body?.folder || "07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records/UploadLab").trim();
    const fileName = String(req.body?.fileName || file.originalname || `upload-${Date.now()}`).trim();
    try {
      const saved = await uploadToProjectLibrary(projectCode, folder, fileName, file.buffer, file.mimetype || "application/octet-stream");
      await audit("graph.upload.file", {
        userId: req.user!.id,
        meta: { projectCode, folder, fileName: saved.path, provider: "sharepoint" },
      });
      res.json({ ok: true, saved });
    } catch (err) {
      res.status(502).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
);

/** Admin/office — upload a test doc into RFIs / Documents/DPR / Documents/WPR */
graphRouter.post(
  "/test-upload",
  requireAuth,
  requireRoles("admin", "office"),
  async (req: AuthedRequest, res) => {
    const projectCode = String(req.body?.projectCode || "SPDC-DEMO-01").trim();
    const folder = String(req.body?.folder || "RFIs").trim();
    const fileName = String(req.body?.fileName || `test-${Date.now()}.txt`).trim();
    const content = String(req.body?.content || `Sharnam portal SharePoint test · ${new Date().toISOString()}\n`);
    try {
      const saved = await uploadToProjectLibrary(projectCode, folder, fileName, Buffer.from(content, "utf8"), "text/plain");
      const listed = await listProjectLibrary(projectCode, folder);
      await audit("graph.test.upload", {
        userId: req.user!.id,
        meta: { projectCode, folder, fileName: saved.path },
      });
      res.json({ ok: true, saved, folderItems: listed.value?.slice(0, 20) || [] });
    } catch (err) {
      res.status(502).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
);