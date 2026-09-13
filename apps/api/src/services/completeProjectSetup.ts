/**
 * End-to-end project setup: ISO folders, sheet pack, comms matrix,
 * client + contractor portals, first DPR/WPR drafts.
 */
import { prisma } from "../prisma.js";
import { mockOneDrive } from "./mockOneDrive.js";
import { PROJECT_LIBRARY_FOLDERS } from "./graph.js";
import { provisionProjectSheetPack } from "./projectSheetPack.js";
import { seedArvindCommsMatrix, seedStandardCommsMatrix } from "./commsMatrixSeed.js";
import { ensureMatrixScaffold, syncCommsContactsFromDirectory } from "./syncCommsFromDirectory.js";
import { initializeProjectReports, type InitReportsResult } from "./initializeProjectReports.js";
import {
  provisionCompanyAccess,
  provisionProjectClientEmail,
  type PortalLoginResult,
} from "./crmVendorCredentials.js";

export type SetupCheck = {
  key: string;
  ok: boolean;
  label: string;
  detail?: string;
  optional?: boolean;
};

export async function completeProjectSetup(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: { include: { user: { select: { id: true, email: true, fullName: true, role: true } } } },
      vendors: { include: { vendor: true } },
    },
  });
  if (!project) throw new Error("Project not found");

  const folders = await mockOneDrive.ensureProjectTree(projectId);

  let sheets: Awaited<ReturnType<typeof provisionProjectSheetPack>> | null = null;
  try {
    sheets = await provisionProjectSheetPack(projectId, userId);
  } catch (err) {
    console.error("Sheet pack failed:", err instanceof Error ? err.message : err);
  }

  const arvindSite = /arvind/i.test(project.code) || /arvind/i.test(project.clientName || "") || /ntx/i.test(project.name);
  const matrixCreated = arvindSite
    ? await seedArvindCommsMatrix(projectId)
    : await seedStandardCommsMatrix(projectId);
  await ensureMatrixScaffold(projectId);
  const contacts = await syncCommsContactsFromDirectory(projectId);

  const clientPortals: PortalLoginResult[] = [];
  const contractorPortals: PortalLoginResult[] = [];
  const stakeholderPortals: PortalLoginResult[] = [];

  if (project.clientEmail) {
    const login = await provisionProjectClientEmail({
      projectId,
      email: project.clientEmail,
      name: project.clientContactName || project.clientName || project.name,
      phone: project.clientPhone,
    });
    if (login) clientPortals.push(login);
  }

  for (const pv of project.vendors) {
    const v = pv.vendor;
    if (!v.email) continue;
    const login = await provisionCompanyAccess({
      projectId,
      vendor: v,
      assignedVia: "Complete setup",
    });
    if (!login) continue;
    if (v.partyType === "Client") clientPortals.push(login);
    else if (v.partyType === "Consultant" || v.partyType === "Designer" || v.partyType === "PMC") {
      stakeholderPortals.push(login);
    } else contractorPortals.push(login);
  }

  const firstContractor = project.vendors.find((pv) => pv.vendor.partyType === "Contractor")?.vendor;
  if (firstContractor && !project.contractorName) {
    await prisma.project.update({
      where: { id: projectId },
      data: { contractorName: firstContractor.name },
    });
  }

  let reports: InitReportsResult;
  try {
    reports = await initializeProjectReports(projectId, userId);
  } catch (err) {
    console.warn("First DPR/WPR seed skipped:", err instanceof Error ? err.message : err);
    reports = {
      dpr: { created: false, id: "", logDate: "", discipline: "", status: "skipped" },
      wpr: { created: false, id: "", weekEnding: "", status: "skipped" },
    };
  }

  const nextStatus =
    !project.status || project.status === "Planning" || project.status === "Draft" ? "Active" : project.status;
  if (nextStatus !== project.status) {
    await prisma.project.update({ where: { id: projectId }, data: { status: nextStatus } });
  }

  const { emailPortalCredentials, emailProjectSetupBrief } = await import("./portalInvites.js");
  for (const portal of [...clientPortals, ...contractorPortals, ...stakeholderPortals]) {
    if (!portal.tempPassword) continue;
    try {
      await emailPortalCredentials({
        projectId,
        createdById: userId,
        email: portal.email,
        fullName: portal.email,
        role: portal.role,
        password: portal.tempPassword,
      });
    } catch (err) {
      console.warn("Portal invite email failed:", portal.email, err instanceof Error ? err.message : err);
    }
  }

  try {
    await emailProjectSetupBrief({
      projectId,
      createdById: userId,
      extraTo: ["baibhabmustafi@gmail.com"],
    });
  } catch (err) {
    console.warn("Project setup brief failed:", err instanceof Error ? err.message : err);
  }

  return {
    projectId,
    status: nextStatus,
    folders: { root: folders.root, count: folders.folders.length, provider: folders.provider },
    sheets: sheets
      ? { ok: sheets.steps.every((s) => s.ok), steps: sheets.steps.map((s) => ({ key: s.key, ok: s.ok, skipped: s.skipped })) }
      : { ok: false, steps: [] },
    comms: { roleFlowsCreated: matrixCreated, contacts },
    clientPortals: clientPortals.map((p) => ({ email: p.email, created: p.created, tempPassword: p.tempPassword })),
    contractorPortals: contractorPortals.map((p) => ({ email: p.email, created: p.created, tempPassword: p.tempPassword })),
    stakeholderPortals: stakeholderPortals.map((p) => ({ email: p.email, created: p.created, tempPassword: p.tempPassword })),
    reports,
  };
}

