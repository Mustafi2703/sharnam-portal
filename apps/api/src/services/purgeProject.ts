import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

async function ids(rows: Promise<{ id: string }[]>) {
  return (await rows).map((r) => r.id);
}

type PurgeOpts = {
  /** Keep directory, vendors, and communication matrix on the project card. */
  keepSetup?: boolean;
};

/**
 * Remove module transactional rows for a project.
 * When keepSetup is true, members, vendors, and comms matrix stay — only fills/registers go.
 */
async function purgeProjectTransactionalData(tx: Db, projectId: string, opts?: PurgeOpts) {
  const where = { projectId };

  const drawingIds = await ids(tx.drawing.findMany({ where, select: { id: true } }));
  const assignmentIds = await ids(tx.checklistAssignment.findMany({ where, select: { id: true } }));
  const meetingIds = await ids(tx.meeting.findMany({ where, select: { id: true } }));
  const rfiIds = await ids(tx.rfi.findMany({ where, select: { id: true } }));
  const inspectionIds = await ids(tx.qualityInspection.findMany({ where, select: { id: true } }));
  const coordIds = await ids(tx.designCoordinationIssue.findMany({ where, select: { id: true } }));
  const logIds = await ids(tx.dailyLog.findMany({ where, select: { id: true } }));
  const bidIds = await ids(tx.crmBidPackage.findMany({ where, select: { id: true } }));
  const poIds = await ids(tx.purchaseOrder.findMany({ where, select: { id: true } }));
  const raIds = await ids(tx.raBill.findMany({ where, select: { id: true } }));
  const copIds = await ids(tx.certificateOfPayment.findMany({ where, select: { id: true } }));
  const batchIds = await ids(tx.boqImportBatch.findMany({ where, select: { id: true } }));
  const auditIds = await ids(tx.siteAudit.findMany({ where, select: { id: true } }));

  const revIds = drawingIds.length
    ? await ids(tx.drawingRevision.findMany({ where: { drawingId: { in: drawingIds } }, select: { id: true } }))
    : [];
  const submissionIds = assignmentIds.length
    ? await ids(tx.checklistSubmission.findMany({ where: { assignmentId: { in: assignmentIds } }, select: { id: true } }))
    : [];

  if (submissionIds.length) {
    await tx.checklistPhoto.deleteMany({ where: { submissionId: { in: submissionIds } } });
    await tx.checklistSubmission.deleteMany({ where: { id: { in: submissionIds } } });
  }
  const unlink: Prisma.ChecklistSubmissionWhereInput[] = [];
  if (drawingIds.length) unlink.push({ drawingId: { in: drawingIds } });
  if (revIds.length) unlink.push({ revisionId: { in: revIds } });
  if (unlink.length) {
    await tx.checklistSubmission.updateMany({
      where: { OR: unlink },
      data: { drawingId: null, revisionId: null },
    });
  }
  if (revIds.length) {
    await tx.drawingRevisionMarkupPage.deleteMany({ where: { revisionId: { in: revIds } } });
    await tx.drawingRevision.deleteMany({ where: { id: { in: revIds } } });
  }
  if (drawingIds.length) {
    await tx.drawingRegisterLine.updateMany({ where: { drawingId: { in: drawingIds } }, data: { drawingId: null } });
    await tx.drawing.deleteMany({ where });
  }

  if (logIds.length) {
    await tx.dailyLogManpower.deleteMany({ where: { dailyLogId: { in: logIds } } });
    await tx.dailyLogEquipment.deleteMany({ where: { dailyLogId: { in: logIds } } });
    await tx.dailyLogNote.deleteMany({ where: { dailyLogId: { in: logIds } } });
    await tx.dailyLogPhoto.deleteMany({ where: { dailyLogId: { in: logIds } } });
    await tx.dailyLog.deleteMany({ where });
  }
  if (meetingIds.length) {
    await tx.meetingItem.deleteMany({ where: { meetingId: { in: meetingIds } } });
    await tx.meeting.updateMany({ where, data: { parentMeetingId: null } }).catch(() => undefined);
    await tx.meeting.deleteMany({ where });
  }
  if (rfiIds.length) {
    await tx.rfiResponse.deleteMany({ where: { rfiId: { in: rfiIds } } });
    await tx.rfi.deleteMany({ where });
  }
  if (inspectionIds.length) {
    await tx.inspectionItem.deleteMany({ where: { inspectionId: { in: inspectionIds } } });
    await tx.qualityInspection.deleteMany({ where });
  }
  if (coordIds.length) {
    await tx.coordinationIssueDocument.deleteMany({ where: { issueId: { in: coordIds } } });
    await tx.designCoordinationIssue.deleteMany({ where });
  }
  if (bidIds.length) {
    await tx.crmVendorBoq.deleteMany({ where: { bidPackageId: { in: bidIds } } });
    await tx.crmBidPackage.deleteMany({ where: { id: { in: bidIds } } });
  }
  if (batchIds.length) {
    await tx.boqItem.deleteMany({ where: { batchId: { in: batchIds } } });
    await tx.boqImportBatch.deleteMany({ where });
  }
  if (raIds.length) {
    await tx.raBillAttachment.deleteMany({ where: { raBillId: { in: raIds } } });
    await tx.raBillRevision.deleteMany({ where: { raBillId: { in: raIds } } });
    await tx.certificateOfPayment.updateMany({ where: { raBillId: { in: raIds } }, data: { raBillId: null } });
    await tx.raBill.deleteMany({ where });
  }
  if (copIds.length) {
    await tx.copAttachment.deleteMany({ where: { copId: { in: copIds } } });
    await tx.copRevision.deleteMany({ where: { copId: { in: copIds } } });
    await tx.certificateOfPayment.deleteMany({ where });
  }
  if (poIds.length) {
    await tx.purchaseOrder.deleteMany({ where });
  }
  if (auditIds.length) {
    await tx.auditFinding.updateMany({ where: { siteAuditId: { in: auditIds } }, data: { siteAuditId: null } });
    await tx.auditChecklistItem.updateMany({ where: { siteAuditId: { in: auditIds } }, data: { siteAuditId: null } });
    await tx.siteAudit.deleteMany({ where });
  }

  await tx.checklistAssignment.deleteMany({ where });
  await tx.documentFolder.deleteMany({ where });
  if (!opts?.keepSetup) {
    await tx.projectMember.deleteMany({ where });
    await tx.projectVendor.deleteMany({ where });
    await tx.communicationMatrix.deleteMany({ where });
    await tx.communicationContact.deleteMany({ where });
  }
  await tx.communicationLog.deleteMany({ where });
  await tx.costBudgetLine.deleteMany({ where });
  await tx.costMonitoringLine.deleteMany({ where });
  await tx.costCashflowPeriod.deleteMany({ where });
  await tx.costRateDifference.deleteMany({ where });
  await tx.costMbLine.deleteMany({ where });
  await tx.costBbsLine.deleteMany({ where });
  await tx.vendorBill.deleteMany({ where });
  await tx.projectPhoto.deleteMany({ where });
  await tx.submittal.deleteMany({ where });
  await tx.safetyRecord.deleteMany({ where });
  await tx.qapActivity.deleteMany({ where });
  await tx.cubeTest.deleteMany({ where });
  await tx.qualitySiteRecord.deleteMany({ where });
  await tx.qualityNcr.deleteMany({ where });
  await tx.progressMilestone.deleteMany({ where });
  await tx.progressHindrance.deleteMany({ where });
  await tx.progressRisk.deleteMany({ where });
  await tx.progressPlannedActual.deleteMany({ where });
  await tx.progressScurvePoint.deleteMany({ where });
  await tx.progressLegalApproval.deleteMany({ where });
  await tx.progressManpower.deleteMany({ where });
  await tx.progressActivityLine.deleteMany({ where });
  await tx.progressSorStat.deleteMany({ where });
  await tx.progressValueAddition.deleteMany({ where });
  await tx.progressProcurementLine.deleteMany({ where });
  await tx.siteMaterialStock.deleteMany({ where });
  await tx.progressPurchaseRequisition.deleteMany({ where });
  await tx.progressInvoiceTracker.deleteMany({ where });
  await tx.projectCapex.deleteMany({ where });
  await tx.financeMaterialInvoice.deleteMany({ where });
  await tx.drawingRegisterLine.deleteMany({ where });
  await tx.snagItem.deleteMany({ where });
  await tx.lessonLearnt.deleteMany({ where });
  await tx.auditFinding.deleteMany({ where });
  await tx.auditChecklistItem.deleteMany({ where });
  await tx.kpiSubject.deleteMany({ where });
  await tx.kpiRoleKra.deleteMany({ where });
  await tx.projectClosureReport.deleteMany({ where });
  await tx.driveAccessRequest.deleteMany({ where });
  await tx.dprSnapshot.deleteMany({ where });
  await tx.wprSnapshot.deleteMany({ where });
  await tx.customSheet.deleteMany({ where });
  await tx.attendance.deleteMany({ where });
}

