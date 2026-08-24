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
  moduleKey: "qap" | "cube";
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
