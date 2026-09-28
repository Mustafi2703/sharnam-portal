import fs from "fs";
import path from "path";
import { mockOneDrive } from "./mockOneDrive.js";
import { resolveR2TemplatePath } from "./comparativeStatement.js";
import { proposalDocxFilename, resolveProposalDocxPath } from "./proposalTemplate.js";
import { ensureSandboxLibraryFolders } from "./graph.js";
import { CRM_DRIVE, CRM_LIBRARY_FOLDERS, crmProposalFolder, wonOrderFolder } from "./spdcLibraryFolders.js";

function sanitizeSegment(s: string) {
  return s.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.+$/g, "").replace(/_+$/g, "") || "file";
}

/** ISO 19650 procurement folders under each project library. */
export const CRM_SHAREPOINT = {
  pmcProposals: "05_PROCUREMENT_AND_CONTRACTS/05.03_Tender_Documents_Issue/PMC_Proposals",
  /** Root for all vendor BOQ uploads on a bid package. */
  vendorBoqRoot: "05_PROCUREMENT_AND_CONTRACTS/05.05_Bid_Receipt_Opening/Vendor_BOQs",
  /** Per-bidder folder — contains one subfolder per R2 discipline. */
  vendorBoqVendorRoot: (vendorLabel: string) =>
    `${CRM_SHAREPOINT.vendorBoqRoot}/${sanitizeSegment(vendorLabel)}`,
  /** Vendor × discipline — one XLSX per slot (05.05 bid receipt). */
  vendorBoqFolder: (vendorLabel: string, disciplineKey: string) =>
    `${CRM_SHAREPOINT.vendorBoqVendorRoot(vendorLabel)}/${sanitizeSegment(disciplineKey)}`,
  comparative: "05_PROCUREMENT_AND_CONTRACTS/05.06_Bid_Evaluation_Recommendation/Comparative_Statement",
} as const;

/** Office library for PMC proposals that are not yet tied to a project. */
export const CRM_OFFICE_LIBRARY = "PMC-CRM";

let crmTreeReady = false;

/** SPDC_CRM folder tree on `_CRM`. Sample INQ-000 and template files are not copied. */
export async function ensureCrmLibraryTree() {
  if (crmTreeReady) return { driveCode: CRM_DRIVE, folders: [...CRM_LIBRARY_FOLDERS] };
  for (const rel of CRM_LIBRARY_FOLDERS) {
    fs.mkdirSync(path.join(mockOneDrive.root(), "onedrive", CRM_DRIVE, rel), { recursive: true });
  }
  try {
    await ensureSandboxLibraryFolders(CRM_DRIVE, [...CRM_LIBRARY_FOLDERS]);
    crmTreeReady = true;
  } catch (err) {
    console.warn("[CRM] SharePoint folder tree:", err instanceof Error ? err.message : err);
  }
  return { driveCode: CRM_DRIVE, folders: [...CRM_LIBRARY_FOLDERS] };
}

export async function syncBufferToProjectSharePoint(
  projectCode: string,
  relFolder: string,
  fileName: string,
  buffer: Buffer,
  opts?: { replace?: boolean }
) {
  return mockOneDrive.upload(projectCode, relFolder, fileName, buffer, "application/octet-stream", {
    replace: opts?.replace ?? false,
  });
}

export async function syncComparativeWorkbook(projectCode: string, revisionLabel: string) {
  const buffer = fs.readFileSync(resolveR2TemplatePath());
  const fileName = `Comparative-Statement-${sanitizeSegment(revisionLabel)}.xlsx`;
  return syncBufferToProjectSharePoint(projectCode, CRM_SHAREPOINT.comparative, fileName, buffer);
}

export async function syncProposalDocx(
  projectCode: string,
  quotationNo: string,
  clientName?: string,
  revisionNo = 0
) {
  await ensureCrmLibraryTree();
  const buffer = fs.readFileSync(resolveProposalDocxPath());
  const fileName = proposalDocxFilename(quotationNo, clientName, revisionNo);
  await mockOneDrive.upload(
    CRM_DRIVE,
    crmProposalFolder({ quotationNo, clientName, stage: "submitted" }),
    fileName,
    buffer,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    { replace: false },
  );
  return syncBufferToProjectSharePoint(projectCode, CRM_SHAREPOINT.pmcProposals, fileName, buffer);
}

