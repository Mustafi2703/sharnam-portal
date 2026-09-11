/**
 * Import project directory (members + vendors) into the in-project
 * CommunicationContact matrices (TECHNICAL + COMMERCIAL). Idempotent.
 */
import { prisma } from "../prisma.js";

const KINDS = ["TECHNICAL", "COMMERCIAL"] as const;
const PMC_ORG = "Sharnam Project Development Consultants & Co.";

type OrgSection = "Client" | "PMC" | "Consultant" | "Contractor" | "Other";

function partyToSection(partyType: string): OrgSection {
  if (partyType === "Client") return "Client";
  if (partyType === "PMC") return "PMC";
  if (partyType === "Consultant" || partyType === "Designer") return "Consultant";
  if (partyType === "Contractor" || partyType === "Vendor") return "Contractor";
  return "Other";
}

function memberToSection(memberRole: string, portalRole: string): OrgSection {
  const r = `${memberRole} ${portalRole}`.toLowerCase();
  if (r.includes("client")) return "Client";
  if (r.includes("vendor") || r.includes("contractor")) return "Contractor";
  return "PMC";
}

function sectionBase(section: OrgSection): number {
  if (section === "Client") return 1;
  if (section === "PMC") return 100;
  if (section === "Consultant") return 200;
  if (section === "Contractor") return 300;
  return 400;
}

function contactKey(email?: string | null, personName?: string | null, orgSection?: string | null) {
  const em = String(email || "")
    .trim()
    .toLowerCase();
  if (em) return `e:${em}`;
  return `n:${String(orgSection || "").toLowerCase()}|${String(personName || "")
    .trim()
    .toLowerCase()}`;
}

export type SyncCommsResult = {
  created: number;
  skipped: number;
  headers: number;
  technical: number;
  commercial: number;
};

export async function syncCommsContactsFromDirectory(projectId: string): Promise<SyncCommsResult> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found");

  const [members, projectVendors] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { fullName: true, email: true, phone: true, role: true } } },
    }),
    prisma.projectVendor.findMany({
      where: { projectId },
      include: { vendor: true },
    }),
  ]);

  type Person = {
    orgSection: OrgSection;
    orgName: string;
    personName: string;
    designation: string;
    company: string;
    mobile: string;
    email: string;
    mailRole: "TO" | "CC";
    officeAddress: string;
  };

  const people: Person[] = [];

  if (project.clientContactName || project.clientEmail) {
    people.push({
      orgSection: "Client",
      orgName: project.clientName || "Client",
      personName: project.clientContactName || project.clientName || "Client contact",
      designation: "Client representative",
      company: project.clientName || "Client",
      mobile: project.clientPhone || "",
      email: project.clientEmail || "",
      mailRole: "TO",
      officeAddress: project.clientAddress || "",
    });
  }

  for (const m of members) {
    const orgSection = memberToSection(m.role, m.user.role);
    const orgName = orgSection === "PMC" ? PMC_ORG : orgSection === "Client" ? project.clientName || "Client" : m.user.fullName;
    people.push({
      orgSection,
      orgName,
      personName: m.user.fullName,
      designation: m.role.replace(/_/g, " "),
      company: orgName,
      mobile: m.user.phone || "",
      email: m.user.email,
      mailRole: orgSection === "Client" ? "TO" : "CC",
      officeAddress: "",
    });
  }

  for (const pv of projectVendors) {
    const v = pv.vendor;
    const orgSection = partyToSection(v.partyType);
    people.push({
      orgSection,
      orgName: v.name,
      personName: v.primaryContactName || v.name,
      designation: pv.tradeRole || v.trade || v.partyType,
      company: v.name,
      mobile: v.businessPhone || "",
      email: v.email || "",
      mailRole: orgSection === "Client" ? "TO" : "CC",
      officeAddress: [v.address, v.city, v.state].filter(Boolean).join(", "),
    });
  }

  const seenPeople = new Set<string>();
  const uniquePeople = people.filter((p) => {
    const key = contactKey(p.email, p.personName, p.orgSection);
    if (seenPeople.has(key) || (!p.email && !p.personName)) return false;
    seenPeople.add(key);
    return true;
  });

  const sections = new Set<OrgSection>(uniquePeople.map((p) => p.orgSection));
  if (sections.size === 0) {
    sections.add("Client");
    sections.add("PMC");
  }

  const result: SyncCommsResult = { created: 0, skipped: 0, headers: 0, technical: 0, commercial: 0 };

  for (const kind of KINDS) {
    const existing = await prisma.communicationContact.findMany({
      where: { projectId, matrixKind: kind },
    });
    const existingKeys = new Set(
      existing.filter((r) => !r.isSectionHeader).map((r) => contactKey(r.email, r.personName, r.orgSection))
    );
    const existingHeaders = new Set(
      existing.filter((r) => r.isSectionHeader).map((r) => `${r.orgSection}|${r.orgName}`.toLowerCase())
    );

    let maxSort = existing.reduce((n, r) => Math.max(n, r.sortOrder || 0), 0);

    for (const section of ["Client", "PMC", "Consultant", "Contractor", "Other"] as OrgSection[]) {
      if (!sections.has(section)) continue;
      const orgName =
        section === "PMC"
          ? PMC_ORG
          : section === "Client"
            ? project.clientName || "Client"
            : uniquePeople.find((p) => p.orgSection === section)?.orgName || section;
      const headerKey = `${section}|${orgName}`.toLowerCase();
      if (!existingHeaders.has(headerKey) && !existing.some((r) => r.isSectionHeader && r.orgSection === section)) {
        maxSort = Math.max(maxSort, sectionBase(section));
        await prisma.communicationContact.create({
          data: {
            projectId,
            matrixKind: kind,
            orgSection: section,
            orgName,
            isSectionHeader: true,
            sortOrder: sectionBase(section),
          },
        });
        result.created += 1;
        result.headers += 1;
        existingHeaders.add(headerKey);
      }
    }

    let offset = 0;
    for (const person of uniquePeople) {
      const key = contactKey(person.email, person.personName, person.orgSection);
      if (existingKeys.has(key)) {
        result.skipped += 1;
        continue;
      }
      offset += 1;
      await prisma.communicationContact.create({
        data: {
          projectId,
          matrixKind: kind,
          orgSection: person.orgSection,
          orgName: person.orgName,
          isSectionHeader: false,
          sortOrder: sectionBase(person.orgSection) + offset,
          personName: person.personName,
          designation: person.designation,
          company: person.company,
          spoc: person.personName,
          mobile: person.mobile || null,
          email: person.email || null,
          mailRole: person.mailRole,
          officeAddress: person.officeAddress || null,
        },
      });
      existingKeys.add(key);
      result.created += 1;
      if (kind === "TECHNICAL") result.technical += 1;
      else result.commercial += 1;
    }
  }

  return result;
}

