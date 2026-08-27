import fs from "fs";
import { mockOneDrive } from "./mockOneDrive.js";
import { resolveR2TemplatePath } from "./comparativeStatement.js";
import { proposalDocxFilename, resolveProposalDocxPath } from "./proposalTemplate.js";

function sanitizeSegment(s: string) {
  return s.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** ISO 19650 procurement folders under each project library. */
export const CRM_SHAREPOINT = {
  pmcProposals: "05_PROCUREMENT_AND_CONTRACTS/05.03_Tender_Documents_Issue/PMC_Proposals",
  vendorBoqFolder: (vendorLabel: string) =>
    `05_PROCUREMENT_AND_CONTRACTS/05.05_Bid_Receipt_Opening/Vendor_BOQs/${sanitizeSegment(vendorLabel)}`,
  comparative: "05_PROCUREMENT_AND_CONTRACTS/05.06_Bid_Evaluation_Recommendation/Comparative_Statement",
} as const;

/** Office library for PMC proposals that are not yet tied to a project. */
export const CRM_OFFICE_LIBRARY = "PMC-CRM";

export async function syncBufferToProjectSharePoint(
  projectCode: string,
  relFolder: string,
  fileName: string,
  buffer: Buffer
) {
  return mockOneDrive.upload(projectCode, relFolder, fileName, buffer);
}

export async function syncComparativeWorkbook(projectCode: string, revisionLabel: string) {
  const buffer = fs.readFileSync(resolveR2TemplatePath());
  const fileName = `Comparative-Statement-${sanitizeSegment(revisionLabel)}.xlsx`;
  return syncBufferToProjectSharePoint(projectCode, CRM_SHAREPOINT.comparative, fileName, buffer);
}

export async function syncProposalDocx(projectCode: string, quotationNo: string, clientName?: string) {
  const buffer = fs.readFileSync(resolveProposalDocxPath());
  return syncBufferToProjectSharePoint(
    projectCode,
    CRM_SHAREPOINT.pmcProposals,
    proposalDocxFilename(quotationNo, clientName),
    buffer
  );
}

/** Copy the SPDC PMC proposal template into the office proposals folder, named for the client. */
export async function createClientProposalFile(clientName: string, quotationNo?: string) {
  const buffer = fs.readFileSync(resolveProposalDocxPath());
  return mockOneDrive.upload(
    CRM_OFFICE_LIBRARY,
    CRM_SHAREPOINT.pmcProposals,
    proposalDocxFilename(quotationNo, clientName),
    buffer,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

export async function syncProposalSummaryFile(
  projectCode: string,
  quotationNo: string,
  buffer: Buffer,
  ext: "html" | "doc"
) {
  const safe = quotationNo.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return syncBufferToProjectSharePoint(
    projectCode,
    CRM_SHAREPOINT.pmcProposals,
    `${safe}-Summary.${ext}`,
    buffer
  );
}
