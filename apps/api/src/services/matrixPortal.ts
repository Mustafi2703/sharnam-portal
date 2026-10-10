/**
 * Open the portal for everyone in a project's communication matrix: a login for each contact with an e-mail
 * (role by company type, linked to their company) and a seat on the project team. No e-mail is sent.
 */
import type { RoleKey } from "@sharnam/shared";
import { prisma } from "../prisma.js";
import { ensurePortalLogin } from "./crmVendorCredentials.js";
import { ensureConsultantCompany } from "./consultantCompany.js";

type Party = "Client" | "Consultant" | "Contractor" | "SPDC";

function partyOf(text: string): Party {
  const t = text.toLowerCase();
  if (/sharnam|spdc|project management|pmc/.test(t)) return "SPDC";
  if (/client|owner|employer/.test(t)) return "Client";
  if (/consult|design|architect|structur|mep|bim|engineer|studio/.test(t)) return "Consultant";
  return "Contractor";
}

export type OpenPortalResult = {
  opened: { email: string; name: string; role: string; company: string; created: boolean; password?: string }[];
  skipped: { email: string; reason: string }[];
  contacts: number;
};

export async function openPortalForMatrix(projectId: string): Promise<OpenPortalResult> {
  const contacts = await prisma.communicationContact.findMany({
    where: { projectId, isSectionHeader: false, email: { not: null } },
    orderBy: [{ matrixKind: "asc" }, { orgSection: "asc" }],
  });
  const out: OpenPortalResult = { opened: [], skipped: [], contacts: 0 };
  const seen = new Set<string>();
  for (const c of contacts) {
    const email = String(c.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || seen.has(email)) continue;
    seen.add(email);
    out.contacts++;
    const name = (c.personName || "").trim() || email;
    const company = (c.company || c.orgName || "").trim();
    const party = partyOf(`${c.orgSection || ""} ${c.orgName || ""} ${company}`);
    try {
      const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
      let role: RoleKey;
      let vendorId: string | null = null;
      if (party === "SPDC") {
        if (!existing) {
          out.skipped.push({ email, reason: "SPDC staff — add them in HRMS (Recruitment → offer → portal login)" });
          continue;
        }
        role = existing.role as RoleKey;
      } else if (party === "Client") {
        role = "client";
        const v = await prisma.vendor.findFirst({ where: { name: company || name, partyType: "Client" }, select: { id: true } });
        vendorId = v?.id || (await prisma.vendor.create({ data: { name: company || name, partyType: "Client", email, primaryContactName: name, createdVia: "Matrix" }, select: { id: true } })).id;
      } else if (party === "Consultant") {
        role = "employee";
        vendorId = await ensureConsultantCompany({ firm: company, fullName: name, email });
      } else {
        role = "vendor";
        const v = await prisma.vendor.findFirst({ where: { name: company || name, partyType: { in: ["Contractor", "Vendor"] } }, select: { id: true } });
        vendorId = v?.id || (await prisma.vendor.create({ data: { name: company || name, partyType: "Contractor", email, primaryContactName: name, createdVia: "Matrix" }, select: { id: true } })).id;
      }
      const login = await ensurePortalLogin({ email, fullName: name, role, phone: c.mobile || undefined, vendorId });
      if (!login) {
        out.skipped.push({ email, reason: "login could not be created" });
        continue;
      }
      await prisma.projectMember.upsert({
        where: { projectId_userId: { projectId, userId: login.userId } },
        create: { projectId, userId: login.userId, role: login.role === "admin" ? "office" : login.role },
        update: {},
      });
      out.opened.push({ email, name, role: login.role, company, created: login.created, password: login.created ? login.tempPassword : undefined });
    } catch (err) {
      out.skipped.push({ email, reason: err instanceof Error ? err.message : "failed" });
    }
  }
  return out;
}
