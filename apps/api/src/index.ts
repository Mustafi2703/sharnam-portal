import "./setupExpress.js";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();
import { authRouter, rolesRouter, usersRouter } from "./routes/auth.js";
import { projectsRouter, dmsRouter, drawingsRouter } from "./routes/projects.js";
import { checklistRouter } from "./routes/checklist.js";
import { diaryRouter } from "./routes/diary.js";
import { commsRouter } from "./routes/comms.js";
import { costRouter } from "./routes/cost.js";
import { reportsRouter, auditRouter, crmRouter, hrmRouter } from "./routes/reports.js";
import { vendorsRouter, rfiRouter, inspectionsRouter, directoryRouter, safetyRouter } from "./routes/procore.js";
import { progressRouter } from "./routes/progress.js";
import { graphRouter } from "./routes/graph.js";
import { siteTestRouter } from "./routes/siteTest.js";
import { financeRouter } from "./routes/finance.js";
import { customSheetsRouter } from "./routes/customSheets.js";
import { crmComparativeRouter } from "./routes/crmComparative.js";
import { hrmRecruitmentRouter } from "./routes/hrmRecruitment.js";
import { dprMakerRouter } from "./routes/dprMaker.js";
import { wprMakerRouter } from "./routes/wprMaker.js";
import { closureRouter } from "./routes/closure.js";
import { auditKpiRouter } from "./routes/auditKpi.js";
import { siteIndexRouter } from "./routes/siteIndex.js";
import { ensureDbConnected, isPrismaFatal, prisma } from "./prisma.js";
import { errorDetail, pushRuntimeLog } from "./services/runtimeLog.js";
import { audit } from "./services/audit.js";

const app = express();
const PORT = Number(process.env.PORT || 4000);
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const webDistCandidates = [
  path.resolve(__dirname, "../../web/dist"),
  path.resolve(process.cwd(), "apps/web/dist"),
  path.resolve(process.cwd(), "web/dist"),
];
const webDist = webDistCandidates.find((p) => fs.existsSync(path.join(p, "index.html"))) || null;

