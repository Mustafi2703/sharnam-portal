/**
 * Project directory sign-off register — PNG signatures in DMS for branded Excel/PDF exports.
 */
import type { PrismaClient } from "@prisma/client";
import { mockOneDrive } from "./mockOneDrive.js";

export const DIRECTORY_SIGNATURES_FOLDER =
  "01_CONTEXT_AND_GOVERNANCE/01.03_Organisation_and_Authority/Directory_Signatures";

function slug(s: string) {
  return s
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48) || "signatory";
}

export type DirectorySignEntry = {
  id: string;
  kind: "member" | "vendor";
  name: string;
  role: string;
  email?: string | null;
  signatureUrl?: string | null;
  signatureStoragePath?: string | null;
  signatureUpdatedAt?: Date | null;
  signatoryTitle?: string | null;
};

export async function listDirectorySignatures(prisma: PrismaClient, projectId: string): Promise<DirectorySignEntry[]> {
  const [members, vendors] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { fullName: true, email: true, role: true } } },
    }),
    prisma.projectVendor.findMany({
      where: { projectId },
      include: { vendor: { select: { name: true, partyType: true, primaryContactName: true, email: true } } },
    }),
  ]);

  const rows: DirectorySignEntry[] = [];
  for (const m of members) {
    rows.push({
      id: m.id,
      kind: "member",
      name: m.user.fullName,
      email: m.user.email,
      role: m.signatoryTitle || m.role || m.user.role,
      signatureUrl: m.signatureUrl,
      signatureStoragePath: m.signatureStoragePath,
      signatureUpdatedAt: m.signatureUpdatedAt,
      signatoryTitle: m.signatoryTitle,
    });
  }
  for (const pv of vendors) {
    rows.push({
      id: pv.id,
      kind: "vendor",
      name: pv.signatoryName || pv.vendor.primaryContactName || pv.vendor.name,
      email: pv.vendor.email,
      role: pv.tradeRole || pv.vendor.partyType || "Contractor",
      signatureUrl: pv.signatureUrl,
      signatureStoragePath: pv.signatureStoragePath,
      signatureUpdatedAt: pv.signatureUpdatedAt,
      signatoryTitle: pv.signatoryName,
    });
  }
  return rows;
}

/** Role buckets for checklist / RFI branded sign blocks. */
export type DirectorySignMap = {
  pmc?: { name: string; url?: string | null; updatedAt?: Date | null };
  site?: { name: string; url?: string | null; updatedAt?: Date | null };
  client?: { name: string; url?: string | null; updatedAt?: Date | null };
  contractor?: { name: string; url?: string | null; updatedAt?: Date | null };
};

export async function getDirectorySignMap(prisma: PrismaClient, projectId: string): Promise<DirectorySignMap> {
  const [members, vendors] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId, signatureUrl: { not: null } },
      include: { user: { select: { fullName: true, role: true } } },
    }),
    prisma.projectVendor.findMany({
      where: { projectId, signatureUrl: { not: null } },
      include: { vendor: { select: { name: true, partyType: true, primaryContactName: true } } },
    }),
  ]);

  const map: DirectorySignMap = {};
  for (const m of members) {
    const entry = {
      name: m.user.fullName,
      url: m.signatureUrl,
      updatedAt: m.signatureUpdatedAt,
    };
    const portalRole = m.user.role;
    const title = (m.signatoryTitle || m.role || "").toLowerCase();
    if (portalRole === "client" || title.includes("client")) map.client = entry;
    else if (portalRole === "site_employee" || title.includes("site")) map.site = map.site || entry;
    else if (["admin", "office", "employee"].includes(portalRole) || title.includes("pmc") || title.includes("manager"))
      map.pmc = map.pmc || entry;
    else if (portalRole === "vendor") map.contractor = map.contractor || entry;
  }
  for (const pv of vendors) {
    const pt = pv.vendor.partyType;
    const entry = {
      name: pv.signatoryName || pv.vendor.primaryContactName || pv.vendor.name,
      url: pv.signatureUrl,
      updatedAt: pv.signatureUpdatedAt,
    };
    if (pt === "Client") map.client = entry;
    else if (pt === "Contractor" || pt === "Vendor") map.contractor = map.contractor || entry;
    else if (pt === "PMC" || pt === "Consultant") map.pmc = map.pmc || entry;
  }
  return map;
}

async function ensureSignatureFolder(projectId: string, projectCode: string) {
  await mockOneDrive.ensureProjectTree(projectId);
  const abs = mockOneDrive.projectRoot(projectCode);
  const fs = await import("fs");
  const path = await import("path");
  fs.mkdirSync(path.join(abs, DIRECTORY_SIGNATURES_FOLDER), { recursive: true });
  await mockOneDrive.touchFolder(projectId, DIRECTORY_SIGNATURES_FOLDER);
}

