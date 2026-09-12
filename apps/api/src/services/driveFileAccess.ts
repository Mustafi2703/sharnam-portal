import crypto from "crypto";
import { prisma } from "../prisma.js";
import { mockOneDrive } from "./mockOneDrive.js";
import { audit } from "./audit.js";
import { queueProjectEmail } from "./email.js";

export type AuthedUser = { id: string; role: string; email?: string | null; fullName?: string | null };

const OFFICE_ROLES = new Set(["admin", "office"]);
const STAFF_ROLES = new Set(["admin", "office", "employee", "site_employee"]);

export function portalPublicBase() {
  const raw = (process.env.WEB_ORIGIN || process.env.PORTAL_URL || "https://portal.spdc.in").split(",")[0]?.trim();
  return (raw || "https://portal.spdc.in").replace(/\/$/, "");
}

export function shareLinkForToken(token: string) {
  return `${portalPublicBase()}/dms/open/${token}`;
}

export async function userCanBrowseProjectDrive(user: AuthedUser, projectId: string) {
  if (OFFICE_ROLES.has(user.role)) return true;
  const member = await prisma.projectMember.findFirst({ where: { projectId, userId: user.id }, select: { id: true } });
  if (member) return true;
  if (user.role === "vendor") {
    const { resolveVendorForUser } = await import("./vendorPortal.js");
    const vendor = await resolveVendorForUser(user as { id: string; email: string; role: string; vendorId?: string | null });
    if (!vendor) return false;
    const assigned = await prisma.projectVendor.findFirst({ where: { projectId, vendorId: vendor.id }, select: { id: true } });
    if (assigned) return true;
    const bid = await prisma.crmVendorBoq.findFirst({
      where: {
        OR: [{ vendorId: vendor.id }, { vendorLabel: vendor.name }],
        bidPackage: { projectId, status: { in: ["Open", "Evaluation", "Awarded"] } },
      },
      select: { id: true },
    });
    return Boolean(bid);
  }
  return false;
}

export function canOpenDriveDirectly(role: string) {
  return STAFF_ROLES.has(role);
}

function newToken() {
  return `drv_${crypto.randomBytes(24).toString("hex")}`;
}

function serializeRequest(row: {
  id: string;
  projectId: string;
  filePath: string;
  fileName: string;
  status: string;
  token: string | null;
  note: string | null;
  expiresAt: Date | null;
  approvedAt: Date | null;
  createdAt: Date;
  requestedBy?: { id: string; fullName: string; email: string; role: string };
  project?: { id: string; code: string; name: string };
}) {
  const live = row.status === "Approved" && row.token && (!row.expiresAt || row.expiresAt > new Date());
  return {
    ...row,
    shareUrl: live && row.token ? shareLinkForToken(row.token) : null,
  };
}

export async function requestDriveFileAccess(opts: {
  projectId: string;
  filePath: string;
  fileName: string;
  user: AuthedUser;
  note?: string;
}) {
  const filePath = opts.filePath.replace(/^\/+/, "");
  if (!filePath) throw new Error("file path required");
  if (!(await userCanBrowseProjectDrive(opts.user, opts.projectId))) {
    throw new Error("Not on this project");
  }

  const existing = await prisma.driveAccessRequest.findFirst({
    where: { projectId: opts.projectId, filePath, requestedById: opts.user.id },
    orderBy: { createdAt: "desc" },
    include: { requestedBy: { select: { id: true, fullName: true, email: true, role: true } } },
  });
  if (existing?.status === "Pending") return serializeRequest(existing);
  if (existing?.status === "Approved" && existing.token && (!existing.expiresAt || existing.expiresAt > new Date())) {
    return serializeRequest(existing);
  }

  const row = await prisma.driveAccessRequest.create({
    data: {
      projectId: opts.projectId,
      filePath,
      fileName: opts.fileName || filePath.split("/").pop() || filePath,
      requestedById: opts.user.id,
      status: "Pending",
      note: opts.note || null,
    },
    include: { requestedBy: { select: { id: true, fullName: true, email: true, role: true } } },
  });

  await audit("dms.access.request", {
    userId: opts.user.id,
    entity: "DriveAccessRequest",
    entityId: row.id,
    meta: { projectId: opts.projectId, filePath },
  });

  const project = await prisma.project.findUnique({ where: { id: opts.projectId }, select: { code: true, name: true } });
  await queueProjectEmail({
    projectId: opts.projectId,
    createdById: opts.user.id,
    context: "dms-access-request",
    subject: `DMS access request · ${project?.code || ""} · ${row.fileName}`,
    body: `${opts.user.fullName || opts.user.email} (${opts.user.role}) asked to open ${row.fileName} on ${project?.code}. Approve in Documents / All-project DMS.`,
  }).catch(() => null);

  return serializeRequest(row);
}

export async function shareDriveFile(opts: {
  projectId: string;
  filePath: string;
  fileName: string;
  userId: string;
  officeUser: AuthedUser;
  days?: number;
}) {
  if (!OFFICE_ROLES.has(opts.officeUser.role)) throw new Error("Only office can share");
  const target = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: { id: true, role: true, email: true, fullName: true },
  });
  if (!target) throw new Error("User not found");
  if (target.role !== "vendor" && target.role !== "client") {
    throw new Error("Share links are for vendor or client logins");
  }

  const filePath = opts.filePath.replace(/^\/+/, "");
  const token = newToken();
  const expiresAt = new Date(Date.now() + (opts.days || 30) * 86400000);

  const row = await prisma.driveAccessRequest.create({
    data: {
      projectId: opts.projectId,
      filePath,
      fileName: opts.fileName || filePath.split("/").pop() || filePath,
      requestedById: target.id,
      status: "Approved",
      token,
      approvedById: opts.officeUser.id,
      approvedAt: new Date(),
      expiresAt,
      note: "Shared by office",
    },
    include: { requestedBy: { select: { id: true, fullName: true, email: true, role: true } } },
  });

  await audit("dms.access.share", {
    userId: opts.officeUser.id,
    entity: "DriveAccessRequest",
    entityId: row.id,
    meta: { projectId: opts.projectId, filePath, toUserId: target.id },
  });

  const shareUrl = shareLinkForToken(token);
  if (target.email) {
    await queueProjectEmail({
      projectId: opts.projectId,
      createdById: opts.officeUser.id,
      toOverride: target.email,
      context: "dms-access-share",
      subject: `Document access · ${row.fileName}`,
      body: `Office shared ${row.fileName}. Sign in and open: ${shareUrl}`,
    }).catch(() => null);
  }

  return serializeRequest(row);
}

