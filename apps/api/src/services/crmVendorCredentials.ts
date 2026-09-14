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

const LOCKED_ROLES = new Set(["admin", "office", "site_employee", "hr"]);

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
    const { portalForRole } = await import("@sharnam/shared");
    const patch: {
      vendorId?: string;
      role?: RoleKey;
      portal?: string;
      isActive?: boolean;
      fullName?: string;
      phone?: string | null;
    } = {};
    if (opts.vendorId && !existing.vendorId) patch.vendorId = opts.vendorId;
    if (!LOCKED_ROLES.has(existing.role) && existing.role !== opts.role) {
      patch.role = opts.role;
      patch.portal = portalForRole(opts.role);
    }
    if (existing.isActive === false) patch.isActive = true;
    if (opts.fullName?.trim() && existing.fullName !== opts.fullName.trim()) patch.fullName = opts.fullName.trim();
    if (opts.phone !== undefined) patch.phone = opts.phone || null;
    if (Object.keys(patch).length) {
      await prisma.user.update({ where: { id: existing.id }, data: patch }).catch(() => {});
    }
    await alignUserRole(existing.id, opts.role);
    const refreshed = await prisma.user.findUnique({ where: { id: existing.id }, select: { id: true, role: true } });
    return {
      userId: existing.id,
      email,
      created: false,
      role: (refreshed?.role || existing.role) as RoleKey,
    };
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

export async function ensureClientPortalLogin(party: {
  email?: string | null;
  name: string;
  businessPhone?: string | null;
  vendorId?: string | null;
}) {
  return ensurePortalLogin({
    email: party.email || "",
    fullName: party.name,
    role: "client",
    phone: party.businessPhone,
    vendorId: party.vendorId,
  });
}

/** Ensure CRM client company row + portal login + optional project seat. */
export async function ensureClientVendorAndPortal(opts: {
  name: string;
  email?: string | null;
  phone?: string | null;
  contactName?: string | null;
  address?: string | null;
  gst?: string | null;
  projectId?: string;
  password?: string | null;
}) {
  const name = String(opts.name || "").trim();
  const email = String(opts.email || "")
    .trim()
    .toLowerCase();
  if (!name) return { vendor: null as null, login: null as PortalLoginResult | null };

  let vendor =
    (email ? await prisma.vendor.findFirst({ where: { email, partyType: "Client" } }) : null) ||
    (await prisma.vendor.findFirst({ where: { name, partyType: "Client" } }));

  if (!vendor) {
    vendor = await prisma.vendor.create({
      data: {
        name,
        partyType: "Client",
        email: email || null,
        businessPhone: opts.phone || null,
        primaryContactName: opts.contactName || null,
        address: opts.address || null,
        gstNumber: opts.gst || null,
        isActive: true,
        createdVia: "CRM",
      },
    });
  } else {
    vendor = await prisma.vendor.update({
      where: { id: vendor.id },
      data: {
        name: name || vendor.name,
        email: email || vendor.email,
        businessPhone: opts.phone ?? vendor.businessPhone,
        primaryContactName: opts.contactName ?? vendor.primaryContactName,
        address: opts.address ?? vendor.address,
        gstNumber: opts.gst ?? vendor.gstNumber,
        isActive: true,
      },
    });
  }

  const login = email
    ? await syncDirectoryPortalLogin({ vendor, password: opts.password })
    : null;

  if (opts.projectId) {
    await prisma.projectVendor.upsert({
      where: { projectId_vendorId: { projectId: opts.projectId, vendorId: vendor.id } },
      create: { projectId: opts.projectId, vendorId: vendor.id, assignedVia: "Client portal" },
      update: {},
    });
    if (login) {
      await grantVendorProjectAccess({
        projectId: opts.projectId,
        vendorId: vendor.id,
        userId: login.userId,
        memberRole: "client",
        assignedVia: "Client portal",
      });
    }
  }

  return { vendor, login };
}