export async function createProjectProposalFile(
  projectCode: string,
  clientName: string,
  quotationNo?: string,
  revisionNo = 0,
  buffer?: Buffer
) {
  await ensureCrmLibraryTree();
  const bytes = buffer ?? fs.readFileSync(resolveProposalDocxPath());
  const fileName = proposalDocxFilename(quotationNo, clientName, revisionNo);
  const stage = revisionNo > 0 ? "submitted" : "working";
  const saved = await mockOneDrive.upload(
    CRM_DRIVE,
    crmProposalFolder({ quotationNo, clientName, stage }),
    fileName,
    bytes,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    { replace: false },
  );
  if (projectCode && projectCode !== CRM_OFFICE_LIBRARY && projectCode !== CRM_DRIVE) {
    await syncBufferToProjectSharePoint(projectCode, CRM_SHAREPOINT.pmcProposals, fileName, bytes).catch(() => undefined);
  }
  return saved;
}

/** Copy the SPDC PMC proposal template into the office proposals folder, named for the client. */
export async function createClientProposalFile(clientName: string, quotationNo?: string) {
  return createProjectProposalFile(CRM_DRIVE, clientName, quotationNo, 0);
}

export async function syncProposalSummaryFile(
  projectCode: string,
  quotationNo: string,
  buffer: Buffer,
  ext: "html" | "doc",
  clientName?: string
) {
  await ensureCrmLibraryTree();
  const safe = quotationNo.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const fileName = `${safe}-Summary.${ext}`;
  const contentType = ext === "html" ? "text/html" : "application/msword";
  const saved = await mockOneDrive.upload(
    CRM_DRIVE,
    crmProposalFolder({ quotationNo, clientName, stage: "submitted" }),
    fileName,
    buffer,
    contentType,
  );
  if (projectCode && projectCode !== CRM_OFFICE_LIBRARY && projectCode !== CRM_DRIVE) {
    await syncBufferToProjectSharePoint(projectCode, CRM_SHAREPOINT.pmcProposals, fileName, buffer).catch(() => undefined);
  }
  return saved;
}

/** Project cards (won jobs, not leads) and their communication matrix, on SPDC_CRM / 04_Orders_Won. */
export async function fileWonProjectPack(projectId: string) {
  const { prisma } = await import("../prisma.js");
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, code: true, name: true, clientName: true, location: true, status: true, clientEmail: true },
  });
  if (!project) return null;
  await ensureCrmLibraryTree();
  const folder = wonOrderFolder(project.code, project.clientName);
  const card = [
    `Project: ${project.name}`,
    `Code: ${project.code}`,
    `Client: ${project.clientName || ""}`,
    `Location: ${project.location || ""}`,
    `Status: ${project.status}`,
    `Email: ${project.clientEmail || ""}`,
    `Filed: ${new Date().toISOString()}`,
  ].join("\n");
  const cardSaved = await mockOneDrive.upload(
    CRM_DRIVE,
    folder,
    `${sanitizeSegment(project.code)}_Project_Card.txt`,
    Buffer.from(card, "utf8"),
    "text/plain",
    { replace: true },
  );
  const { buildMatrixXlsx } = await import("./matrixExport.js");
  for (const kind of ["TECHNICAL", "COMMERCIAL"] as const) {
    try {
      const buf = await buildMatrixXlsx(project.id, kind);
      await mockOneDrive.upload(
        CRM_DRIVE,
        folder,
        `Communication-Matrix-${kind}.xlsx`,
        buf,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        { replace: true },
      );
    } catch (err) {
      console.warn("[CRM] matrix file", kind, err instanceof Error ? err.message : err);
    }
  }
  return { folder, sharePointUrl: cardSaved.sharePointUrl || cardSaved.url || null };
}
