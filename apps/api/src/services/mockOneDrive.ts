import fs from "fs";
import path from "path";
import { prisma } from "../prisma.js";

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
    const folders = [
      "Drawings",
      "Drawings/Architecture",
      "Drawings/Structural",
      "Drawings/MEP",
      "Drawings/Civil",
      "Documents",
      "Documents/Contracts",
      "Documents/Reports",
      "Documents/DPR",
      "Documents/WPR",
      "Documents/QAP",
      "Documents/Communication-Matrix",
      "Documents/Design-Coordination",
      "Photos",
      "Checklists",
      "Inspections",
      "Inspections/Architecture",
      "Inspections/Structural",
      "Inspections/MEP",
      "Inspections/Civil",
      "RFIs",
      "Submittals",
      "Safety",
      "Cost-Bills",
    ];

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

    return { root: project.code, folders };
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

  async upload(
    projectCode: string,
    relFolder: string,
    fileName: string,
    buffer: Buffer
  ): Promise<{ path: string; url: string }> {
    const dir = path.join(this.projectRoot(projectCode), relFolder);
    ensureDir(dir);
    const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const dest = path.join(dir, safe);
    fs.writeFileSync(dest, buffer);
    const rel = path.join(relFolder, safe).replace(/\\/g, "/");
    return {
      path: rel,
      url: `/uploads/onedrive/${projectCode}/${rel}`,
    };
  }

  getDownloadUrl(projectCode: string, relPath: string) {
    return `/uploads/onedrive/${projectCode}/${relPath}`;
  }

  async sync(projectId: string) {
    return this.ensureProjectTree(projectId);
  }

  /** Mark folder synced when user opens it (Graph delta hook later) */
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