const DEFAULT_SECTIONS: { orgSection: OrgSection; fallback: string }[] = [
  { orgSection: "Client", fallback: "Client" },
  { orgSection: "PMC", fallback: PMC_ORG },
  { orgSection: "Consultant", fallback: "Consultant" },
  { orgSection: "Contractor", fallback: "Contractor" },
];

/** Empty TECHNICAL + COMMERCIAL section headers so setup has a sheet to fill. */
export async function ensureMatrixScaffold(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found");
  let created = 0;
  const names: Record<OrgSection, string> = {
    Client: project.clientName || "Client",
    PMC: PMC_ORG,
    Consultant: project.designConsultant || "Consultant",
    Contractor: project.contractorName || "Contractor",
    Other: "Other",
  };
  for (const kind of KINDS) {
    for (const spec of DEFAULT_SECTIONS) {
      const orgName = names[spec.orgSection] || spec.fallback;
      const exists = await prisma.communicationContact.findFirst({
        where: { projectId, matrixKind: kind, isSectionHeader: true, orgSection: spec.orgSection },
      });
      if (exists) continue;
      await prisma.communicationContact.create({
        data: {
          projectId,
          matrixKind: kind,
          orgSection: spec.orgSection,
          orgName,
          isSectionHeader: true,
          sortOrder: sectionBase(spec.orgSection),
        },
      });
      created += 1;
    }
  }
  return { created };
}

export type SetupMatrixInput = {
  matrixKind?: "TECHNICAL" | "COMMERCIAL";
  bothMatrices?: boolean;
  orgSection?: string;
  orgName?: string;
  personName?: string;
  designation?: string;
  company?: string;
  spoc?: string;
  mobile?: string;
  email?: string;
  mailRole?: string;
  officeAddress?: string;
  /** none | user | vendor | both */
  createDirectory?: string;
  userRole?: string;
  vendorPartyType?: string;
};

function sectionFromParty(section: string, partyType?: string): OrgSection {
  const raw = partyType || section || "Other";
  if (raw === "Client" || raw === "PMC" || raw === "Consultant" || raw === "Contractor" || raw === "Other") return raw;
  if (raw === "Designer") return "Consultant";
  if (raw === "Vendor") return "Contractor";
  return "Other";
}

function defaultPartyType(section: OrgSection): string {
  if (section === "Client") return "Client";
  if (section === "Consultant") return "Consultant";
  if (section === "PMC") return "PMC";
  if (section === "Contractor") return "Contractor";
  return "Vendor";
}

function defaultUserRole(section: OrgSection, requested?: string): "client" | "vendor" | "site_employee" | "office" | "employee" {
  if (requested === "client" || requested === "vendor" || requested === "site_employee" || requested === "office" || requested === "employee") {
    return requested;
  }
  if (section === "Client") return "client";
  if (section === "Contractor") return "vendor";
  if (section === "Consultant") return "employee";
  return "site_employee";
}

