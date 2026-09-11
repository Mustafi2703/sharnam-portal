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
import { initializeProjectReports } from "./initializeProjectReports.js";
import { ensureClientPortalLogin, ensureVendorPortalLogin, type PortalLoginResult } from "./crmVendorCredentials.js";

export type SetupCheck = {
  key: string;
  ok: boolean;
  label: string;
  detail?: string;
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

  async function assignMember(loginUserId: string, role: string) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId: loginUserId } },
      create: { projectId, userId: loginUserId, role },
      update: { role },
    });
  }

  if (project.clientEmail) {
    const login = await ensureClientPortalLogin({
      email: project.clientEmail,
      name: project.clientContactName || project.clientName || project.name,
      businessPhone: project.clientPhone,
    });
    if (login) {
      await assignMember(login.userId, "client");
      clientPortals.push(login);
    }
  }

  for (const pv of project.vendors) {
    const v = pv.vendor;
    if (!v.email) continue;
    if (v.partyType === "Client") {
      const login = await ensureClientPortalLogin({
        email: v.email,
        name: v.primaryContactName || v.name,
        businessPhone: v.businessPhone,
      });
      if (login) {
        await assignMember(login.userId, "client");
        clientPortals.push(login);
      }
      continue;
    }
    if (v.partyType === "Contractor" || v.partyType === "Vendor") {
      const login = await ensureVendorPortalLogin({
        email: v.email,
        name: v.name,
        businessPhone: v.businessPhone,
        vendorId: v.id,
      });
      if (login) {
        await assignMember(login.userId, "vendor");
        contractorPortals.push(login);
      }
    }
  }

  const firstContractor = project.vendors.find((pv) => pv.vendor.partyType === "Contractor")?.vendor;
  if (firstContractor && !project.contractorName) {
    await prisma.project.update({
      where: { id: projectId },
      data: { contractorName: firstContractor.name },
    });
  }

  const reports = await initializeProjectReports(projectId, userId);

  const { emailPortalCredentials } = await import("./portalInvites.js");
  for (const portal of [...clientPortals, ...contractorPortals]) {
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

  return {
    projectId,
    folders: { root: folders.root, count: folders.folders.length, provider: folders.provider },
    sheets: sheets
      ? { ok: sheets.steps.every((s) => s.ok), steps: sheets.steps.map((s) => ({ key: s.key, ok: s.ok, skipped: s.skipped })) }
      : { ok: false, steps: [] },
    comms: { roleFlowsCreated: matrixCreated, contacts },
    clientPortals: clientPortals.map((p) => ({ email: p.email, created: p.created, tempPassword: p.tempPassword })),
    contractorPortals: contractorPortals.map((p) => ({ email: p.email, created: p.created, tempPassword: p.tempPassword })),
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
      contractorName: true,
    },
  });
  if (!project) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date();
  weekEnd.setHours(23, 59, 59, 999);
  const day = weekEnd.getDay();
  if (day !== 0) weekEnd.setDate(weekEnd.getDate() + (7 - day));

  const [
    folderCount,
    memberCount,
    vendorCount,
    matrixCount,
    contactCount,
    clientMembers,
    vendorMembers,
    dpr,
    wpr,
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
    prisma.dprSnapshot.findFirst({
      where: { projectId },
      orderBy: { logDate: "desc" },
      select: { id: true, logDate: true, discipline: true, status: true },
    }),
    prisma.wprSnapshot.findFirst({
      where: { projectId },
      orderBy: { weekEnding: "desc" },
      select: { id: true, weekEnding: true, status: true },
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
      key: "dpr",
      ok: Boolean(dpr),
      label: "DPR pack",
      detail: dpr
        ? `${dpr.discipline} ${dpr.logDate.toISOString().slice(0, 10)} · ${dpr.status}`
        : "Not generated yet",
    },
    {
      key: "wpr",
      ok: Boolean(wpr),
      label: "WPR pack",
      detail: wpr ? `Week ending ${wpr.weekEnding.toISOString().slice(0, 10)} · ${wpr.status}` : "Not generated yet",
    },
    {
      key: "signatures",
      ok: signedMembers + signedVendors > 0,
      label: "Directory signatures",
      detail:
        signedMembers + signedVendors > 0
          ? `${signedMembers} people · ${signedVendors} companies signed`
          : "Missing — add PMC / client / contractor signatures on project admin before checklists and WPR export",
    },
  ];

  return {
    project,
    checks,
    ready: checks.filter((c) => c.key !== "signatures").every((c) => c.ok),
    counts: { folders: folderCount, members: memberCount, vendors: vendorCount, matrix: matrixCount, contacts: contactCount },
  };
}