export async function decideDriveAccess(opts: {
  requestId: string;
  officeUser: AuthedUser;
  approve: boolean;
  days?: number;
}) {
  if (!OFFICE_ROLES.has(opts.officeUser.role)) throw new Error("Only office can approve");
  const existing = await prisma.driveAccessRequest.findUnique({
    where: { id: opts.requestId },
    include: { requestedBy: { select: { id: true, fullName: true, email: true, role: true } }, project: { select: { id: true, code: true, name: true } } },
  });
  if (!existing) throw new Error("Request not found");

  const token = opts.approve ? newToken() : null;
  const row = await prisma.driveAccessRequest.update({
    where: { id: existing.id },
    data: {
      status: opts.approve ? "Approved" : "Denied",
      token,
      approvedById: opts.officeUser.id,
      approvedAt: new Date(),
      expiresAt: opts.approve ? new Date(Date.now() + (opts.days || 30) * 86400000) : null,
    },
    include: { requestedBy: { select: { id: true, fullName: true, email: true, role: true } }, project: { select: { id: true, code: true, name: true } } },
  });

  await audit(opts.approve ? "dms.access.approve" : "dms.access.deny", {
    userId: opts.officeUser.id,
    entity: "DriveAccessRequest",
    entityId: row.id,
    meta: { filePath: row.filePath },
  });

  if (opts.approve && row.requestedBy.email && token) {
    const shareUrl = shareLinkForToken(token);
    await queueProjectEmail({
      projectId: row.projectId,
      createdById: opts.officeUser.id,
      toOverride: row.requestedBy.email,
      context: "dms-access-approved",
      subject: `Access approved · ${row.fileName}`,
      body: `Your request to open ${row.fileName} on ${row.project?.code} was approved. Sign in and open: ${shareUrl}`,
    }).catch(() => null);
  }

  return serializeRequest(row);
}

export async function listDriveAccessRequests(projectId: string, status?: string) {
  const rows = await prisma.driveAccessRequest.findMany({
    where: { projectId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    take: 80,
    include: { requestedBy: { select: { id: true, fullName: true, email: true, role: true } } },
  });
  return rows.map(serializeRequest);
}

export async function listOfficeAccessInbox() {
  const rows = await prisma.driveAccessRequest.findMany({
    where: { status: "Pending" },
    orderBy: { createdAt: "desc" },
    take: 80,
    include: {
      requestedBy: { select: { id: true, fullName: true, email: true, role: true } },
      project: { select: { id: true, code: true, name: true } },
    },
  });
  return rows.map(serializeRequest);
}

export async function accessMapForUser(projectId: string, user: AuthedUser) {
  if (canOpenDriveDirectly(user.role)) return {} as Record<string, { status: string; token?: string | null; shareUrl?: string | null }>;
  const rows = await prisma.driveAccessRequest.findMany({
    where: { projectId, requestedById: user.id },
    orderBy: { createdAt: "desc" },
  });
  const map: Record<string, { status: string; token?: string | null; shareUrl?: string | null }> = {};
  for (const row of rows) {
    if (map[row.filePath]) continue;
    const live = row.status === "Approved" && row.token && (!row.expiresAt || row.expiresAt > new Date());
    map[row.filePath] = {
      status: live ? "Approved" : row.status,
      token: live ? row.token : null,
      shareUrl: live && row.token ? shareLinkForToken(row.token) : null,
    };
  }
  return map;
}

export async function loadApprovedShare(token: string, user?: AuthedUser | null) {
  const row = await prisma.driveAccessRequest.findUnique({
    where: { token },
    include: {
      requestedBy: { select: { id: true, fullName: true, email: true, role: true } },
      project: { select: { id: true, code: true, name: true } },
    },
  });
  if (!row || row.status !== "Approved" || !row.token) return null;
  if (row.expiresAt && row.expiresAt < new Date()) return null;
  if (user && !OFFICE_ROLES.has(user.role) && user.id !== row.requestedById) return null;
  return row;
}

export async function readSharedFile(token: string) {
  const row = await loadApprovedShare(token);
  if (!row) return null;
  const buffer = mockOneDrive.readFile(row.project.code, row.filePath);
  if (!buffer) return null;
  return { row, buffer };
}

export async function shareTargets(projectId: string) {
  const members = await prisma.projectMember.findMany({
    where: { projectId, user: { role: { in: ["vendor", "client"] } } },
    include: { user: { select: { id: true, fullName: true, email: true, role: true } } },
  });
  const byId = new Map(members.map((m) => [m.user.id, m.user]));
  const vendors = await prisma.projectVendor.findMany({
    where: { projectId },
    include: { vendor: { include: { portalUsers: { select: { id: true, fullName: true, email: true, role: true } } } } },
  });
  for (const pv of vendors) {
    for (const u of pv.vendor.portalUsers || []) {
      if (u.role === "vendor") byId.set(u.id, u);
    }
  }
  return [...byId.values()];
}