/** Clear seeded module fills while keeping the project card, directory, and vendors. */
export async function purgeProjectModuleData(tx: Db, projectId: string) {
  await purgeProjectTransactionalData(tx, projectId, { keepSetup: true });
}

/**
 * Remove every row that blocks Project delete.
 * MySQL often has Restrict FKs even when Prisma says Cascade, so we delete
 * children first instead of relying on ON DELETE CASCADE.
 */
export async function purgeProjectChildren(tx: Db, projectId: string) {
  await purgeProjectTransactionalData(tx, projectId);

  const where = { projectId };
  await tx.lead.updateMany({ where, data: { projectId: null } });
  await tx.deal.updateMany({ where, data: { projectId: null } });
  await tx.quotation.updateMany({ where, data: { projectId: null } });
  await tx.emailOutbox.updateMany({ where, data: { projectId: null } });
  await tx.expenseVoucher.updateMany({ where, data: { projectId: null } });
  await tx.crmBidPackage.updateMany({ where, data: { projectId: null } });

  await clearRemainingProjectFks(tx, projectId);

  try {
    await tx.project.delete({ where: { id: projectId } });
  } catch (err) {
    await forceDeleteProjectRow(tx, projectId);
    const still = await tx.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (still) throw err;
  }
}

function safeIdent(name: string) {
  return /^[A-Za-z0-9_]+$/.test(name) ? name : null;
}

