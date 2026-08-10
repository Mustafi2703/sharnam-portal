import { Router } from "express";
import multer from "multer";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { audit } from "../services/audit.js";
import { graphConfig, probeSharePoint, listDriveChildren, graphFetch, ensureProjectSharePointTree, uploadToProjectLibrary, listProjectLibrary } from "../services/graph.js";

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