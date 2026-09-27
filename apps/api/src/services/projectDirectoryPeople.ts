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

/** Client representatives for this job: Step 2 contacts plus the email already on the client card. */
export async function listClientRepresentativesForProject(projectId: string): Promise<ProjectClientRepRow[]> {
  const [project, links] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { clientName: true, clientEmail: true, clientContactName: true },
    }),
    prisma.projectVendor.findMany({
      where: { projectId, vendor: { partyType: "Client", isActive: true } },
      include: {
        vendor: { select: { id: true, name: true, email: true, primaryContactName: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  type Draft = ProjectClientRepRow;
  const drafts: Draft[] = [];
  const seen = new Set<string>();
  const vendorNameById = new Map(links.map((l) => [l.vendorId, l.vendor.name]));

  function add(row: Omit<Draft, "portalActive" | "loginPath" | "email"> & { email: string }) {
    const email = row.email.trim().toLowerCase();
    if (!email || seen.has(email)) return;
    seen.add(email);
    drafts.push({ ...row, email, portalActive: false, loginPath: "/login/client" });
  }

  const vendorIds = links.map((l) => l.vendorId);
  if (vendorIds.length) {
    const contacts = await prisma.vendorContact.findMany({
      where: { vendorId: { in: vendorIds } },
      orderBy: [{ vendorId: "asc" }, { createdAt: "asc" }],
    });
    for (const c of contacts) {
      add({
        id: c.id,
        vendorId: c.vendorId,
        vendorName: vendorNameById.get(c.vendorId) || "Client",
        fullName: c.fullName,
        email: c.email,
        siteRole: c.role,
      });
    }
  }

  for (const link of links) {
    const email = (link.vendor.email || "").trim().toLowerCase();
    if (!email) continue;
    add({
      id: `primary-${link.vendor.id}`,
      vendorId: link.vendor.id,
      vendorName: link.vendor.name,
      fullName: link.vendor.primaryContactName,
      email,
      siteRole: "Client representative",
    });
  }

  const cardEmail = (project?.clientEmail || "").trim().toLowerCase();
  if (cardEmail && !seen.has(cardEmail)) {
    const existing = await prisma.vendorContact.findFirst({
      where: { email: cardEmail },
      include: { vendor: { select: { id: true, name: true } } },
    });
    add({
      id: existing?.id || "card-email",
      vendorId: existing?.vendorId || links[0]?.vendorId || "",
      vendorName: existing?.vendor.name || links[0]?.vendor.name || project?.clientName || "Client",
      fullName: existing?.fullName || project?.clientContactName || null,
      email: cardEmail,
      siteRole: existing?.role || "Client representative",
    });
  }

  if (!drafts.length) return [];

  const users = await prisma.user.findMany({
    where: { email: { in: drafts.map((d) => d.email) }, role: "client", isActive: { not: false } },
    select: { email: true },
  });
  const active = new Set(users.map((u) => u.email.toLowerCase()));
  return drafts.map((d) => ({ ...d, portalActive: active.has(d.email) }));
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