app.use(
  cors({
    origin: process.env.WEB_ORIGIN?.split(",") || true,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use("/uploads", express.static(UPLOAD_DIR));

app.use((req, res, next) => {
  if (!req.path.startsWith("/api")) return next();
  res.on("finish", () => {
    const status = res.statusCode;
    const pathOnly = String(req.originalUrl || req.path).split("?")[0];
    if (pathOnly === "/api/health" || pathOnly === "/api/health/sharepoint") return;
    const isHrm = pathOnly.startsWith("/api/hrm");
    const shouldLog = status >= 500 || (isHrm && status >= 400);
    if (!shouldLog) return;
    const authed = req as express.Request & { user?: { id?: string; email?: string } };
    pushRuntimeLog({
      level: status >= 500 ? "error" : "warn",
      source: isHrm ? "hrm.http" : "http",
      message: `${req.method} ${pathOnly} → ${status}`,
      status,
      method: req.method,
      path: pathOnly,
      userId: authed.user?.id,
      userEmail: authed.user?.email,
    });
    if (status >= 500) {
      void audit("runtime.error", {
        userId: authed.user?.id,
        entity: "Http",
        entityId: pathOnly.slice(0, 80),
        meta: { method: req.method, status, path: pathOnly, email: authed.user?.email },
      });
    }
  });
  next();
});

app.get("/api/health", async (_req, res) => {
  const graphConfigured = Boolean(
    (process.env.AZURE_TENANT_ID || process.env.GRAPH_TENANT_ID) &&
      (process.env.AZURE_CLIENT_ID || process.env.GRAPH_CLIENT_ID) &&
      (process.env.AZURE_CLIENT_SECRET || process.env.GRAPH_CLIENT_SECRET)
  );
  let dbOk = false;
  let dbError: string | null = null;
  let userCount: number | null = null;
  let momSchemaOk = false;
  try {
    userCount = await prisma.user.count();
    dbOk = true;
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }
  if (dbOk) {
    try {
      const momCols = await prisma.$queryRaw<{ Field: string }[]>`SHOW COLUMNS FROM Meeting LIKE 'momFileUrl'`;
      momSchemaOk = Array.isArray(momCols) && momCols.length > 0;
    } catch {
      momSchemaOk = false;
    }
  }
  let deployCommit =
    process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || process.env.SOURCE_VERSION || "";
  if (!deployCommit) {
    try {
      deployCommit = fs.readFileSync(path.resolve(process.cwd(), ".deploy-revision"), "utf8").trim();
    } catch {
      deployCommit = "local";
    }
  }
  res.json({
    ok: true,
    service: "sharnam-api",
    dbOk,
    dbError,
    userCount,
    momSchemaOk,
    databaseUrlSet: Boolean(process.env.DATABASE_URL?.startsWith("mysql://")),
    mockOneDrive: process.env.MOCK_ONEDRIVE !== "false",
    graphConfigured,
    sharePointSiteUrlSet: Boolean(
      (process.env.SHAREPOINT_SITE_URL || process.env.GRAPH_SHAREPOINT_SITE_URL || "").trim()
    ),
    mailFromSet: Boolean((process.env.GRAPH_MAIL_FROM || process.env.GRAPH_SHARED_MAILBOX || "").trim()),
    graphMailEnabled:
      graphConfigured &&
      Boolean((process.env.GRAPH_MAIL_FROM || process.env.GRAPH_SHARED_MAILBOX || "").trim()) &&
      process.env.GRAPH_MAIL_ENABLED !== "false",
    timezone: "Asia/Kolkata",
    time: new Date().toISOString(),
    commit: deployCommit || "local",
    webDist,
    ui: "ui-2 Graphite Procore",
  });
});

app.get("/api/health/sharepoint", async (_req, res) => {
  try {
    const { probeSharePoint } = await import("./services/graph.js");
    const health = await probeSharePoint();
    res.json(health);
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/roles", rolesRouter);
app.use("/api/users", usersRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/dms", dmsRouter);
app.use("/api/drawings", drawingsRouter);
app.use("/api/checklist", checklistRouter);
app.use("/api/diary", diaryRouter);
app.use("/api/comms", commsRouter);
app.use("/api/cost", costRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/audit", auditRouter);
app.use("/api/crm", crmComparativeRouter);
app.use("/api/crm", crmRouter);
app.use("/api/hrm", hrmRouter);
app.use("/api/vendors", vendorsRouter);
app.use("/api/rfis", rfiRouter);
app.use("/api/inspections", inspectionsRouter);
app.use("/api/directory", directoryRouter);
app.use("/api/safety", safetyRouter);
app.use("/api/progress", progressRouter);
app.use("/api/graph", graphRouter);
app.use("/api/site-test", siteTestRouter);
app.use("/api/finance", financeRouter);
app.use("/api/custom-sheets", customSheetsRouter);
app.use("/api/hrm", hrmRecruitmentRouter);
app.use("/api/dpr-maker", dprMakerRouter);
app.use("/api/wpr-maker", wprMakerRouter);
app.use("/api/closure", closureRouter);
app.use("/api/audit-kpi", auditKpiRouter);
app.use("/api/master/site-index", siteIndexRouter);

// Serve built React app AFTER API routes (single-service Render deploy)
if (webDist) {
  console.log(`Serving web UI from ${webDist}`);
  app.use(express.static(webDist, { maxAge: 0, etag: true }));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) return next();
    res.sendFile(path.join(webDist, "index.html"));
  });
} else {
  console.warn("Web dist not found. Looked in:", webDistCandidates.join(", "));
}

app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const authed = req as express.Request & { user?: { id?: string; email?: string } };
  pushRuntimeLog({
    level: "error",
    source: "express",
    message: err.message || "Server error",
    status: 500,
    method: req.method,
    path: String(req.originalUrl || req.path).split("?")[0],
    userId: authed.user?.id,
    userEmail: authed.user?.email,
    detail: errorDetail(err),
  });
  if (isPrismaFatal(err)) {
    if (!res.headersSent) {
      res.status(503).json({ error: "Database temporarily unavailable — please retry in a few seconds." });
    }
    setTimeout(() => process.exit(1), 200);
    return;
  }
  if (!res.headersSent) {
    res.status(500).json({ error: err.message || "Server error" });
  }
});

async function start() {
  await ensureDbConnected();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`शरणम् API listening on http://0.0.0.0:${PORT}`);
  });
}

void start().catch((err) => {
  console.error("FATAL: API failed to connect to database:", err);
  process.exit(1);
});
