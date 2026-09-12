/**
 * Ensure portal logins exist for CRM bidders, clients, and stakeholders.
 */
import { prisma } from "../prisma.js";
import type { RoleKey } from "@sharnam/shared";

export type PortalLoginResult = {
  userId: string;
  email: string;
  created: boolean;
  tempPassword?: string;
  role: RoleKey;
};

function defaultTempPassword() {
  return process.env.SEED_PASSWORD || "Demo@1234";
}

export async function ensurePortalLogin(opts: {
  email: string;
  fullName: string;
  role: RoleKey;
  phone?: string | null;
}): Promise<PortalLoginResult | null> {
  const email = String(opts.email || "")
    .trim()
    .toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { userId: existing.id, email, created: false, role: existing.role as RoleKey };
  }

  const bcrypt = await import("bcryptjs");
  const { portalForRole } = await import("@sharnam/shared");
  const tempPassword = defaultTempPassword();
  const hash = await bcrypt.hash(tempPassword, 10);
  const user = await prisma.user.create({
    data: {
      email,
      fullName: opts.fullName.trim() || email.split("@")[0],
      role: opts.role,
      portal: portalForRole(opts.role),
      phone: opts.phone || null,
      passwordHash: hash,
    },
  });

  if (opts.role !== "client" && opts.role !== "vendor") {
    await prisma.employeeProfile.create({
      data: {
        userId: user.id,
        empCode: `EMP-${Date.now().toString().slice(-6)}`,
        joinDate: new Date(),
      },
    });
  }

  return { userId: user.id, email, created: true, tempPassword, role: opts.role };
}

export async function ensureVendorPortalLogin(vendor: {
  email?: string | null;
  name: string;
  businessPhone?: string | null;
  vendorId?: string | null;
}) {
  const login = await ensurePortalLogin({
    email: vendor.email || "",
    fullName: vendor.name,
    role: "vendor",
    phone: vendor.businessPhone,
  });
  if (!login) return login;
  const vendorId =
    vendor.vendorId ||
    (vendor.email
      ? (await prisma.vendor.findFirst({ where: { email: vendor.email.trim().toLowerCase() }, select: { id: true } }))?.id
      : null);
  if (vendorId) {
    await prisma.user.update({ where: { id: login.userId }, data: { vendorId } }).catch(() => {});
  }
  return login;
}

export async function ensureClientPortalLogin(party: { email?: string | null; name: string; businessPhone?: string | null }) {
  return ensurePortalLogin({
    email: party.email || "",
    fullName: party.name,
    role: "client",
    phone: party.businessPhone,
  });
}

/** Link vendor company + portal user to a live project so GET /api/projects lists the job. */
export async function grantVendorProjectAccess(opts: {
  projectId: string;
  vendorId?: string | null;
  userId?: string | null;
  assignedVia?: string;
}) {
  if (opts.vendorId) {
    await prisma.projectVendor.upsert({
      where: { projectId_vendorId: { projectId: opts.projectId, vendorId: opts.vendorId } },
      create: { projectId: opts.projectId, vendorId: opts.vendorId, assignedVia: opts.assignedVia || "Bid open" },
      update: {},
    });
  }
  if (opts.userId) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: opts.projectId, userId: opts.userId } },
      create: { projectId: opts.projectId, userId: opts.userId, role: "vendor" },
      update: {},
    });
  }
}

/** After award — login + project desk for every portal user on that company. */
export async function openAwardedProjectForVendor(opts: { projectId: string; vendorId: string }) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: opts.vendorId },
    select: { id: true, name: true, email: true, businessPhone: true },
  });
  if (!vendor) return { login: null as Awaited<ReturnType<typeof ensureVendorPortalLogin>>, vendorName: "" };
  const login = await ensureVendorPortalLogin({
    email: vendor.email,
    name: vendor.name,
    businessPhone: vendor.businessPhone,
    vendorId: vendor.id,
  });
  const users = await prisma.user.findMany({
    where: { vendorId: vendor.id, isActive: true },
    select: { id: true },
  });
  const userIds = new Set(users.map((u) => u.id));
  if (login?.userId) userIds.add(login.userId);
  for (const userId of userIds) {
    await grantVendorProjectAccess({
      projectId: opts.projectId,
      vendorId: vendor.id,
      userId,
      assignedVia: "Bid award",
    });
  }
  if (!userIds.size) {
    await grantVendorProjectAccess({
      projectId: opts.projectId,
      vendorId: vendor.id,
      assignedVia: "Bid award",
    });
  }
  return { login, vendorName: vendor.name, email: vendor.email };
}
