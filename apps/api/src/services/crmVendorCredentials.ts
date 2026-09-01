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

export async function ensureVendorPortalLogin(vendor: { email?: string | null; name: string; businessPhone?: string | null }) {
  return ensurePortalLogin({
    email: vendor.email || "",
    fullName: vendor.name,
    role: "vendor",
    phone: vendor.businessPhone,
  });
}

export async function ensureClientPortalLogin(party: { email?: string | null; name: string; businessPhone?: string | null }) {
  return ensurePortalLogin({
    email: party.email || "",
    fullName: party.name,
    role: "client",
    phone: party.businessPhone,
  });
}
