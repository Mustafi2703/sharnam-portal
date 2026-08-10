/**
 * Site Test Uploads — pilot flow for photo · PDF · drawing · signature uploads.
 * Everything lands in SharePoint (or mock OneDrive when MOCK_ONEDRIVE=true).
 */
import { Router } from "express";
import multer from "multer";
import { prisma } from "../prisma.js";
import { requireAuth, type AuthedRequest } from "../auth.js";
import { audit } from "../services/audit.js";
import { mockOneDrive } from "../services/mockOneDrive.js";
import { graphConfig } from "../services/graph.js";

export const siteTestRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
siteTestRouter.use(requireAuth);

const DEFAULT_FOLDER = "07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records/UploadLab";

/** GET /api/site-test/status — quick Graph / mock mode for the upload lab UI */
siteTestRouter.get("/status", async (_req, res) => {
  const cfg = graphConfig();
  res.json({
    mockOneDrive: cfg.mock,
    graphConfigured: cfg.configured,
    siteUrl: cfg.siteUrl || null,
    mailbox: cfg.mailbox || null,
  });
});

/** GET /api/site-test/:projectId/list?folder=... */
siteTestRouter.get("/:projectId/list", async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (!project) return res.status(404).json({ error: "project not found" });
  const folder = String(req.query.folder || DEFAULT_FOLDER);
  const items = await mockOneDrive.listChildrenLive(project.code, folder);
  res.json({ projectCode: project.code, folder, items });
});

/**
 * POST /api/site-test/:projectId/upload
 * multipart: photos, signature, documents (PDF), drawings (PDF/DWG)
 */
siteTestRouter.post(
  "/:projectId/upload",
  upload.fields([
    { name: "photos", maxCount: 12 },
    { name: "signature", maxCount: 1 },
    { name: "documents", maxCount: 8 },
    { name: "drawings", maxCount: 8 },
  ]),
  async (req: AuthedRequest, res) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
    if (!project) return res.status(404).json({ error: "project not found" });

    const files = (req.files || {}) as Record<string, Express.Multer.File[]>;
    const photos = files.photos || [];
    const signatures = files.signature || [];
    const documents = files.documents || [];
    const drawings = files.drawings || [];
    const note = String(req.body.note || "").slice(0, 4000);
    const location = String(req.body.location || "").slice(0, 200);
    const folder = String(req.body.folder || DEFAULT_FOLDER);

    if (!photos.length && !signatures.length && !documents.length && !drawings.length && !note && !location) {
      return res.status(400).json({ error: "attach a photo, PDF, drawing, signature, or note" });
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const person = (req.user!.fullName || req.user!.email || "party").replace(/[^a-zA-Z0-9._-]/g, "_");
    const uploaded: Record<string, unknown>[] = [];
    let provider = graphConfig().mock ? "mock-onedrive" : "sharepoint";

    for (const [i, p] of photos.entries()) {
      const name = `photo-${person}-${stamp}-${i + 1}${extOf(p) || ".jpg"}`;
      const saved = await mockOneDrive.upload(project.code, folder, name, p.buffer);
      if (saved.provider) provider = saved.provider;
      uploaded.push({ kind: "photo", ...saved });
    }
    for (const s of signatures) {
      const name = `signature-${person}-${stamp}${extOf(s) || ".png"}`;
      const saved = await mockOneDrive.upload(project.code, folder, name, s.buffer);
      if (saved.provider) provider = saved.provider;
      uploaded.push({ kind: "signature", ...saved });
    }
    for (const [i, d] of documents.entries()) {
      const name = `document-${person}-${stamp}-${i + 1}${extOf(d) || ".pdf"}`;
      const saved = await mockOneDrive.upload(project.code, folder, name, d.buffer);
      if (saved.provider) provider = saved.provider;
      uploaded.push({ kind: "document", mime: d.mimetype, ...saved });
    }
    for (const [i, d] of drawings.entries()) {
      const name = `drawing-${person}-${stamp}-${i + 1}${extOf(d) || ".pdf"}`;
      const drawFolder = `${folder}/Drawings`;
      const saved = await mockOneDrive.upload(project.code, drawFolder, name, d.buffer);
      if (saved.provider) provider = saved.provider;
      uploaded.push({ kind: "drawing", mime: d.mimetype, ...saved });
    }
    if (note || location) {
      const text = `Upload lab capture\nProject: ${project.code}\nBy: ${req.user!.fullName || req.user!.email}\nWhen: ${new Date().toISOString()}\nLocation: ${location}\n\nNote:\n${note}\n`;
      const saved = await mockOneDrive.upload(project.code, folder, `note-${person}-${stamp}.txt`, Buffer.from(text, "utf8"));
      if (saved.provider) provider = saved.provider;
      uploaded.push({ kind: "note", ...saved });
    }

    await audit("site.test.upload", {
      userId: req.user!.id,
      entity: "Project",
      entityId: project.id,
      meta: {
        folder,
        photos: photos.length,
        documents: documents.length,
        drawings: drawings.length,
        signatures: signatures.length,
        provider,
      },
    });

    res.json({
      ok: true,
      projectCode: project.code,
      folder,
      provider,
      items: uploaded,
    });
  }
);

function extOf(f: Express.Multer.File): string {
  const m = /\.([a-zA-Z0-9]{2,5})$/.exec(f.originalname || "");
  if (m) return `.${m[1].toLowerCase()}`;
  if (f.mimetype === "image/png") return ".png";
  if (f.mimetype === "image/jpeg" || f.mimetype === "image/jpg") return ".jpg";
  if (f.mimetype === "image/webp") return ".webp";
  if (f.mimetype === "image/gif") return ".gif";
  if (f.mimetype === "application/pdf") return ".pdf";
  if (f.mimetype === "application/acad" || f.mimetype === "image/vnd.dwg") return ".dwg";
  return "";
}
