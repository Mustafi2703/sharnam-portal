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
  password?: string | null;
  vendorId?: string | null;
  designation?: string | null;
  department?: string | null;
}): Promise<PortalLoginResult | null> {
  const email = String(opts.email || "")
    .trim()
    .toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (opts.vendorId && !existing.vendorId) {
      await prisma.user.update({ where: { id: existing.id }, data: { vendorId: opts.vendorId } }).catch(() => {});
    }
    return { userId: existing.id, email, created: false, role: existing.role as RoleKey };
  }

  const bcrypt = await import("bcryptjs");
  const { portalForRole } = await import("@sharnam/shared");
  const tempPassword = String(opts.password || "").trim() || defaultTempPassword();
  const hash = await bcrypt.hash(tempPassword, 10);
  const user = await prisma.user.create({
    data: {
      email,
      fullName: opts.fullName.trim() || email.split("@")[0],
      role: opts.role,
      portal: portalForRole(opts.role),
      phone: opts.phone || null,
      passwordHash: hash,
      vendorId: opts.vendorId || null,
    },
  });

  if (opts.role !== "client" && opts.role !== "vendor") {
    await prisma.employeeProfile.create({
      data: {
        userId: user.id,
        empCode: `EMP-${Date.now().toString().slice(-6)}`,
        designation: opts.designation || null,
        department: opts.department || null,
        joinDate: new Date(),
      },
    });
  } else if (opts.designation) {
    const prefix = opts.role === "client" ? "CLT" : "VND";
    await prisma.employeeProfile.create({
      data: {
        userId: user.id,
        empCode: `${prefix}-${Date.now().toString().slice(-6)}`,
        designation: opts.designation,
        joinDate: new Date(),
      },
    }).catch(() => {});
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

export async function ensureStakeholderPortalLogin(party: {
  email?: string | null;
  name: string;
  businessPhone?: string | null;
  vendorId?: string | null;
}) {
  const login = await ensurePortalLogin({
    email: party.email || "",
    fullName: party.name,
    role: "employee",
    phone: party.businessPhone,
  });
  if (login && party.vendorId) {
    await prisma.user.update({ where: { id: login.userId }, data: { vendorId: party.vendorId } }).catch(() => {});
  }
  return login;
}

const LOCKED_ROLES = new Set(["admin", "office", "site_employee"]);

export function portalRoleForPartyType(partyType?: string | null): RoleKey {
  if (partyType === "Client") return "client";
  if (partyType === "Consultant" || partyType === "Designer" || partyType === "PMC") return "employee";
  return "vendor";
}

async function alignUserRole(userId: string, role: RoleKey) {
  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!existing || LOCKED_ROLES.has(existing.role) || existing.role === role) return;
  const { portalForRole } = await import("@sharnam/shared");
  await prisma.user.update({
    where: { id: userId },
    data: { role, portal: portalForRole(role) },
  });
  if (role !== "client" && role !== "vendor") {
    const hasProfile = await prisma.employeeProfile.findUnique({ where: { userId } });
    if (!hasProfile) {
      await prisma.employeeProfile
        .create({
          data: { userId, empCode: `EMP-${Date.now().toString().slice(-6)}`, joinDate: new Date() },
        })
        .catch(() => {});
    }
  }
}

/** Client / consultant / vendor login + project seat. Idempotent — never deletes. */
export async function provisionCompanyAccess(opts: {
  projectId: string;
  vendor: {
    id: string;
    name: string;
    email?: string | null;
    businessPhone?: string | null;
    partyType?: string | null;
    primaryContactName?: string | null;
  };
  assignedVia?: string;
}) {
  const role = portalRoleForPartyType(opts.vendor.partyType);
  const name = opts.vendor.primaryContactName || opts.vendor.name;
  let login: PortalLoginResult | null = null;
  if (role === "client") {
    login = await ensureClientPortalLogin({
      email: opts.vendor.email,
      name,
      businessPhone: opts.vendor.businessPhone,
    });
  } else if (role === "employee") {
    login = await ensureStakeholderPortalLogin({
      email: opts.vendor.email,
      name,
      businessPhone: opts.vendor.businessPhone,
      vendorId: opts.vendor.id,
    });
  } else {
    login = await ensureVendorPortalLogin({
      email: opts.vendor.email,
      name: opts.vendor.name,
      businessPhone: opts.vendor.businessPhone,
      vendorId: opts.vendor.id,
    });
  }
  if (login) {
    await alignUserRole(login.userId, role);
    login = { ...login, role };
  }
  await grantVendorProjectAccess({
    projectId: opts.projectId,
    vendorId: opts.vendor.id,
    userId: login?.userId,
    assignedVia: opts.assignedVia || "Project setup",
    memberRole: role === "employee" ? "employee" : role,
  });
  return login;
}

export async function provisionProjectClientEmail(opts: {
  projectId: string;
  email?: string | null;
  name: string;
  phone?: string | null;
}) {
  const login = await ensureClientPortalLogin({
    email: opts.email,
    name: opts.name,
    businessPhone: opts.phone,
  });
  if (!login) return login;
  await grantVendorProjectAccess({
    projectId: opts.projectId,
    userId: login.userId,
    memberRole: "client",
    assignedVia: "Project card",
  });
  return login;
}

/** Link vendor company + portal user to a live project so GET /api/projects lists the job. */
export async function grantVendorProjectAccess(opts: {
  projectId: string;
  vendorId?: string | null;
  userId?: string | null;
  assignedVia?: string;
  memberRole?: string;
}) {
  if (opts.vendorId) {
    await prisma.projectVendor.upsert({
      where: { projectId_vendorId: { projectId: opts.projectId, vendorId: opts.vendorId } },
      create: { projectId: opts.projectId, vendorId: opts.vendorId, assignedVia: opts.assignedVia || "Bid open" },
      update: {},
    });
  }
  if (opts.userId) {
    const memberRole = opts.memberRole || "vendor";
    const existing = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: opts.projectId, userId: opts.userId } },
    });
    const keep = existing && (existing.role === "admin" || existing.role === "office");
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: opts.projectId, userId: opts.userId } },
      create: { projectId: opts.projectId, userId: opts.userId, role: memberRole },
      update: keep ? {} : { role: memberRole },
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
