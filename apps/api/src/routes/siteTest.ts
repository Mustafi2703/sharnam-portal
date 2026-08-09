/**
 * Site Test Uploads — a lightweight endpoint the client can use during pilot
 * to prove the flow: site person signs on-screen, takes a photo (or gallery),
 * fills a short note; everything lands in SharePoint under the project sandbox.
 *
 * Non-destructive: uses uploadToProjectLibrary — never overwrites, never deletes.
 */
import { Router } from "express";
import multer from "multer";
import { prisma } from "../prisma.js";
import { requireAuth, type AuthedRequest } from "../auth.js";
import { audit } from "../services/audit.js";
import { mockOneDrive } from "../services/mockOneDrive.js";

export const siteTestRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
siteTestRouter.use(requireAuth);

/**
 * POST /api/site-test/:projectId/upload
 * multipart:
 *   folder?   default "07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records/SitePilot"
 *   note?     text note that becomes a companion .txt
 *   photos    zero-or-more images
 *   signature single signature image
 *   location? optional site location string
 */
siteTestRouter.post(
  "/:projectId/upload",
  upload.fields([
    { name: "photos", maxCount: 12 },
    { name: "signature", maxCount: 1 },
  ]),
  async (req: AuthedRequest, res) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
    if (!project) return res.status(404).json({ error: "project not found" });

    const files = (req.files || {}) as Record<string, Express.Multer.File[]>;
    const photos = files.photos || [];
    const signatures = files.signature || [];
    const note = String(req.body.note || "").slice(0, 4000);
    const location = String(req.body.location || "").slice(0, 200);
    const folder = String(req.body.folder || "07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records/SitePilot");

    if (!photos.length && !signatures.length && !note && !location) {
      return res.status(400).json({ error: "attach a photo, signature, or note" });
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const person = (req.user!.fullName || req.user!.email || "party").replace(/[^a-zA-Z0-9._-]/g, "_");
    const uploaded: unknown[] = [];

    for (const [i, p] of photos.entries()) {
      const name = `photo-${person}-${stamp}-${i + 1}${extOf(p) || ".jpg"}`;
      const saved = await mockOneDrive.upload(project.code, folder, name, p.buffer);
      uploaded.push({ kind: "photo", ...saved });
    }
    for (const s of signatures) {
      const name = `signature-${person}-${stamp}${extOf(s) || ".png"}`;
      const saved = await mockOneDrive.upload(project.code, folder, name, s.buffer);
      uploaded.push({ kind: "signature", ...saved });
    }
    if (note || location) {
      const text = `Site pilot capture\nProject: ${project.code}\nBy: ${req.user!.fullName || req.user!.email}\nWhen: ${new Date().toISOString()}\nLocation: ${location}\n\nNote:\n${note}\n`;
      const saved = await mockOneDrive.upload(
        project.code,
        folder,
        `note-${person}-${stamp}.txt`,
        Buffer.from(text, "utf8")
      );
      uploaded.push({ kind: "note", ...saved });
    }

    await audit("site.test.upload", {
      userId: req.user!.id,
      entity: "Project",
      entityId: project.id,
      meta: { folder, photos: photos.length, signatures: signatures.length, note: note.length > 0 },
    });

    res.json({
      ok: true,
      projectCode: project.code,
      folder,
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
  return "";
}
