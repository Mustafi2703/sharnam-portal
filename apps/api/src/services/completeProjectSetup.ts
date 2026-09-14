/**
 * End-to-end project setup: ISO folders, sheet pack, comms matrix,
 * client + contractor portals, first DPR/WPR drafts.
 */
import { prisma } from "../prisma.js";
import { mockOneDrive } from "./mockOneDrive.js";
import { seedStandardCommsMatrix } from "./commsMatrixSeed.js";
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

  const matrixCreated = await seedStandardCommsMatrix(projectId);
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
    !project.status || project.status === "Planning" || project.status === "Draft" || project.status === "Active"
      ? "In Progress"
      : project.status;
  if (nextStatus !== project.status) {
    await prisma.project.update({ where: { id: projectId }, data: { status: nextStatus } });
  }

  return {
    projectId,
    status: nextStatus,
    folders: { root: folders.root, count: folders.folders.length, provider: folders.provider },
    sheets: { ok: true, steps: [] },
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
      workPackages: true,
    },
  });
  if (!project) return null;

  let packages: string[] = [];
  try {
    packages = JSON.parse(project.workPackages || "[]");
  } catch {
    packages = [];
  }

  const [memberCount, vendorCount, matrixCount, contactCount] = await Promise.all([
    prisma.projectMember.count({ where: { projectId } }),
    prisma.projectVendor.count({ where: { projectId } }),
    prisma.communicationMatrix.count({ where: { projectId } }),
    prisma.communicationContact.count({ where: { projectId, isSectionHeader: false } }),
  ]);

  const checks: SetupCheck[] = [
    {
      key: "card",
      ok: Boolean(project.name && project.location && project.clientName),
      label: "Project card",
      detail:
        project.name && project.location && project.clientName
          ? `${project.code} · ${project.clientName} · ${project.location}`
          : "Save name, client, and site location",
    },
    {
      key: "packages",
      ok: packages.length > 0,
      label: "Work packages",
      detail: packages.length ? packages.join(", ") : "Pick Civil / PEB / Electrical (or your list) on the project card",
    },
    {
      key: "directory",
      ok: memberCount > 0,
      label: "Employees assigned",
      detail: memberCount ? `${memberCount} people from the staff list · ${vendorCount} companies` : "Select staff from the list",
    },
    {
      key: "comms",
      ok: contactCount > 0 || matrixCount > 0,
      optional: true,
      label: "Communication matrix",
      detail: contactCount || matrixCount
        ? `${matrixCount} role flows · ${contactCount} contacts`
        : "Add the people who should receive project mail — only those you pick",
    },
  ];

  return {
    project,
    checks,
    ready: checks.filter((c) => !c.optional).every((c) => c.ok),
    counts: { folders: 0, members: memberCount, vendors: vendorCount, matrix: matrixCount, contacts: contactCount },
  };
}
