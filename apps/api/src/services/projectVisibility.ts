import { prisma } from "../prisma.js";

const OFFICE_ROLES = new Set(["admin", "office"]);

type Viewer = { id: string; role: string; email?: string; vendorId?: string | null };

export async function viewerCanSeeProject(user: Viewer, projectId: string): Promise<boolean> {
  if (OFFICE_ROLES.has(user.role)) return true;
  const member = await prisma.projectMember.findFirst({ where: { projectId, userId: user.id }, select: { id: true } });
  if (member) return true;
  if (user.role === "vendor") {
    const { resolveVendorForUser } = await import("./vendorPortal.js");
    const vendor = await resolveVendorForUser({
      id: user.id,
      email: user.email || "",
      role: user.role,
      vendorId: user.vendorId,
    });
    if (!vendor) return false;
    const assigned = await prisma.projectVendor.findFirst({
      where: { projectId, vendorId: vendor.id },
      select: { id: true },
    });
    if (assigned) return true;
    const bid = await prisma.crmVendorBoq.findFirst({
      where: {
        OR: [{ vendorId: vendor.id }, { vendorLabel: vendor.name }],
        bidPackage: { projectId, status: { in: ["Open", "Evaluation", "Awarded"] } },
      },
      select: { id: true },
    });
    return !!bid;
  }
  return false;
}

/** Strip owner / other-bidder fields so vendors and clients only see what their desk needs. */
export function projectPayloadForRole<T extends Record<string, unknown>>(project: T, role: string): T {
  if (role === "admin" || role === "office" || role === "employee") return project;
  const hidden = {
    clientEmail: null,
    clientPhone: null,
    clientContactName: null,
    clientAddress: null,
    clientGst: null,
    contractorName: null,
    designConsultant: null,
  };
  if (role === "vendor") {
    return {
      ...project,
      ...hidden,
      name: project.code,
      clientName: null,
    };
  }
  if (role === "client") {
    return {
      ...project,
      ...hidden,
      contractorName: null,
      designConsultant: null,
    };
  }
  return project;
}
