import type { PrismaClient } from "@prisma/client";

const FILL_KINDS = new Set([
  "DrawingChecklist",
  "QualityInspection",
  "SafetyChecklist",
  "QualityIR",
  "SafetyIR",
  "ActivityInspection",
  "SiteExecution",
  "RequestForInformation",
]);

export function isChecklistFillRfiKind(kind?: string | null) {
  return Boolean(kind && FILL_KINDS.has(kind));
}

/** When an RFI / request-fill is raised, drop a Draft row on the fill log for the assignee. */
export async function ensureFillRequestDraft(
  db: PrismaClient,
  opts: {
    rfiId: string;
    rfiNumber: string;
    subject: string;
    assignmentId: string | null | undefined;
    createdById: string;
    assignedToId?: string | null;
    drawingId?: string | null;
  }
) {
  if (!opts.assignmentId) return null;

  const existing = await db.checklistSubmission.findFirst({
    where: {
      assignmentId: opts.assignmentId,
      status: "Draft",
      OR: [{ remarks: { contains: opts.rfiNumber } }, { remarks: { contains: opts.rfiId } }],
    },
  });
  if (existing) return existing;

  let drawingId = opts.drawingId || null;
  let revisionId: string | null = null;
  let revisionNumber: string | null = null;
  if (drawingId) {
    const drawing = await db.drawing.findUnique({
      where: { id: drawingId },
      include: { revisions: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (drawing) {
      revisionId = drawing.revisions[0]?.id || null;
      revisionNumber = drawing.revisions[0]?.revisionNumber || drawing.currentRev || null;
    } else {
      drawingId = null;
    }
  }

  return db.checklistSubmission.create({
    data: {
      assignmentId: opts.assignmentId,
      submittedById: opts.assignedToId || opts.createdById,
      status: "Draft",
      purpose: "Fill",
      drawingId,
      revisionId,
      revisionNumber,
      remarks: `Requested via ${opts.rfiNumber}: ${opts.subject}`,
      responsesJson: JSON.stringify({
        _meta: {
          rfiId: opts.rfiId,
          rfiNumber: opts.rfiNumber,
          assignedToId: opts.assignedToId || null,
        },
      }),
    },
  });
}

export function rfiMetaFromResponses(responsesJson?: string | null) {
  try {
    const parsed = JSON.parse(responsesJson || "{}") as { _meta?: { rfiId?: string; rfiNumber?: string } };
    return {
      rfiId: parsed._meta?.rfiId || null,
      rfiNumber: parsed._meta?.rfiNumber || null,
    };
  } catch {
    return { rfiId: null, rfiNumber: null };
  }
}
