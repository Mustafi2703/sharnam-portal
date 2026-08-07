import { Router } from "express";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { audit } from "../services/audit.js";
import { graphConfig, probeSharePoint, listDriveChildren, graphFetch } from "../services/graph.js";

export const graphRouter = Router();

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
