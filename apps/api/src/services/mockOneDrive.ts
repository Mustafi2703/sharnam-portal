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

export type DriveNode = {
  name: string;
  path: string;
  type: "folder" | "file";
  url?: string;
};

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function liveSharePoint() {
  const cfg = graphConfig();
  return cfg.configured && !cfg.mock;
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
      const abs = path.join(root, rel);
      ensureDir(abs);
      const name = rel.split("/").pop()!;
      const parentPath = rel.includes("/") ? rel.split("/").slice(0, -1).join("/") : null;
      await prisma.documentFolder.upsert({
        where: { projectId_path: { projectId, path: rel } },
        create: {
          projectId,
          path: rel,
          name,
          parentPath,
          mockDriveId: `mock-${project.code}-${rel}`,
          lastSyncedAt: new Date(),
        },
        update: { lastSyncedAt: new Date() },
      });
    }

    let sharePoint: { rootFolder: string; folders: string[] } | null = null;
    if (liveSharePoint()) {
      try {
        const sp = await ensureProjectSharePointTree(project.code);
        sharePoint = { rootFolder: sp.rootFolder, folders: sp.folders };
      } catch (err) {
        console.warn("[SharePoint] ensureProjectTree failed:", err instanceof Error ? err.message : err);
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
      return {
        name,
        path: rel,
        type: isDir ? "folder" : "file",
        url: isDir ? undefined : `/uploads/onedrive/${projectCode}/${rel}`,
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
      }[];
      return items.map((i) => ({
        name: i.name,
        path: relPath ? `${relPath}/${i.name}` : i.name,
        type: i.folder ? ("folder" as const) : ("file" as const),
        url: i.folder ? undefined : i.webUrl,
      }));
    } catch {
      return this.listChildren(projectCode, relPath);
    }
  }

  async upload(
    projectCode: string,
    relFolder: string,
    fileName: string,
    buffer: Buffer
  ): Promise<{ path: string; url: string; provider?: string; sharePointPath?: string | null }> {
    const dir = path.join(this.projectRoot(projectCode), relFolder);
    ensureDir(dir);
    const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const dest = path.join(dir, safe);
    fs.writeFileSync(dest, buffer);
    const rel = path.join(relFolder, safe).replace(/\\/g, "/");
    const local = {
      path: rel,
      url: `/uploads/onedrive/${projectCode}/${rel}`,
      provider: "mock-onedrive" as const,
      sharePointPath: null as string | null,
    };

    if (liveSharePoint()) {
      try {
        const sp = await uploadToProjectLibrary(projectCode, relFolder, fileName, buffer);
        return {
          path: sp.path || rel,
          url: sp.url || local.url,
          provider: "sharepoint",
          sharePointPath: sp.sharePointPath,
        };
      } catch (err) {
        console.warn("[SharePoint] upload failed, kept local mock:", err instanceof Error ? err.message : err);
      }
    }
    return local;
  }

  getDownloadUrl(projectCode: string, relPath: string) {
    return `/uploads/onedrive/${projectCode}/${relPath}`;
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