export async function getProjectSetupStatus(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      clientName: true,
      clientEmail: true,
      clientContactName: true,
      location: true,
      contractorName: true,
      pmcName: true,
    },
  });
  if (!project) return null;

  const [
    folderCount,
    memberCount,
    vendorCount,
    matrixCount,
    contactCount,
    clientMembers,
    vendorMembers,
    projectVendors,
    signedMembers,
    signedVendors,
  ] = await Promise.all([
    prisma.documentFolder.count({ where: { projectId } }),
    prisma.projectMember.count({ where: { projectId } }),
    prisma.projectVendor.count({ where: { projectId } }),
    prisma.communicationMatrix.count({ where: { projectId } }),
    prisma.communicationContact.count({ where: { projectId, isSectionHeader: false } }),
    prisma.projectMember.findMany({
      where: { projectId, user: { role: "client" } },
      include: { user: { select: { email: true, fullName: true } } },
    }),
    prisma.projectMember.findMany({
      where: { projectId, user: { role: "vendor" } },
      include: { user: { select: { email: true, fullName: true } } },
    }),
    prisma.projectVendor.findMany({
      where: { projectId },
      include: { vendor: { select: { partyType: true, email: true, name: true } } },
    }),
    prisma.projectMember.count({ where: { projectId, signatureUrl: { not: null } } }),
    prisma.projectVendor.count({ where: { projectId, signatureUrl: { not: null } } }),
  ]);

  const contractors = projectVendors.filter((pv) => pv.vendor.partyType === "Contractor" || pv.vendor.partyType === "Vendor");
  const contractorPortalOk = contractors.length === 0 || vendorMembers.length > 0 || contractors.some((c) => !c.vendor.email);

  const checks: SetupCheck[] = [
    {
      key: "card",
      ok: Boolean(project.name && project.location && project.clientName),
      label: "Project card saved",
      detail:
        project.name && project.location && project.clientName
          ? `${project.code} · ${project.clientName} · ${project.location}`
          : "Save name, client organisation, and site location on the project card",
    },
    {
      key: "folders",
      ok: folderCount > 0,
      label: "ISO folder structure",
      detail: folderCount ? `${folderCount} folders (target ${PROJECT_LIBRARY_FOLDERS.length})` : "Not created yet",
    },
    {
      key: "directory",
      ok: memberCount > 0,
      label: "People assigned",
      detail: `${memberCount} members · ${vendorCount} companies`,
    },
    {
      key: "comms",
      ok: true,
      optional: true,
      label: "Communication matrix (optional)",
      detail: contactCount
        ? `${matrixCount} role flows · ${contactCount} BPCL contacts — editable in setup and Comms`
        : "Optional — add BPCL TECHNICAL / COMMERCIAL people now or later in Comms",
    },
    {
      key: "clientPortal",
      ok: clientMembers.length > 0 || !project.clientEmail,
      label: "Client portal",
      detail: clientMembers.length
        ? clientMembers.map((m) => m.user.email).join(", ")
        : project.clientEmail
          ? "Client email set — run Complete setup"
          : "Add a client contact email",
    },
    {
      key: "contractorPortal",
      ok: contractorPortalOk,
      label: "Contractor portal",
      detail: vendorMembers.length
        ? vendorMembers.map((m) => m.user.email).join(", ")
        : contractors.length
          ? "Assign contractors with emails, then Complete setup"
          : "No contractor assigned yet",
    },
    {
      key: "signatures",
      ok: true,
      optional: true,
      label: "Directory signatures (optional)",
      detail:
        signedMembers + signedVendors > 0
          ? `${signedMembers} people · ${signedVendors} companies signed`
          : "Optional — add PMC / client / contractor signatures later if you need signed checklists or WPR export",
    },
  ];

  return {
    project,
    checks,
    ready: checks.filter((c) => !c.optional).every((c) => c.ok),
    counts: { folders: folderCount, members: memberCount, vendors: vendorCount, matrix: matrixCount, contacts: contactCount },
  };
}
