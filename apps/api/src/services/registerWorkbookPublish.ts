/**
 * Publish QAP / Cube register workbooks to ISO SharePoint folders (source of truth).
 */
import { prisma } from "../prisma.js";
import { mockOneDrive } from "./mockOneDrive.js";
import { MODULE_TO_ISO_FOLDER } from "./graph.js";
import { audit } from "./audit.js";

export type PublishResult = {
  fileName: string;
  path: string;
  url: string;
  sharePointUrl?: string | null;
  provider?: string;
};

export async function publishRegisterWorkbook(opts: {
  projectId: string;
  userId: string;
  moduleKey: keyof typeof MODULE_TO_ISO_FOLDER;
  fileName: string;
  buffer: Buffer;
  auditAction: string;
  auditMeta?: Record<string, unknown>;
}): Promise<PublishResult> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: opts.projectId } });
  const folder = MODULE_TO_ISO_FOLDER[opts.moduleKey];
  const saved = await mockOneDrive.upload(project.code, folder, opts.fileName, opts.buffer);

  await audit(opts.auditAction, {
    userId: opts.userId,
    entity: "Project",
    entityId: project.id,
    meta: {
      fileName: opts.fileName,
      folder,
      path: saved.path,
      provider: saved.provider,
      sharePointUrl: saved.sharePointUrl,
      ...opts.auditMeta,
    },
  });

  return {
    fileName: opts.fileName,
    path: saved.path,
    url: saved.sharePointUrl || saved.url,
    sharePointUrl: saved.sharePointUrl,
    provider: saved.provider,
  };
}

/** Write QAP (Week 50 layout), cube register, and Quality Dashboard to the ISO folders. */
export async function publishQualityPackToDrive(projectId: string, userId: string, weekLabel?: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const published: PublishResult[] = [];

  try {
    const { exportQapWorkbook } = await import("./qapImportExport.js");
    const { buffer, weekLabel: wl } = await exportQapWorkbook(projectId, weekLabel);
    published.push(
      await publishRegisterWorkbook({
        projectId,
        userId,
        moduleKey: "qap",
        fileName: `Quality-Assurance-Plan-${project.code}-${wl.replace(/\s+/g, "-")}.xlsx`,
        buffer,
        auditAction: "qap.published",
        auditMeta: { weekLabel: wl, format: "Week 50" },
      })
    );
  } catch (err) {
    console.warn("[drive] QAP publish skipped:", err instanceof Error ? err.message : err);
  }

  try {
    const { exportCubeWorkbook } = await import("./cubeRegisterImport.js");
    const { buffer, rowCount } = await exportCubeWorkbook(projectId);
    published.push(
      await publishRegisterWorkbook({
        projectId,
        userId,
        moduleKey: "cube",
        fileName: `SPDC-Cube-Register-${project.code}.xlsx`,
        buffer,
        auditAction: "cube.published",
        auditMeta: { rowCount },
      })
    );
  } catch (err) {
    console.warn("[drive] Cube publish skipped:", err instanceof Error ? err.message : err);
  }

  try {
    const { findWorkbook } = await import("../lib/excelRoot.js");
    const dash = findWorkbook(["Quality Dashboard (1).xlsx", "Quality Dashboard.xlsx"]);
    if (dash) {
      const fs = await import("fs");
      published.push(
        await publishRegisterWorkbook({
          projectId,
          userId,
          moduleKey: "qap",
          fileName: `Quality-Dashboard-${project.code}.xlsx`,
          buffer: fs.readFileSync(dash),
          auditAction: "quality.dashboard.published",
        })
      );
    }
  } catch (err) {
    console.warn("[drive] Quality dashboard publish skipped:", err instanceof Error ? err.message : err);
  }

  return published;
}