/** Add a filled matrix row (and optionally the matching user / vendor) during project setup. */
export async function addSetupMatrixContact(projectId: string, body: SetupMatrixInput) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found");
  await ensureMatrixScaffold(projectId);

  const orgSection = sectionFromParty(String(body.orgSection || "Other"));
  const orgName = String(body.orgName || body.company || orgSection).trim() || orgSection;
  const personName = String(body.personName || "").trim();
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const designation = String(body.designation || "").trim();
  const company = String(body.company || orgName).trim();
  const spoc = String(body.spoc || personName).trim();
  const mobile = String(body.mobile || "").trim();
  const mailRole = body.mailRole === "TO" ? "TO" : "CC";
  const officeAddress = String(body.officeAddress || "").trim();
  if (!personName && !email) throw new Error("Name or email required");

  const kinds: Array<(typeof KINDS)[number]> = body.bothMatrices
    ? [...KINDS]
    : [body.matrixKind === "COMMERCIAL" ? "COMMERCIAL" : "TECHNICAL"];

  const contacts: { id: string; matrixKind: string; created: boolean }[] = [];
  for (const kind of kinds) {
    const existing = email
      ? await prisma.communicationContact.findFirst({
          where: { projectId, matrixKind: kind, email, isSectionHeader: false },
        })
      : await prisma.communicationContact.findFirst({
          where: { projectId, matrixKind: kind, personName, orgSection, isSectionHeader: false },
        });
    if (existing) {
      const updated = await prisma.communicationContact.update({
        where: { id: existing.id },
        data: {
          orgSection,
          orgName,
          personName: personName || existing.personName,
          designation: designation || existing.designation,
          company: company || existing.company,
          spoc: spoc || existing.spoc,
          mobile: mobile || existing.mobile,
          email: email || existing.email,
          mailRole,
          officeAddress: officeAddress || existing.officeAddress,
        },
      });
      contacts.push({ id: updated.id, matrixKind: kind, created: false });
      continue;
    }
    const count = await prisma.communicationContact.count({ where: { projectId, matrixKind: kind, orgSection } });
    const row = await prisma.communicationContact.create({
      data: {
        projectId,
        matrixKind: kind,
        orgSection,
        orgName,
        isSectionHeader: false,
        sortOrder: sectionBase(orgSection) + count + 1,
        personName: personName || null,
        designation: designation || null,
        company: company || null,
        spoc: spoc || null,
        mobile: mobile || null,
        email: email || null,
        mailRole,
        officeAddress: officeAddress || null,
      },
    });
    contacts.push({ id: row.id, matrixKind: kind, created: true });
  }

  const createDirectory = String(body.createDirectory || "none");
  let directory: {
    user?: { userId: string; email: string; created: boolean; tempPassword?: string; role: string };
    vendor?: { vendorId: string; created: boolean; name: string };
  } = {};

  if ((createDirectory === "user" || createDirectory === "both") && email) {
    const { ensurePortalLogin } = await import("./crmVendorCredentials.js");
    const role = defaultUserRole(orgSection, body.userRole);
    const login = await ensurePortalLogin({
      email,
      fullName: personName || email.split("@")[0],
      role,
      phone: mobile,
    });
    if (login) {
      await prisma.projectMember.upsert({
        where: { projectId_userId: { projectId, userId: login.userId } },
        create: { projectId, userId: login.userId, role: orgSection === "Client" ? "client" : orgSection === "Contractor" ? "vendor" : "member" },
        update: {},
      });
      directory.user = login;
    }
  }

  if (createDirectory === "vendor" || createDirectory === "both") {
    const partyType = ["Contractor", "Vendor", "Client", "Consultant", "PMC", "Designer"].includes(String(body.vendorPartyType || ""))
      ? String(body.vendorPartyType)
      : defaultPartyType(orgSection);
    let vendor = email
      ? await prisma.vendor.findFirst({ where: { email } })
      : await prisma.vendor.findFirst({ where: { name: company || orgName } });
    let vendorCreated = false;
    if (!vendor) {
      vendor = await prisma.vendor.create({
        data: {
          name: company || orgName,
          partyType,
          trade: designation || null,
          email: email || null,
          businessPhone: mobile || null,
          primaryContactName: personName || null,
          address: officeAddress || null,
          createdVia: "Project setup matrix",
        },
      });
      vendorCreated = true;
    }
    await prisma.projectVendor.upsert({
      where: { projectId_vendorId: { projectId, vendorId: vendor.id } },
      create: { projectId, vendorId: vendor.id, tradeRole: designation || null, assignedVia: "Project setup matrix" },
      update: { tradeRole: designation || undefined },
    });
    if (partyType === "Client" && email && !project.clientEmail) {
      await prisma.project.update({
        where: { id: projectId },
        data: {
          clientName: project.clientName || company || orgName,
          clientEmail: email,
          clientContactName: project.clientContactName || personName,
          clientPhone: project.clientPhone || mobile || null,
          clientAddress: project.clientAddress || officeAddress || null,
        },
      });
    }
    directory.vendor = { vendorId: vendor.id, created: vendorCreated, name: vendor.name };
  }

  return { contacts, directory, orgSection, personName, email };
}