export async function saveMemberDirectorySignature(
  prisma: PrismaClient,
  projectId: string,
  memberId: string,
  file: Buffer,
  fileName: string,
  opts?: { signatoryTitle?: string | null; uploadedById?: string }
) {
  const member = await prisma.projectMember.findFirst({
    where: { id: memberId, projectId },
    include: { user: { select: { fullName: true } }, project: { select: { code: true } } },
  });
  if (!member) throw new Error("Project member not found");

  await ensureSignatureFolder(projectId, member.project.code);
  const safeName = `${slug(member.user.fullName)}-signature.png`;
  const saved = await mockOneDrive.upload(
    member.project.code,
    DIRECTORY_SIGNATURES_FOLDER,
    safeName,
    file,
    "image/png",
    { replace: true }
  );

  return prisma.projectMember.update({
    where: { id: member.id },
    data: {
      signatureUrl: saved.url,
      signatureStoragePath: saved.path,
      signatureFileName: fileName || safeName,
      signatureUpdatedAt: new Date(),
      ...(opts?.signatoryTitle != null ? { signatoryTitle: opts.signatoryTitle || null } : {}),
    },
    include: { user: { select: { fullName: true, email: true, role: true } } },
  });
}

export async function saveVendorDirectorySignature(
  prisma: PrismaClient,
  projectId: string,
  projectVendorId: string,
  file: Buffer,
  fileName: string,
  opts?: { signatoryName?: string | null }
) {
  const pv = await prisma.projectVendor.findFirst({
    where: { id: projectVendorId, projectId },
    include: { vendor: true, project: { select: { code: true } } },
  });
  if (!pv) throw new Error("Project party not found");

  await ensureSignatureFolder(projectId, pv.project.code);
  const label = opts?.signatoryName || pv.signatoryName || pv.vendor.name;
  const safeName = `${slug(pv.vendor.name)}-signature.png`;
  const saved = await mockOneDrive.upload(
    pv.project.code,
    DIRECTORY_SIGNATURES_FOLDER,
    safeName,
    file,
    "image/png",
    { replace: true }
  );

  return prisma.projectVendor.update({
    where: { id: pv.id },
    data: {
      signatureUrl: saved.url,
      signatureStoragePath: saved.path,
      signatureFileName: fileName || safeName,
      signatureUpdatedAt: new Date(),
      ...(opts?.signatoryName != null ? { signatoryName: opts.signatoryName || null } : {}),
    },
    include: { vendor: true },
  });
}

export type MySignatureSlots = {
  member: {
    id: string;
    name: string;
    role: string;
    signatureUrl?: string | null;
    signatureUpdatedAt?: Date | null;
    canEdit: boolean;
  } | null;
  vendors: Array<{
    id: string;
    vendorId: string;
    name: string;
    partyType: string;
    signatureUrl?: string | null;
    signatureUpdatedAt?: Date | null;
    canEdit: boolean;
  }>;
};

export function canManageDirectorySignatures(role: string) {
  return ["admin", "office"].includes(role);
}

export function canEditVendorSignature(
  user: { id: string; email: string; role: string; vendorId?: string | null },
  pv: { vendorId: string; vendor: { email?: string | null; partyType?: string | null } }
) {
  if (canManageDirectorySignatures(user.role)) return true;
  if (user.vendorId && user.vendorId === pv.vendorId) return true;
  const email = user.email?.toLowerCase();
  const vendorEmail = pv.vendor.email?.toLowerCase();
  if (email && vendorEmail && email === vendorEmail) return true;
  return false;
}

export async function getMyDirectorySignatureSlots(
  prisma: PrismaClient,
  projectId: string,
  user: { id: string; email: string; role: string; vendorId?: string | null }
): Promise<MySignatureSlots> {
  const [member, vendors] = await Promise.all([
    prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
      include: { user: { select: { fullName: true, role: true } } },
    }),
    prisma.projectVendor.findMany({
      where: { projectId },
      include: { vendor: { select: { id: true, name: true, partyType: true, email: true, primaryContactName: true } } },
    }),
  ]);

  const editableVendors = vendors
    .filter((pv) => canEditVendorSignature(user, pv))
    .map((pv) => ({
      id: pv.id,
      vendorId: pv.vendorId,
      name: pv.signatoryName || pv.vendor.primaryContactName || pv.vendor.name,
      partyType: pv.vendor.partyType || "Party",
      signatureUrl: pv.signatureUrl,
      signatureUpdatedAt: pv.signatureUpdatedAt,
      canEdit: true,
    }));

  return {
    member: member
      ? {
          id: member.id,
          name: member.user.fullName,
          role: member.signatoryTitle || member.role || member.user.role,
          signatureUrl: member.signatureUrl,
          signatureUpdatedAt: member.signatureUpdatedAt,
          canEdit: canManageDirectorySignatures(user.role) || member.userId === user.id,
        }
      : null,
    vendors: editableVendors,
  };
}
