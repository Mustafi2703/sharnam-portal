/**
 * Import project directory (members + vendors) into the in-project
 * CommunicationContact matrices (TECHNICAL + COMMERCIAL). Idempotent.
 */
import { prisma } from "../prisma.js";

const KINDS = ["TECHNICAL", "COMMERCIAL"] as const;
const PMC_ORG = "Sharnam Project Development Consultants & Co.";

function pmcOrgName(project: { pmcName?: string | null }) {
  return (project.pmcName || "").trim() || PMC_ORG;
}

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
  const { retireOperationsMailbox } = await import("./pruneDemoUsers.js");
  await retireOperationsMailbox(prisma);
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

  const memberUserIds = members.map((m) => m.userId);
  const profiles = memberUserIds.length
    ? await prisma.employeeProfile.findMany({
        where: { userId: { in: memberUserIds } },
        select: { userId: true, designation: true },
      })
    : [];
  const companyRoleByUser = new Map(profiles.map((p) => [p.userId, (p.designation || "").trim()]));

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
  const linkedClient = projectVendors.find((pv) => pv.vendor.partyType === "Client")?.vendor;
  const clientCompany = (project.clientName || linkedClient?.name || "").trim();

  if (clientCompany && (project.clientContactName || project.clientEmail)) {
    people.push({
      orgSection: "Client",
      orgName: clientCompany,
      personName: project.clientContactName || clientCompany,
      designation: "",
      company: clientCompany,
      mobile: project.clientPhone || linkedClient?.businessPhone || "",
      email: project.clientEmail || "",
      mailRole: "TO",
      officeAddress: project.clientAddress || [linkedClient?.address, linkedClient?.city].filter(Boolean).join(", "),
    });
  }

  for (const m of members) {
    if (m.user.email.trim().toLowerCase() === "operations@spdc.in") continue;
    const orgSection = memberToSection(m.role, m.user.role);
    const orgName = orgSection === "PMC" ? pmcOrgName(project) : orgSection === "Client" ? clientCompany || m.user.fullName : m.user.fullName;
    const companyRole = companyRoleByUser.get(m.userId) || "";
    people.push({
      orgSection,
      orgName,
      personName: m.user.fullName,
      designation: orgSection === "PMC" ? companyRole : "",
      company: orgName,
      mobile: m.user.phone || "",
      email: m.user.email,
      mailRole: orgSection === "Client" ? "TO" : "CC",
      officeAddress: "",
    });
  }

  const companyOnly: { orgSection: OrgSection; company: string; officeAddress: string }[] = [];
  for (const pv of projectVendors) {
    const v = pv.vendor;
    const orgSection = partyToSection(v.partyType);
    if (!v.primaryContactName?.trim() && !v.email?.trim()) {
      companyOnly.push({ orgSection, company: v.name, officeAddress: [v.address, v.city, v.state].filter(Boolean).join(", ") });
      continue;
    }
    people.push({
      orgSection,
      orgName: v.name,
      personName: v.primaryContactName || v.name,
      designation: "",
      company: v.name,
      mobile: v.businessPhone || "",
      email: v.email || "",
      mailRole: orgSection === "Client" ? "TO" : "CC",
      officeAddress: [v.address, v.city, v.state].filter(Boolean).join(", "),
    });
  }

  const contractorVendorIds = projectVendors
    .filter((pv) => pv.vendor.partyType === "Contractor" || pv.vendor.partyType === "Vendor")
    .map((pv) => pv.vendorId);
  if (contractorVendorIds.length) {
    const reps = await prisma.vendorContact.findMany({
      where: { vendorId: { in: contractorVendorIds } },
      include: { vendor: { select: { name: true, address: true, city: true, state: true } } },
    });
    for (const rep of reps) {
      people.push({
        orgSection: "Contractor",
        orgName: rep.vendor.name,
        personName: rep.fullName || rep.email,
        designation: rep.role?.trim() || "",
        company: rep.vendor.name,
        mobile: "",
        email: rep.email,
        mailRole: "CC",
        officeAddress: [rep.vendor.address, rep.vendor.city, rep.vendor.state].filter(Boolean).join(", "),
      });
    }
  }

  const directoryVendorIds = projectVendors.map((pv) => pv.vendorId);
  if (directoryVendorIds.length) {
    const reps = await prisma.vendorContact.findMany({
      where: { vendorId: { in: directoryVendorIds } },
      include: { vendor: { select: { name: true, partyType: true, address: true, city: true, state: true } } },
    });
    for (const rep of reps) {
      const orgSection = partyToSection(rep.vendor.partyType);
      if (!rep.fullName?.trim() && !rep.email?.trim()) continue;
      people.push({
        orgSection,
        orgName: rep.vendor.name,
        personName: rep.fullName || rep.email,
        designation: rep.role?.trim() || "",
        company: rep.vendor.name,
        mobile: "",
        email: rep.email,
        mailRole: orgSection === "Client" ? "TO" : "CC",
        officeAddress: [rep.vendor.address, rep.vendor.city, rep.vendor.state].filter(Boolean).join(", "),
      });
    }
  }

  const seenPeople = new Set<string>();
  const uniquePeople = people.filter((p) => {
    const key = contactKey(p.email, p.personName, p.orgSection);
    if (seenPeople.has(key) || (!p.email && !p.personName)) return false;
    seenPeople.add(key);
    return true;
  });

  const result: SyncCommsResult = { created: 0, skipped: 0, headers: 0, technical: 0, commercial: 0 };

  for (const kind of KINDS) {
    const existing = await prisma.communicationContact.findMany({
      where: { projectId, matrixKind: kind },
    });
    const existingKeys = new Set(
      existing.filter((r) => !r.isSectionHeader).map((r) => contactKey(r.email, r.personName, r.orgSection))
    );

    const nextSort = new Map<string, number>();
    const sortFor = (section: OrgSection) => {
      if (!nextSort.has(section)) {
        const max = existing
          .filter((r) => (r.orgSection || "Other") === section)
          .reduce((m, r) => Math.max(m, r.sortOrder ?? 0), sectionBase(section));
        nextSort.set(section, max);
      }
      const n = (nextSort.get(section) || 0) + 1;
      nextSort.set(section, n);
      return n;
    };
    for (const person of uniquePeople) {
      const key = contactKey(person.email, person.personName, person.orgSection);
      if (existingKeys.has(key)) {
        const row = existing.find(
          (r) => !r.isSectionHeader && contactKey(r.email, r.personName, r.orgSection) === key,
        );
        if (row) {
          const patch: { designation?: string; mobile?: string; company?: string; orgName?: string } = {};
          if (person.orgSection === "PMC" && person.designation) {
            const current = (row.designation || "").trim().toLowerCase();
            const generic = ["", "member", "team member", "site engineer", "quality lead", "viewer", "project manager"].includes(current);
            if (generic && current !== person.designation.trim().toLowerCase()) patch.designation = person.designation;
          }
          const seededMobiles = new Set(["8160757201", "9106945294", "+919876543210", "9876543210"]);
          const digits = (value: string) => value.replace(/[^\d]/g, "");
          const rowDigits = digits(row.mobile || "");
          const nextDigits = digits(person.mobile || "");
          if (nextDigits && rowDigits !== nextDigits && (!rowDigits || seededMobiles.has(rowDigits))) {
            patch.mobile = person.mobile;
          }
          const companyNow = (row.company || "").trim().toLowerCase();
          const sectionWord = person.orgSection.toLowerCase();
          if (person.company && person.company.toLowerCase() !== sectionWord && (companyNow === sectionWord || !companyNow)) {
            patch.company = person.company;
            patch.orgName = person.orgName;
          }
          if (Object.keys(patch).length) {
            await prisma.communicationContact.update({ where: { id: row.id }, data: patch });
          }
        }
        result.skipped += 1;
        continue;
      }
      await prisma.communicationContact.create({
        data: {
          projectId,
          matrixKind: kind,
          orgSection: person.orgSection,
          orgName: person.orgName,
          isSectionHeader: false,
          sortOrder: sortFor(person.orgSection),
          personName: person.personName,
          designation: person.designation,
          company: person.company,
          spoc: null,
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

    const companies = new Map<string, { orgSection: OrgSection; company: string; officeAddress: string }>();
    for (const c of [...uniquePeople.map((p) => ({ orgSection: p.orgSection, company: p.company || p.orgName, officeAddress: p.officeAddress })), ...companyOnly]) {
      const k = `${c.orgSection}|${c.company.trim().toLowerCase()}`;
      if (c.company.trim() && !companies.has(k)) companies.set(k, c);
    }
    const before = await prisma.communicationContact.count({ where: { projectId, matrixKind: kind, isSectionHeader: true } });
    for (const c of companies.values()) {
      const headerId = await ensureCompanyHeader(projectId, kind, c.orgSection, c.company);
      if (c.officeAddress) {
        await prisma.communicationContact.updateMany({ where: { id: headerId, officeAddress: null }, data: { officeAddress: c.officeAddress } });
      }
    }
    result.headers += (await prisma.communicationContact.count({ where: { projectId, matrixKind: kind, isSectionHeader: true } })) - before;
  }

  return result;
}

/** Section-header row for one company on one matrix sheet (holds the company SPOC and office address). */
export async function ensureCompanyHeader(projectId: string, kind: string, orgSection: string, company: string) {
  const { buildMatrixBlocks, matrixSectionOf, matrixCompanyKey } = await import("@sharnam/shared");
  const section = matrixSectionOf(orgSection);
  const name = company.trim() || section;
  const key = matrixCompanyKey(name);
  const rows = await prisma.communicationContact.findMany({ where: { projectId, matrixKind: kind } });
  const block = buildMatrixBlocks(rows, { keepEmpty: true }).find(
    (b) => b.orgSection === section && (section === "PMC" || matrixCompanyKey(b.company) === key || b.key === `${section}|${key}`),
  );
  if (block?.headerId) return block.headerId;
  const firstSort = block ? Math.min(...[...block.people, ...block.placeholders].map((r) => r.sortOrder ?? 0)) : null;
  const header = await prisma.communicationContact.create({
    data: {
      projectId,
      matrixKind: kind,
      orgSection: section,
      orgName: block?.company || name,
      isSectionHeader: true,
      sortOrder: firstSort != null && Number.isFinite(firstSort) ? firstSort : sectionBase(section as OrgSection),
    },
  });
  return header.id;
}

export type MatrixCompanyInput = {
  matrixKind?: string;
  bothMatrices?: boolean;
  orgSection: string;
  company: string;
  newCompany?: string;
  spoc?: string;
  officeAddress?: string;
};

/** Company-level fields (name, SPOC, office address) written once on the header and onto every person row of the company. */
export async function saveMatrixCompany(projectId: string, input: MatrixCompanyInput) {
  const { buildMatrixBlocks, matrixSectionOf, matrixCompanyKey } = await import("@sharnam/shared");
  const section = matrixSectionOf(input.orgSection);
  const kinds = input.bothMatrices ? [...KINDS] : [input.matrixKind === "COMMERCIAL" ? "COMMERCIAL" : "TECHNICAL"];
  const rename = String(input.newCompany ?? "").trim();
  const spoc = input.spoc !== undefined ? String(input.spoc).trim() : undefined;
  const officeAddress = input.officeAddress !== undefined ? String(input.officeAddress).trim() : undefined;
  let updated = 0;
  for (const kind of kinds) {
    const rows = await prisma.communicationContact.findMany({ where: { projectId, matrixKind: kind } });
    const key = matrixCompanyKey(input.company);
    const block = buildMatrixBlocks(rows, { keepEmpty: true }).find(
      (b) => b.orgSection === section && (section === "PMC" || matrixCompanyKey(b.company) === key || b.key === `${section}|${key}`),
    );
    if (!block && kind !== kinds[0]) continue;
    const headerId = block?.headerId || (await ensureCompanyHeader(projectId, kind, section, input.company));
    await prisma.communicationContact.update({
      where: { id: headerId },
      data: {
        ...(rename ? { orgName: rename } : {}),
        ...(spoc !== undefined ? { spoc: spoc || null } : {}),
        ...(officeAddress !== undefined ? { officeAddress: officeAddress || null } : {}),
      },
    });
    const ids = block ? [...block.people, ...block.placeholders].map((r) => r.id) : [];
    if (ids.length) {
      const out = await prisma.communicationContact.updateMany({
        where: { id: { in: ids } },
        data: {
          ...(rename ? { company: rename, orgName: rename } : {}),
          ...(spoc !== undefined ? { spoc: spoc || null } : {}),
          ...(officeAddress !== undefined ? { officeAddress: officeAddress || null } : {}),
        },
      });
      updated += out.count;
    }
  }
  return { updated };
}

/** Remove a whole company block (its heading, people and company-only rows) from one or both matrix sheets. */
export async function deleteMatrixCompany(projectId: string, input: { matrixKind?: string; bothMatrices?: boolean; orgSection: string; company: string }) {
  const { buildMatrixBlocks, matrixSectionOf, matrixCompanyKey } = await import("@sharnam/shared");
  const section = matrixSectionOf(input.orgSection);
  const key = matrixCompanyKey(input.company);
  const kinds = input.bothMatrices ? [...KINDS] : [input.matrixKind === "COMMERCIAL" ? "COMMERCIAL" : "TECHNICAL"];
  let deleted = 0;
  for (const kind of kinds) {
    const rows = await prisma.communicationContact.findMany({ where: { projectId, matrixKind: kind } });
    const block = buildMatrixBlocks(rows, { keepEmpty: true }).find(
      (b) => b.orgSection === section && (section === "PMC" || matrixCompanyKey(b.company) === key || b.key === `${section}|${key}`),
    );
    if (!block) continue;
    const ids = [...block.headerIds, ...block.people.map((r) => r.id), ...block.placeholders.map((r) => r.id)];
    const out = await prisma.communicationContact.deleteMany({ where: { projectId, id: { in: ids } } });
    deleted += out.count;
  }
  return { deleted };
}

/** Empty the matrix down to its teams: one header row per company, no people, no duplicate headers. */
export async function clearMatrixToTeams(projectId: string, input: { matrixKind?: string; bothMatrices?: boolean }) {
  const { buildMatrixBlocks } = await import("@sharnam/shared");
  const kinds = input.bothMatrices ? [...KINDS] : [input.matrixKind === "COMMERCIAL" ? "COMMERCIAL" : "TECHNICAL"];
  let deleted = 0;
  let teams = 0;
  for (const kind of kinds) {
    const rows = await prisma.communicationContact.findMany({ where: { projectId, matrixKind: kind } });
    const ids: string[] = [];
    for (const block of buildMatrixBlocks(rows, { keepEmpty: true })) {
      if (!block.headerId) await ensureCompanyHeader(projectId, kind, block.orgSection, block.company);
      ids.push(...block.headerIds.slice(1), ...block.people.map((r) => r.id), ...block.placeholders.map((r) => r.id));
      teams += 1;
    }
    if (ids.length) deleted += (await prisma.communicationContact.deleteMany({ where: { projectId, id: { in: ids } } })).count;
  }
  return { deleted, teams };
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
    PMC: pmcOrgName(project),
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

  const orgSection = sectionFromParty(String(body.orgSection || "Other"));
  const orgName = String(body.orgName || body.company || orgSection).trim() || orgSection;
  const personName = String(body.personName || "").trim();
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const designation = String(body.designation || "").trim();
  const company = String(body.company || orgName).trim();
  const spoc = String(body.spoc || "").trim();
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
  for (const kind of kinds) {
    const headerId = await ensureCompanyHeader(projectId, kind, orgSection, company || orgName);
    if (officeAddress) await prisma.communicationContact.updateMany({ where: { id: headerId, officeAddress: null }, data: { officeAddress } });
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
