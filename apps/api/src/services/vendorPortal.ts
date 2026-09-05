import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../prisma.js";

/** Resolve vendor company for a portal user (primary email, linked vendorId, or VendorContact). */
export async function resolveVendorForUser(
  user: { id: string; email: string; role: string; vendorId?: string | null },
  db: PrismaClient = defaultPrisma,
) {
  if (user.role !== "vendor") return null;
  if (user.vendorId) {
    const byLink = await db.vendor.findUnique({ where: { id: user.vendorId }, select: { id: true, name: true, email: true } });
    if (byLink) return byLink;
  }
  const email = user.email.trim().toLowerCase();
  const byPrimary = await db.vendor.findFirst({
    where: { email: { equals: email } },
    select: { id: true, name: true, email: true },
  });
  if (byPrimary) return byPrimary;
  const contact = await db.vendorContact.findUnique({
    where: { email },
    include: { vendor: { select: { id: true, name: true, email: true } } },
  });
  return contact?.vendor ?? null;
}

/** Ensure a portal login exists for a vendor org contact and link to vendorId. */
export async function ensureVendorPortalLogin(opts: {
  vendorId: string;
  email: string;
  fullName?: string;
  passwordHash: string;
}) {
  const email = opts.email.trim().toLowerCase();
  if (!email) return null;

  await defaultPrisma.vendorContact.upsert({
    where: { email },
    create: { vendorId: opts.vendorId, email, fullName: opts.fullName || null },
    update: { vendorId: opts.vendorId, fullName: opts.fullName || undefined },
  });

  const { portalForRole } = await import("@sharnam/shared");
  const user = await defaultPrisma.user.upsert({
    where: { email },
    create: {
      email,
      fullName: opts.fullName || email.split("@")[0],
      role: "vendor",
      portal: portalForRole("vendor"),
      passwordHash: opts.passwordHash,
      vendorId: opts.vendorId,
    },
    update: {
      role: "vendor",
      portal: portalForRole("vendor"),
      vendorId: opts.vendorId,
      passwordHash: opts.passwordHash,
      ...(opts.fullName ? { fullName: opts.fullName } : {}),
    },
  });
  return user;
}
