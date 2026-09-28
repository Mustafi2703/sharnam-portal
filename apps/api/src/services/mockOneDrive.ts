import fs from "fs";
import path from "path";
import { prisma } from "../prisma.js";
import {
  graphConfig,
  ensureProjectSharePointTree,
  uploadToProjectLibrary,
  listProjectLibrary,
  PROJECT_LIBRARY_FOLDERS,
} from "./graph.js";

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function mimeForFileName(fileName: string) {
  return MIME_BY_EXT[path.extname(fileName).toLowerCase()] || "application/octet-stream";
}

export type DriveNode = {
  name: string;
  path: string;
  type: "folder" | "file";
  url?: string;
  size?: number;
  modifiedAt?: string;
};

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function liveSharePoint() {
  const cfg = graphConfig();
  return cfg.configured && !cfg.mock;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
}

export class MockOneDriveService {
  root() {
    ensureDir(UPLOAD_DIR);
    return UPLOAD_DIR;
  }

  projectRoot(projectCode: string) {
    const p = path.join(this.root(), "onedrive", projectCode);
    ensureDir(p);
    return p;
  }

  async ensureProjectTree(projectId: string) {
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    const root = this.projectRoot(project.code);
    const folders = [...PROJECT_LIBRARY_FOLDERS];

    for (const rel of folders) {
      ensureDir(path.join(root, rel));
    }

    const existingFolderRows = await prisma.documentFolder.count({ where: { projectId } });
    const sharePointAlreadyProvisioned = existingFolderRows >= folders.length;

    const syncedAt = new Date();
    await prisma.$transaction(
      folders.map((rel) => {
        const name = rel.split("/").pop()!;
        const parentPath = rel.includes("/") ? rel.split("/").slice(0, -1).join("/") : null;
        return prisma.documentFolder.upsert({
          where: { projectId_path: { projectId, path: rel } },
          create: {
            projectId,
            path: rel,
            name,
            parentPath,
            mockDriveId: `mock-${project.code}-${rel}`,
            lastSyncedAt: syncedAt,
          },
          update: { lastSyncedAt: syncedAt },
        });
      })
    );

    let sharePoint: { rootFolder: string; folders: string[] } | null = null;
    if (liveSharePoint()) {
      try {
        // Always call Graph. Local folder rows can exist from an earlier attempt that never
        // reached SharePoint (for example a rejected folder name). ensureDriveFolder leaves
        // folders that are already there.
        const sp = await withTimeout(ensureProjectSharePointTree(project.code), 90_000, "SharePoint project tree");
        sharePoint = { rootFolder: sp.rootFolder, folders: sp.folders };
      } catch (err) {
        console.warn("[SharePoint] ensureProjectTree failed:", err instanceof Error ? err.message : err);
        if (!sharePointAlreadyProvisioned) throw err;
      }
    }

    return {
      root: project.code,
      folders,
      provider: liveSharePoint() && sharePoint ? ("sharepoint" as const) : ("mock-onedrive" as const),
      sharePoint,
    };
  }

  listChildren(projectCode: string, relPath = ""): DriveNode[] {
    const base = path.join(this.projectRoot(projectCode), relPath);
    if (!fs.existsSync(base)) return [];
    return fs.readdirSync(base).map((name) => {
      const full = path.join(base, name);
      const rel = path.join(relPath, name).replace(/\\/g, "/");
      const isDir = fs.statSync(full).isDirectory();
      const st = fs.statSync(full);
      return {
        name,
        path: rel,
        type: isDir ? "folder" : "file",
        url: isDir ? undefined : `/uploads/onedrive/${projectCode}/${rel}`,
        size: isDir ? undefined : st.size,
        modifiedAt: st.mtime.toISOString(),
      };
    });
  }

