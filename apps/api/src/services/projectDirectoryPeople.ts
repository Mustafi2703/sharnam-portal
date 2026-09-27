import { prisma } from "../prisma.js";
import { portalRoleForPartyType } from "./crmVendorCredentials.js";

export type ProjectClientRepRow = {
  id: string;
  vendorId: string;
  vendorName: string;
  fullName: string | null;
  email: string;
  siteRole: string | null;
  portalActive: boolean;
  loginPath: string;
};

/** Client representatives (VendorContact) for client companies linked to this project. */
export async function listClientRepresentativesForProject(projectId: string): Promise<ProjectClientRepRow[]> {
  const links = await prisma.projectVendor.findMany({
    where: { projectId, vendor: { partyType: "Client", isActive: true } },
    include: { vendor: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const vendorIds = links.map((l) => l.vendorId);
  if (!vendorIds.length) return [];

  const contacts = await prisma.vendorContact.findMany({
    where: { vendorId: { in: vendorIds } },
    orderBy: [{ vendorId: "asc" }, { createdAt: "asc" }],
  });
  if (!contacts.length) return [];

  const vendorNameById = new Map(links.map((l) => [l.vendorId, l.vendor.name]));
  const emails = [...new Set(contacts.map((c) => c.email.toLowerCase()))];
  const users = await prisma.user.findMany({
    where: { email: { in: emails }, role: "client", isActive: { not: false } },
    select: { email: true, vendorId: true },
  });
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));

  return contacts.map((c) => {
    const u = userByEmail.get(c.email.toLowerCase());
    const portalActive = Boolean(u && (!u.vendorId || u.vendorId === c.vendorId));
    return {
      id: c.id,
      vendorId: c.vendorId,
      vendorName: vendorNameById.get(c.vendorId) || "Client",
      fullName: c.fullName,
      email: c.email,
      siteRole: c.role,
      portalActive,
      loginPath: "/login/client",
    };
  });
}

export async function listCompanyRepresentativesForProject(
  projectId: string,
  partyTypes: string[],
): Promise<
  Array<{
    id: string;
    vendorId: string;
    vendorName: string;
    partyType: string;
    fullName: string | null;
    email: string;
    siteRole: string | null;
    portalActive: boolean;
    loginPath: string;
  }>
> {
  const links = await prisma.projectVendor.findMany({
    where: { projectId, vendor: { partyType: { in: partyTypes }, isActive: true } },
    include: { vendor: { select: { id: true, name: true, partyType: true } } },
  });
  const vendorIds = links.map((l) => l.vendorId);
  if (!vendorIds.length) return [];

  const contacts = await prisma.vendorContact.findMany({
    where: { vendorId: { in: vendorIds } },
    orderBy: [{ vendorId: "asc" }, { createdAt: "asc" }],
  });
  const vendorMeta = new Map(links.map((l) => [l.vendorId, l.vendor]));
  const emails = [...new Set(contacts.map((c) => c.email.toLowerCase()))];
  const users = emails.length
    ? await prisma.user.findMany({
        where: { email: { in: emails }, isActive: { not: false } },
        select: { email: true, vendorId: true, role: true },
      })
    : [];
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));

  return contacts.map((c) => {
    const vendor = vendorMeta.get(c.vendorId);
    const partyType = vendor?.partyType || "Client";
    const expectedRole = portalRoleForPartyType(partyType);
    const loginPath =
      expectedRole === "client" ? "/login/client" : expectedRole === "vendor" ? "/login/vendor" : "/login/stakeholder";
    const u = userByEmail.get(c.email.toLowerCase());
    const portalActive = Boolean(u && u.role === expectedRole && (!u.vendorId || u.vendorId === c.vendorId));
    return {
      id: c.id,
      vendorId: c.vendorId,
      vendorName: vendor?.name || "",
      partyType,
      fullName: c.fullName,
      email: c.email,
      siteRole: c.role,
      portalActive,
      loginPath,
    };
  });
}
