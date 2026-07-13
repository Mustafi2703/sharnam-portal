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
import { vendorsRouter, rfiRouter, inspectionsRouter, directoryRouter } from "./routes/procore.js";

const app = express();
const PORT = Number(process.env.PORT || 4000);
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(
  cors({
    origin: process.env.WEB_ORIGIN?.split(",") || true,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use("/uploads", express.static(UPLOAD_DIR));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "sharnam-api",
    mockOneDrive: process.env.MOCK_ONEDRIVE !== "false",
    time: new Date().toISOString(),
  });
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
app.use("/api/crm", crmRouter);
app.use("/api/hrm", hrmRouter);
app.use("/api/vendors", vendorsRouter);
app.use("/api/rfis", rfiRouter);
app.use("/api/inspections", inspectionsRouter);
app.use("/api/directory", directoryRouter);

// Serve built React app (single-service Render deploy)
const webDist = path.resolve(__dirname, "../../web/dist");
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) return next();
    res.sendFile(path.join(webDist, "index.html"));
  });
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Server error" });
});

app.listen(PORT, () => {
  console.log(`शरणम् API listening on http://localhost:${PORT}`);
});