  async listChildrenLive(projectCode: string, relPath = ""): Promise<DriveNode[]> {
    if (!liveSharePoint()) return this.listChildren(projectCode, relPath);
    try {
      const listed = await listProjectLibrary(projectCode, relPath);
      const items = (listed.value || []) as {
        name: string;
        folder?: unknown;
        webUrl?: string;
        size?: number;
        lastModifiedDateTime?: string;
      }[];
      const live: DriveNode[] = items.map((i) => ({
        name: i.name,
        path: relPath ? `${relPath}/${i.name}` : i.name,
        type: i.folder ? ("folder" as const) : ("file" as const),
        url: i.folder ? undefined : i.webUrl,
        size: i.size,
        modifiedAt: i.lastModifiedDateTime,
      }));
      const local = this.listChildren(projectCode, relPath);
      if (!local.length) return live;
      const byName = new Map<string, DriveNode>(live.map((n) => [n.name, n]));
      for (const n of local) {
        if (!byName.has(n.name)) byName.set(n.name, n);
      }
      return [...byName.values()];
    } catch {
      return this.listChildren(projectCode, relPath);
    }
  }

  async upload(
    projectCode: string,
    relFolder: string,
    fileName: string,
    buffer: Buffer,
    contentType = "application/octet-stream",
    opts?: { replace?: boolean }
  ): Promise<{
    path: string;
    url: string;
    provider?: string;
    sharePointPath?: string | null;
    sharePointUrl?: string | null;
    sharePointError?: string;
  }> {
    const dir = path.join(this.projectRoot(projectCode), relFolder);
    ensureDir(dir);
    let safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    let dest = path.join(dir, safe);
    if (opts?.replace && fs.existsSync(dest)) {
      fs.unlinkSync(dest);
    } else if (fs.existsSync(dest)) {
      const dot = safe.lastIndexOf(".");
      const base = dot > 0 ? safe.slice(0, dot) : safe;
      const ext = dot > 0 ? safe.slice(dot) : "";
      safe = `${base}-${Date.now()}${ext}`;
      dest = path.join(dir, safe);
    }
    fs.writeFileSync(dest, buffer);
    const rel = path.join(relFolder, safe).replace(/\\/g, "/");
    const local = {
      path: rel,
      url: `/uploads/onedrive/${projectCode}/${rel}`,
      provider: "mock-onedrive" as const,
      sharePointPath: null as string | null,
    };

    const mime = contentType && contentType !== "application/octet-stream" ? contentType : mimeForFileName(safe);
    if (liveSharePoint()) {
      try {
        const sp = await uploadToProjectLibrary(projectCode, relFolder, safe, buffer, mime, {
          replace: opts?.replace,
        });
        return {
          path: sp.path || rel,
          url: local.url,
          provider: "sharepoint",
          sharePointPath: sp.sharePointPath,
          sharePointUrl: sp.url || null,
        };
      } catch (err) {
        const sharePointError = err instanceof Error ? err.message : String(err);
        console.warn("[SharePoint] upload failed, kept local mock:", sharePointError);
        return { ...local, sharePointError };
      }
    }
    return local;
  }

  getDownloadUrl(projectCode: string, relPath: string) {
    return `/uploads/onedrive/${projectCode}/${relPath}`;
  }

  readFile(projectCode: string, relPath: string): Buffer | null {
    const full = path.join(this.projectRoot(projectCode), relPath);
    if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) return null;
    return fs.readFileSync(full);
  }

  async sync(projectId: string) {
    return this.ensureProjectTree(projectId);
  }

  async touchFolder(projectId: string, relPath: string) {
    if (!relPath) return;
    const name = relPath.split("/").pop()!;
    const parentPath = relPath.includes("/") ? relPath.split("/").slice(0, -1).join("/") : null;
    await prisma.documentFolder.upsert({
      where: { projectId_path: { projectId, path: relPath } },
      create: {
        projectId,
        path: relPath,
        name,
        parentPath,
        mockDriveId: `mock-open-${relPath}`,
        lastSyncedAt: new Date(),
      },
      update: { lastSyncedAt: new Date() },
    });
  }
}

export const mockOneDrive = new MockOneDriveService();