/** Catch leftover MySQL FKs that Prisma Cascade never applied on Hostinger. */
async function clearRemainingProjectFks(tx: Db, projectId: string) {
  const refs = await tx.$queryRaw<Array<{ TABLE_NAME: string; COLUMN_NAME: string; IS_NULLABLE: string }>>`
    SELECT k.TABLE_NAME AS TABLE_NAME, k.COLUMN_NAME AS COLUMN_NAME, c.IS_NULLABLE AS IS_NULLABLE
    FROM information_schema.KEY_COLUMN_USAGE k
    JOIN information_schema.COLUMNS c
      ON c.TABLE_SCHEMA = k.TABLE_SCHEMA
     AND c.TABLE_NAME = k.TABLE_NAME
     AND c.COLUMN_NAME = k.COLUMN_NAME
    WHERE k.TABLE_SCHEMA = DATABASE()
      AND k.REFERENCED_TABLE_NAME = 'Project'
      AND k.REFERENCED_COLUMN_NAME = 'id'
      AND k.TABLE_NAME <> 'Project'
  `;
  for (const ref of refs) {
    const table = safeIdent(ref.TABLE_NAME);
    const column = safeIdent(ref.COLUMN_NAME);
    if (!table || !column) continue;
    if (ref.IS_NULLABLE === "YES") {
      await tx.$executeRawUnsafe(
        `UPDATE \`${table}\` SET \`${column}\` = NULL WHERE \`${column}\` = ?`,
        projectId
      );
    } else {
      await tx.$executeRawUnsafe(`DELETE FROM \`${table}\` WHERE \`${column}\` = ?`, projectId);
    }
  }
}

async function forceDeleteProjectRow(tx: Db, projectId: string) {
  await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");
  try {
    await clearRemainingProjectFks(tx, projectId);
    await tx.$executeRawUnsafe("DELETE FROM `Project` WHERE `id` = ?", projectId);
  } finally {
    await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");
  }
}