/** Push client directory edits onto every project that uses this company. */
export async function syncClientVendorToLinkedProjects(vendor: {
  id: string;
  name: string;
  primaryContactName?: string | null;
  email?: string | null;
  businessPhone?: string | null;
  address?: string | null;
  gstNumber?: string | null;
}) {
  const links = await prisma.projectVendor.findMany({
    where: { vendorId: vendor.id },
    select: { projectId: true },
  });
  const projectIds = [...new Set(links.map((l) => l.projectId))];
  if (!projectIds.length) return 0;
  await prisma.project.updateMany({
    where: { id: { in: projectIds } },
    data: {
      clientName: vendor.name,
      clientContactName: vendor.primaryContactName || null,
      clientEmail: vendor.email || null,
      clientPhone: vendor.businessPhone || null,
      clientAddress: vendor.address || null,
      clientGst: vendor.gstNumber || null,
    },
  });
  return projectIds.length;
}

/** Update or create the portal login tied to a CRM directory company. */
export async function syncDirectoryPortalLogin(opts: {
  vendor: {
    id: string;
    name: string;
    email?: string | null;
    businessPhone?: string | null;
    partyType?: string | null;
    primaryContactName?: string | null;
    trade?: string | null;
  };
  password?: string | null;
}): Promise<(PortalLoginResult & { passwordUpdated?: boolean }) | null> {
  const email = String(opts.vendor.email || "")
    .trim()
    .toLowerCase();
  if (!email) return null;

  const role = portalRoleForPartyType(opts.vendor.partyType);
  const fullName = String(opts.vendor.primaryContactName || opts.vendor.name || email).trim();
  const user = await prisma.user.findFirst({
    where: { OR: [{ vendorId: opts.vendor.id }, { email }] },
  });

  if (!user) {
    return ensurePortalLogin({
      email,
      fullName,
      role,
      phone: opts.vendor.businessPhone,
      password: opts.password,
      vendorId: opts.vendor.id,
      designation: opts.vendor.name,
      department: role === "employee" ? opts.vendor.trade || null : null,
    });
  }

  const bcrypt = await import("bcryptjs");
  const { portalForRole } = await import("@sharnam/shared");
  const data: {
    fullName: string;
    phone: string | null;
    vendorId: string;
    email?: string;
    passwordHash?: string;
    role?: RoleKey;
    portal?: string;
  } = {
    fullName,
    phone: opts.vendor.businessPhone ? String(opts.vendor.businessPhone) : null,
    vendorId: opts.vendor.id,
  };

  if (email !== user.email) {
    const clash = await prisma.user.findUnique({ where: { email } });
    if (clash && clash.id !== user.id) {
      throw new Error("That email is already used by another portal login.");
    }
    data.email = email;
  }

  const password = String(opts.password || "").trim();
  if (password) {
    data.passwordHash = await bcrypt.hash(password, 10);
  }

  if (user.role !== role && !LOCKED_ROLES.has(user.role)) {
    data.role = role;
    data.portal = portalForRole(role);
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data });
  await alignUserRole(updated.id, role);
  return {
    userId: updated.id,
    email: updated.email,
    created: false,
    role: updated.role as RoleKey,
    passwordUpdated: Boolean(password),
  };
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
  address?: string | null;
  gst?: string | null;
  contactName?: string | null;
}) {
  const out = await ensureClientVendorAndPortal({
    projectId: opts.projectId,
    name: opts.name,
    email: opts.email,
    phone: opts.phone,
    address: opts.address,
    gst: opts.gst,
    contactName: opts.contactName,
  });
  return out.login;
}

/** After project directory assign — create portal logins for companies with email. */
export async function provisionProjectVendorAccess(opts: {
  projectId: string;
  vendorIds: string[];
  assignedVia?: string;
}) {
  const vendors = await prisma.vendor.findMany({ where: { id: { in: opts.vendorIds } } });
  const logins: PortalLoginResult[] = [];
  for (const vendor of vendors) {
    if (!vendor.email) continue;
    const login = await provisionCompanyAccess({
      projectId: opts.projectId,
      vendor,
      assignedVia: opts.assignedVia || "Project setup",
    });
    if (login) logins.push(login);
  }
  return logins;
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
