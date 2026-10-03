/**
 * Publish QAP / Cube / Quality Dashboard workbooks to ISO SharePoint folders.
 * Live files are replaced; a Weekly/{week} copy is kept like drawings.
 */
import { prisma } from "../prisma.js";
import { mockOneDrive } from "./mockOneDrive.js";
import { MODULE_TO_ISO_FOLDER } from "./graph.js";
import { audit } from "./audit.js";
import { drawingRegisterWeekStamp } from "./drawingRegisterDrive.js";

export type PublishResult = {
  fileName: string;
  path: string;
  url: string;
  sharePointUrl?: string | null;
  provider?: string;
  weekFolder?: string;
};

async function uploadLiveAndWeekly(opts: {
  projectCode: string;
  liveFolder: string;
  weekFolder: string;
  fileName: string;
  buffer: Buffer;
}): Promise<{ livePath: string; weekPath: string; url: string; sharePointUrl?: string | null; provider?: string }> {
  const live = await mockOneDrive.upload(opts.projectCode, opts.liveFolder, opts.fileName, opts.buffer, undefined, {
    replace: true,
  });
  await mockOneDrive.upload(opts.projectCode, opts.weekFolder, opts.fileName, opts.buffer, undefined, {
    replace: true,
  });
  return {
    livePath: live.path,
    weekPath: `${opts.weekFolder}/${opts.fileName}`,
    url: live.sharePointUrl || live.url,
    sharePointUrl: live.sharePointUrl,
    provider: live.provider,
  };
}

export async function publishRegisterWorkbook(opts: {
  projectId: string;
  userId: string;
  moduleKey: keyof typeof MODULE_TO_ISO_FOLDER;
  fileName: string;
  buffer: Buffer;
  auditAction: string;
  auditMeta?: Record<string, unknown>;
  weekCopy?: boolean;
}): Promise<PublishResult> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: opts.projectId } });
  const folder = MODULE_TO_ISO_FOLDER[opts.moduleKey];
  const week = drawingRegisterWeekStamp();
  const weekFolder = `${folder}/Weekly/${week}`;

  const saved =
    opts.weekCopy === false
      ? await mockOneDrive.upload(project.code, folder, opts.fileName, opts.buffer, undefined, { replace: true }).then((s) => ({
          livePath: s.path,
          weekPath: "",
          url: s.sharePointUrl || s.url,
          sharePointUrl: s.sharePointUrl,
          provider: s.provider,
        }))
      : await uploadLiveAndWeekly({
          projectCode: project.code,
          liveFolder: folder,
          weekFolder,
          fileName: opts.fileName,
          buffer: opts.buffer,
        });

  await audit(opts.auditAction, {
    userId: opts.userId,
    entity: "Project",
    entityId: project.id,
    meta: {
      fileName: opts.fileName,
      folder,
      path: saved.livePath,
      weekPath: saved.weekPath || null,
      provider: saved.provider,
      sharePointUrl: saved.sharePointUrl,
      ...opts.auditMeta,
    },
  });

  return {
    fileName: opts.fileName,
    path: saved.livePath,
    url: saved.url,
    sharePointUrl: saved.sharePointUrl,
    provider: saved.provider,
    weekFolder: saved.weekPath ? weekFolder : undefined,
  };
}

/** Write QAP (Week 50), cube register, Quality Dashboard (+ CAR from DB), and weekly copies. */
export async function publishQualityPackToDrive(projectId: string, userId: string, weekLabel?: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const published: PublishResult[] = [];
  const week = drawingRegisterWeekStamp();

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
        auditMeta: { weekLabel: wl, format: "Week 50", week },
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
        auditMeta: { rowCount, week },
      })
    );
  } catch (err) {
    console.warn("[drive] Cube publish skipped:", err instanceof Error ? err.message : err);
  }

  try {
    const { exportQualityDashboardWorkbook } = await import("./qualityDashboardExport.js");
    const { buffer } = await exportQualityDashboardWorkbook(projectId);
    published.push(
      await publishRegisterWorkbook({
        projectId,
        userId,
        moduleKey: "qap",
        fileName: `Quality-Dashboard-${project.code}.xlsx`,
        buffer,
        auditAction: "quality.dashboard.published",
        auditMeta: { week, fromDb: true },
      })
    );
  } catch (err) {
    console.warn("[drive] Quality dashboard publish skipped:", err instanceof Error ? err.message : err);
  }

  try {
    const { syncAllQualityNcrsForProject } = await import("./syncNcrToDrive.js");
    await syncAllQualityNcrsForProject(projectId);
  } catch (err) {
    console.warn("[drive] NCR sync skipped:", err instanceof Error ? err.message : err);
  }

  return published;
}

/** Ensure QAP / cube / quality dashboard workbooks exist in ISO 08 folders (idempotent). */
export async function ensureQualityIsoLinked(projectId: string, userId: string, weekLabel?: string) {
  await mockOneDrive.ensureProjectTree(projectId);
  return publishQualityPackToDrive(projectId, userId, weekLabel);
}

/** Archive an uploaded client workbook to the ISO drive (source file, not a generated export). */
export async function archiveUploadedWorkbook(opts: {
  projectId: string;
  userId: string;
  moduleKey: keyof typeof MODULE_TO_ISO_FOLDER;
  originalName: string;
  buffer: Buffer;
  auditAction: string;
}): Promise<PublishResult | null> {
  try {
    const stamp = new Date().toISOString().slice(0, 10);
    const safe = opts.originalName.replace(/[^\w.\- ()]+/g, "_") || "workbook.xlsx";
    return await publishRegisterWorkbook({
      projectId: opts.projectId,
      userId: opts.userId,
      moduleKey: opts.moduleKey,
      fileName: `${stamp}-${safe}`,
      buffer: opts.buffer,
      auditAction: opts.auditAction,
      auditMeta: { originalName: opts.originalName, archived: true },
      weekCopy: false,
    });
  } catch (err) {
    console.warn("[drive] archive skipped:", err instanceof Error ? err.message : err);
    return null;
  }
}
