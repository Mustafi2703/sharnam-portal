/**
 * A consultant / stakeholder login is role `employee` linked to a CRM company (party type Consultant).
 * Logins made by hand from Access carry only the firm name as text — this links them to a real company record.
 */
import { prisma } from "../prisma.js";

const STAFF_DEPARTMENT = /^(site|office|hr|hrm|accounts|admin|finance|it|tender|operations|spdc)$/i;

/** True when the department says SPDC staff rather than an external consultant trade. */
export function isStaffDepartment(department?: string | null) {
  return STAFF_DEPARTMENT.test(String(department || "").trim());
}

export async function ensureConsultantCompany(opts: { firm?: string | null; fullName: string; email: string; trade?: string | null }): Promise<string> {
  const name = (opts.firm || "").trim() || opts.fullName.trim() || opts.email;
  const existing = await prisma.vendor.findFirst({
    where: { name, partyType: { in: ["Consultant", "Designer", "PMC"] } },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.vendor.create({
    data: {
      name,
      partyType: "Consultant",
      trade: opts.trade || null,
      email: opts.email.toLowerCase(),
      primaryContactName: opts.fullName,
      createdVia: "Access",
      isActive: true,
    },
    select: { id: true },
  });
  return created.id;
}
