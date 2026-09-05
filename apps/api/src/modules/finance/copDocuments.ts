/**
 * COP document trail — staged uploads (Draft → Certified → Signed → Paid) with SharePoint links.
 * Mirrors RA bill stage logging; used by finance routes and demo seed.
 */
import type { PrismaClient } from "@prisma/client";
import { mockOneDrive } from "../../services/mockOneDrive.js";

export const COP_ISO_ROOT = "09_COMMERCIAL_AND_CHANGE/09.01_Interim_Bill_Verification_Certification";
export const COP_STAGES = ["Draft", "Certified", "Signed", "Paid"] as const;
export type CopStage = (typeof COP_STAGES)[number];

export function copFolder(certificateNumber: string): string {
  const safe = certificateNumber.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${COP_ISO_ROOT}/COP-${safe}`;
}

export async function saveCopFile(
  projectCode: string,
  certificateNumber: string,
  fileName: string,
  buffer: Buffer
) {
  const saved = await mockOneDrive.upload(projectCode, copFolder(certificateNumber), fileName, buffer);
  const fileUrl = saved.url || `/uploads/onedrive/${projectCode}/${saved.path}`;
  return { ...saved, fileUrl, fileName };
}

export async function logCopStageFile(
  db: Pick<PrismaClient, "copRevision" | "copAttachment" | "certificateOfPayment">,
  opts: {
    copId: string;
    stage: CopStage | string;
    fileName: string;
    fileUrl: string;
    storagePath?: string | null;
    sharePointUrl?: string | null;
    uploadedById: string;
    kind?: string;
    notes?: string | null;
  }
) {
  const revisionNo =
    (await db.copRevision.count({ where: { copId: opts.copId, stage: opts.stage } })) + 1;

  await db.copRevision.create({
    data: {
      copId: opts.copId,
      stage: opts.stage,
      revisionNo,
      fileName: opts.fileName,
      fileUrl: opts.fileUrl,
      storagePath: opts.storagePath || null,
      sharePointUrl: opts.sharePointUrl || null,
      notes: opts.notes || null,
      uploadedById: opts.uploadedById,
    },
  });

  await db.copAttachment.create({
    data: {
      copId: opts.copId,
      fileName: opts.fileName,
      fileUrl: opts.fileUrl,
      storagePath: opts.storagePath || null,
      sharePointUrl: opts.sharePointUrl || null,
      kind: opts.kind || "stage",
      notes: opts.notes || null,
      uploadedById: opts.uploadedById,
    },
  });

  await db.certificateOfPayment.update({
    where: { id: opts.copId },
    data: { attachmentUrl: opts.fileUrl },
  });
}

export async function loadCopDocumentTrail(
  db: Pick<
    PrismaClient,
    "certificateOfPayment" | "copRevision" | "copAttachment" | "raBillRevision"
  >,
  copId: string
) {
  const cop = await db.certificateOfPayment.findUnique({
    where: { id: copId },
    select: {
      id: true,
      certificateNumber: true,
      status: true,
      attachmentUrl: true,
      raBillId: true,
      raBill: { select: { id: true, raNumber: true } },
    },
  });
  if (!cop) return null;

  const [copRevisions, copAttachments, raRevisions] = await Promise.all([
    db.copRevision.findMany({ where: { copId }, orderBy: [{ uploadedAt: "desc" }] }),
    db.copAttachment.findMany({ where: { copId }, orderBy: [{ uploadedAt: "desc" }] }),
    cop.raBillId
      ? db.raBillRevision.findMany({
          where: { raBillId: cop.raBillId },
          orderBy: [{ uploadedAt: "desc" }],
        })
      : Promise.resolve([]),
  ]);

  return { cop, copRevisions, copAttachments, raRevisions };
}
