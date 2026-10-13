import fs from "node:fs";
import path from "node:path";
import { prisma } from "../prisma.js";
import { mockOneDrive } from "./mockOneDrive.js";

/**
 * Client logo for co-branding (Sharnam + client on every generated sheet / form).
 *
 * The logo is uploaded once per project (`POST /api/projects/:id/client-logo`) into `00_PROJECT_BRANDING/` — the upload
 * keeps a local copy next to the SharePoint one, so exports read it from disk. When the local copy is missing (new
 * server, logo uploaded elsewhere) it is pulled from SharePoint once and cached.
 */

const CACHE_TTL_MS = 5 * 60_000;
const cache = new Map<string, { at: number; file: string | null }>();

function newestLogoIn(dir: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^client-logo.*\.(png|jpe?g)$/i.test(f))
    .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  return files.length ? path.join(dir, files[0].f) : null;
}

/** Local file path of the project's client logo, or null when the project has none. */
export async function clientLogoPathForProject(projectId: string | null | undefined): Promise<string | null> {
  if (!projectId) return null;
  const hit = cache.get(projectId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.file;
  let file: string | null = null;
  try {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { code: true, clientLogoUrl: true } });
    if (project?.code && project.clientLogoUrl) {
      const dir = path.join(mockOneDrive.projectRoot(project.code), "00_PROJECT_BRANDING");
      file = newestLogoIn(dir);
      if (!file) {
        // Pull the SharePoint copy once and cache it locally.
        const ext = /\.jpe?g(\?|$)/i.test(project.clientLogoUrl) ? "jpg" : "png";
        try {
          const { downloadDriveFile } = await import("./graph.js");
          const buf = await downloadDriveFile(`${project.code}/00_PROJECT_BRANDING/client-logo.${ext}`);
          fs.mkdirSync(dir, { recursive: true });
          file = path.join(dir, `client-logo.${ext}`);
          fs.writeFileSync(file, buf);
        } catch {
          file = null;
        }
      }
    }
  } catch {
    file = null;
  }
  cache.set(projectId, { at: Date.now(), file });
  return file;
}

/** Same as {@link clientLogoPathForProject} but by project code (exports that only carry the code). */
export async function clientLogoPathForProjectCode(code: string | null | undefined): Promise<string | null> {
  if (!code) return null;
  const project = await prisma.project.findFirst({ where: { code }, select: { id: true } });
  return clientLogoPathForProject(project?.id);
}

export function clientLogoDataUri(file: string | null): string {
  if (!file) return "";
  try {
    const ext = /\.jpe?g$/i.test(file) ? "jpeg" : "png";
    return `data:image/${ext};base64,${fs.readFileSync(file).toString("base64")}`;
  } catch {
    return "";
  }
}

export function invalidateClientLogo(projectId: string) {
  cache.delete(projectId);
}

/**
 * Project id for a request URL, used by the global workbook branding pass: `/project/:id/`, `/projects/:id/`,
 * or a module route whose first segment after the module is the project id (`/api/cost/:projectId/...`).
 */
export async function projectIdFromRequestPath(urlPath: string): Promise<string | null> {
  const clean = urlPath.split("?")[0];
  const named = clean.match(/\/projects?\/([a-z0-9]{20,})/i);
  const candidates = named ? [named[1]] : [];
  for (const seg of clean.split("/")) if (/^[a-z0-9]{24,32}$/i.test(seg) && !candidates.includes(seg)) candidates.push(seg);
  for (const id of candidates) {
    const hit = cache.get(id);
    if (hit) return id;
    const exists = await prisma.project.findUnique({ where: { id }, select: { id: true } }).catch(() => null);
    if (exists) return id;
  }
  return null;
}
