import fs from "fs";
import path from "path";
import { prisma } from "../prisma.js";
import { CRM_OFFICE_LIBRARY, CRM_SHAREPOINT, createProjectProposalFile } from "./crmSharePoint.js";
import { mockOneDrive } from "./mockOneDrive.js";
import { proposalDocxFilename, resolveProposalDocxPath } from "./proposalTemplate.js";

const SENT = "Sent to client";

export type ProposalFile = Awaited<ReturnType<typeof createProjectProposalFile>>;

export function resolveProposalDiskPath(attachmentUrl: string | null | undefined) {
  if (!attachmentUrl) return null;
  const marker = "/uploads/onedrive/";
  const idx = attachmentUrl.indexOf(marker);
  if (idx < 0) return null;
  const rel = attachmentUrl.slice(idx + marker.length);
  const slash = rel.indexOf("/");
  if (slash < 0) return null;
  const projectCode = rel.slice(0, slash);
  const rest = rel.slice(slash + 1);
  const abs = path.join(mockOneDrive.projectRoot(projectCode), rest);
  if (fs.existsSync(abs)) return abs;
  const office = path.join(mockOneDrive.projectRoot(CRM_OFFICE_LIBRARY), rest);
  return fs.existsSync(office) ? office : null;
}

function bufferForNextRevision(currentUrl: string | null | undefined) {
  const stored = resolveProposalDiskPath(currentUrl);
  if (stored) return fs.readFileSync(stored);
  return fs.readFileSync(resolveProposalDocxPath());
}

export async function ensureProposalRevisionTrail(quotationId: string) {
  const q = await prisma.quotation.findUnique({ where: { id: quotationId } });
  if (!q) return null;
  const existing = await prisma.quotationRevision.count({ where: { quotationId } });
  if (existing) {
    return prisma.quotation.findUnique({
      where: { id: quotationId },
      include: quotationInclude(),
    });
  }
  await prisma.quotationRevision.create({
    data: {
      quotationId,
      revisionNo: q.currentRevisionNo || 0,
      stage: q.status?.toLowerCase().includes("sent") ? SENT : q.status || "Draft",
      fileName: proposalDocxFilename(q.quotationNo, q.clientName, q.currentRevisionNo || 0),
      fileUrl: q.attachmentUrl,
      sharePointUrl: q.attachmentSharePointUrl,
      uploadedById: q.createdById,
    },
  });
  return prisma.quotation.findUnique({
    where: { id: quotationId },
    include: quotationInclude(),
  });
}

export function quotationInclude() {
  return {
    lead: true,
    project: { select: { id: true, code: true, name: true } },
    revisions: { orderBy: { revisionNo: "desc" as const } },
  };
}

export async function createVersionedProposal(opts: {
  projectId?: string | null;
  projectCode?: string | null;
  clientName: string;
  quotationNo: string;
  userId: string;
  clientAddress?: string | null;
  clientGst?: string | null;
  scopeSummary?: string | null;
  totalValue?: number;
  currency?: string;
  validityDays?: number;
  quotationDate?: Date;
  leadId?: string | null;
}) {
  const library = opts.projectCode || CRM_OFFICE_LIBRARY;
  mockOneDrive.projectRoot(library);
  const file = await createProjectProposalFile(library, opts.clientName, opts.quotationNo, 0);
  const row = await prisma.quotation.create({
    data: {
      quotationNo: opts.quotationNo,
      clientName: opts.clientName,
      clientAddress: opts.clientAddress ?? null,
      clientGst: opts.clientGst ?? null,
      scopeSummary: opts.scopeSummary ?? `PMC proposal for ${opts.clientName}`,
      totalValue: opts.totalValue ?? 0,
      currency: opts.currency ?? "INR",
      validityDays: opts.validityDays ?? 30,
      quotationDate: opts.quotationDate ?? new Date(),
      leadId: opts.leadId ?? null,
      projectId: opts.projectId ?? null,
      status: "Draft",
      currentRevisionNo: 0,
      attachmentUrl: file.url,
      attachmentSharePointUrl: file.sharePointUrl || file.url,
      createdById: opts.userId,
    },
  });
  await prisma.quotationRevision.create({
    data: {
      quotationId: row.id,
      revisionNo: 0,
      stage: "Draft",
      fileName: proposalDocxFilename(opts.quotationNo, opts.clientName, 0),
      fileUrl: file.url,
      sharePointUrl: file.sharePointUrl || file.url,
      uploadedById: opts.userId,
      note: `Seeded in ${CRM_SHAREPOINT.pmcProposals}`,
    },
  });
  return prisma.quotation.findUniqueOrThrow({
    where: { id: row.id },
    include: quotationInclude(),
  });
}

export async function startNextProposalRevision(opts: {
  quotationId: string;
  userId: string;
  note?: string;
  buffer?: Buffer;
}) {
  const q = await prisma.quotation.findUnique({
    where: { id: opts.quotationId },
    include: { project: { select: { id: true, code: true } } },
  });
  if (!q) throw new Error("Proposal not found");
  await ensureProposalRevisionTrail(q.id);
  const nextNo = (q.currentRevisionNo || 0) + 1;
  await prisma.quotationRevision.updateMany({
    where: { quotationId: q.id, stage: { not: SENT } },
    data: { stage: "Superseded" },
  });
  const bytes = opts.buffer ?? bufferForNextRevision(q.attachmentUrl);
  const library = q.project?.code || CRM_OFFICE_LIBRARY;
  mockOneDrive.projectRoot(library);
  const file = await createProjectProposalFile(library, q.clientName, q.quotationNo, nextNo, bytes);
  await prisma.quotationRevision.create({
    data: {
      quotationId: q.id,
      revisionNo: nextNo,
      stage: "Draft",
      fileName: proposalDocxFilename(q.quotationNo, q.clientName, nextNo),
      fileUrl: file.url,
      sharePointUrl: file.sharePointUrl || file.url,
      uploadedById: opts.userId,
      note: opts.note || null,
    },
  });
  return prisma.quotation.update({
    where: { id: q.id },
    data: {
      status: "Editing",
      currentRevisionNo: nextNo,
      attachmentUrl: file.url,
      attachmentSharePointUrl: file.sharePointUrl || file.url,
    },
    include: quotationInclude(),
  });
}

export async function markCurrentProposalSent(opts: {
  quotationId: string;
  userId: string;
  note?: string;
}) {
  const q = await ensureProposalRevisionTrail(opts.quotationId);
  if (!q) throw new Error("Proposal not found");
  const current = q.revisions.find((r) => r.revisionNo === q.currentRevisionNo) || q.revisions[0];
  if (current) {
    await prisma.quotationRevision.update({
      where: { id: current.id },
      data: { stage: SENT, note: opts.note || current.note },
    });
  }
  return prisma.quotation.findUniqueOrThrow({
    where: { id: q.id },
    include: quotationInclude(),
  });
}
