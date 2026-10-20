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
 *
 * Every path returned here has an extension that matches its bytes (`.png` or `.jpg`): callers pick the image type
 * from the file name.
 */

export type LogoExt = "png" | "jpeg";

const CACHE_TTL_MS = 5 * 60_000;
/** Logo URL set but no copy found (Graph down, file still uploading) — retry soon. */
const MISS_TTL_MS = 30_000;
const cache = new Map<string, { at: number; ttl: number; file: string | null }>();

const BRANDING_FOLDER = "00_PROJECT_BRANDING";

/** PNG / JPEG from the first bytes; null for anything else (WebP, SVG, HTML sign-in pages…). */
export function sniffLogoExt(buf: Buffer | null | undefined): LogoExt | null {
  if (!buf || buf.length < 4) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  return null;
}

/** Pixel size from the PNG IHDR or the first JPEG SOFn marker. */
export function imagePixelSize(buf: Buffer): { width: number; height: number } | null {
  const ext = sniffLogoExt(buf);
  if (ext === "png") {
    if (buf.length < 24) return null;
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (ext === "jpeg") {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = buf[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      const len = buf.readUInt16BE(i + 2);
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
      i += 2 + len;
    }
  }
  return null;
}

const fileExtFor = (ext: LogoExt) => (ext === "png" ? "png" : "jpg");

function readIf(file: string): Buffer | null {
  try {
    return fs.statSync(file).isFile() ? fs.readFileSync(file) : null;
  } catch {
    return null;
  }
}

/** `file` when its name matches its bytes; otherwise a correctly named copy beside it; null when not PNG/JPEG. */
function typedLogoFile(file: string): string | null {
  const buf = readIf(file);
  const ext = sniffLogoExt(buf);
  if (!buf || !ext) return null;
  const want = fileExtFor(ext);
  const have = path.extname(file).slice(1).toLowerCase();
  if (have === want || (ext === "jpeg" && have === "jpeg")) return file;
  const fixed = path.join(path.dirname(file), `${path.basename(file, path.extname(file))}.${want}`);
  if (!fs.existsSync(fixed)) fs.writeFileSync(fixed, buf);
  return fixed;
}

function newestLogoIn(dir: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^client-logo.*\.(png|jpe?g)$/i.test(f))
    .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const { f } of files) {
    const typed = typedLogoFile(path.join(dir, f));
    if (typed) return typed;
  }
  return null;
}

function saveLogo(dir: string, base: string, buf: Buffer, ext: LogoExt): string {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${base}.${fileExtFor(ext)}`);
  const prior = readIf(file);
  if (!prior || !prior.equals(buf)) fs.writeFileSync(file, buf);
  return file;
}

/** Local copy referenced by a `/uploads/onedrive/...` URL (kept inside the upload root). */
function localUploadFile(url: string): string | null {
  const idx = url.indexOf("/uploads/onedrive/");
  if (idx < 0) return null;
  const rel = decodeURIComponent(url.slice(idx + "/uploads/".length).split(/[?#]/)[0]);
  const root = path.resolve(mockOneDrive.root());
  const file = path.resolve(root, rel);
  if (!file.startsWith(root + path.sep)) return null;
  return typedLogoFile(file);
}

/** Drive-relative `Sharnam Portal/...` path inside a SharePoint web URL, if it has one. */
function drivePathFromWebUrl(url: string): string | null {
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const decoded = decodeURIComponent(new URL(url).pathname);
    const idx = decoded.indexOf("/Sharnam Portal/");
    if (idx < 0) return null;
    const rel = decoded.slice(idx + 1);
    return /\.(png|jpe?g)$/i.test(rel) ? rel : null;
  } catch {
    return null;
  }
}

async function graphLogo(code: string, url: string): Promise<{ buf: Buffer; ext: LogoExt } | null> {
  const { downloadDriveFile, graphConfig, legacyProjectLibraryPath, projectLibraryPath } = await import("./graph.js");
  const cfg = graphConfig();
  if (!cfg.configured || cfg.mock) return null;
  const names = ["client-logo.png", "client-logo.jpg", "client-logo.jpeg"].map((n) => `${BRANDING_FOLDER}/${n}`);
  const candidates = [
    drivePathFromWebUrl(url),
    ...names.map((n) => projectLibraryPath(code, n)),
    ...names.map((n) => legacyProjectLibraryPath(code, n)),
  ].filter((p, i, all): p is string => Boolean(p) && all.indexOf(p) === i);
  for (const itemPath of candidates) {
    try {
      const buf = await downloadDriveFile(itemPath);
      const ext = sniffLogoExt(buf);
      if (ext) return { buf, ext };
    } catch {
      /* try next path */
    }
  }
  return null;
}

async function resolveLogo(code: string, rawUrl: string): Promise<string | null> {
  const url = rawUrl.trim();
  const dir = path.join(mockOneDrive.projectRoot(code), BRANDING_FOLDER);
  const inline = url.match(/^data:image\/[a-z+.-]+;base64,(.+)$/i);
  if (inline) {
    const buf = Buffer.from(inline[1], "base64");
    const ext = sniffLogoExt(buf);
    return ext ? saveLogo(dir, "client-logo-inline", buf, ext) : null;
  }
  const local = localUploadFile(url) || newestLogoIn(dir);
  if (local) return local;
  const remote = await graphLogo(code, url);
  return remote ? saveLogo(dir, "client-logo", remote.buf, remote.ext) : null;
}

/** Local file path of the project's client logo (PNG or JPEG, named to match), or null when the project has none. */
export async function clientLogoPathForProject(projectId: string | null | undefined): Promise<string | null> {
  if (!projectId) return null;
  const hit = cache.get(projectId);
  if (hit && Date.now() - hit.at < hit.ttl && (!hit.file || fs.existsSync(hit.file))) return hit.file;
  let file: string | null = null;
  let ttl = CACHE_TTL_MS;
  try {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { code: true, clientLogoUrl: true } });
    if (project?.code && project.clientLogoUrl?.trim()) {
      file = await resolveLogo(project.code, project.clientLogoUrl);
      if (!file) ttl = MISS_TTL_MS;
    }
  } catch {
    file = null;
    ttl = MISS_TTL_MS;
  }
  cache.set(projectId, { at: Date.now(), ttl, file });
  return file;
}

/** Client logo bytes for a project, with the type read from the bytes. */
export async function clientLogoForProject(
  projectId: string | null | undefined,
): Promise<{ buffer: Buffer; ext: LogoExt; file: string } | null> {
  const file = await clientLogoPathForProject(projectId);
  if (!file) return null;
  const buffer = readIf(file);
  const ext = sniffLogoExt(buffer);
  if (!buffer || !ext) {
    if (projectId) cache.delete(projectId);
    return null;
  }
  return { buffer, ext, file };
}

/** Same as {@link clientLogoPathForProject} but by project code (exports that only carry the code). */
export async function clientLogoPathForProjectCode(code: string | null | undefined): Promise<string | null> {
  if (!code) return null;
  const project = await prisma.project.findFirst({ where: { code }, select: { id: true } });
  return clientLogoPathForProject(project?.id);
}

export function clientLogoDataUri(file: string | null): string {
  if (!file) return "";
  const buf = readIf(file);
  const ext = sniffLogoExt(buf);
  return buf && ext ? `data:image/${ext};base64,${buf.toString("base64")}` : "";
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
