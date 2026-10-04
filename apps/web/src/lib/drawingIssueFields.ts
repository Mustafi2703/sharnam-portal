export type DrawingIssueDraft = {
  receivedDate: string;
  copiesReceived: string;
  issuedToContractorAt: string;
  issuedToClientAt: string;
  clientSignName: string;
  pmcSignName: string;
  siteEngineerSignName: string;
  clientSignPhotoId: string | null;
  pmcSignPhotoId: string | null;
  siteEngineerSignPhotoId: string | null;
  /** Drawn or uploaded on the spot (used instead of a photo-storage pick). */
  clientSignFile?: File | null;
  pmcSignFile?: File | null;
  siteEngineerSignFile?: File | null;
  /** Client not available — PMC signs the client box on their behalf. */
  clientSignedByPmc?: boolean;
  remarks: string;
};

export function emptyDrawingIssueDraft(): DrawingIssueDraft {
  return {
    receivedDate: "",
    copiesReceived: "",
    issuedToContractorAt: "",
    issuedToClientAt: "",
    clientSignName: "",
    pmcSignName: "",
    siteEngineerSignName: "",
    clientSignPhotoId: null,
    pmcSignPhotoId: null,
    siteEngineerSignPhotoId: null,
    clientSignFile: null,
    pmcSignFile: null,
    siteEngineerSignFile: null,
    clientSignedByPmc: false,
    remarks: "",
  };
}

export function appendIssueToFormData(fd: FormData, issue: DrawingIssueDraft) {
  if (issue.receivedDate) fd.append("receivedDate", issue.receivedDate);
  if (issue.copiesReceived) fd.append("copiesReceived", issue.copiesReceived);
  if (issue.issuedToContractorAt) fd.append("issuedToContractorAt", issue.issuedToContractorAt);
  if (issue.issuedToClientAt) fd.append("issuedToClientAt", issue.issuedToClientAt);
  if (issue.clientSignName.trim() || issue.clientSignedByPmc) {
    // Proxy signature is recorded on the register as "<PMC name> (PMC on behalf of client)".
    const who = issue.clientSignName.trim() || issue.pmcSignName.trim() || "PMC";
    fd.append("clientSignName", issue.clientSignedByPmc ? `${who} (PMC on behalf of client)` : who);
  }
  if (issue.pmcSignName.trim()) fd.append("pmcSignName", issue.pmcSignName.trim());
  if (issue.siteEngineerSignName.trim()) fd.append("siteEngineerSignName", issue.siteEngineerSignName.trim());
  if (issue.remarks.trim()) fd.append("issueRemarks", issue.remarks.trim());
  if (issue.clientSignPhotoId) fd.append("clientSignPhotoId", issue.clientSignPhotoId);
  if (issue.pmcSignPhotoId) fd.append("pmcSignPhotoId", issue.pmcSignPhotoId);
  if (issue.siteEngineerSignPhotoId) fd.append("siteEngineerSignPhotoId", issue.siteEngineerSignPhotoId);
  // A drawn / uploaded signature wins over a photo-storage pick (server prefers the file).
  if (issue.clientSignFile) fd.append("clientSignature", issue.clientSignFile, issue.clientSignFile.name);
  if (issue.pmcSignFile) fd.append("pmcSignature", issue.pmcSignFile, issue.pmcSignFile.name);
  if (issue.siteEngineerSignFile) fd.append("siteEngineerSignature", issue.siteEngineerSignFile, issue.siteEngineerSignFile.name);
}

export function issueDraftHasData(issue: DrawingIssueDraft) {
  return !!(
    issue.receivedDate ||
    issue.copiesReceived ||
    issue.issuedToContractorAt ||
    issue.issuedToClientAt ||
    issue.clientSignName.trim() ||
    issue.pmcSignName.trim() ||
    issue.siteEngineerSignName.trim() ||
    issue.remarks.trim() ||
    issue.clientSignPhotoId ||
    issue.pmcSignPhotoId ||
    issue.siteEngineerSignPhotoId ||
    issue.clientSignFile ||
    issue.pmcSignFile ||
    issue.siteEngineerSignFile
  );
}

export function issueFromRevision(rev?: {
  receivedDate?: string | Date | null;
  copiesReceived?: number | null;
  issuedToContractorAt?: string | Date | null;
  issuedToClientAt?: string | Date | null;
  clientSignName?: string | null;
  pmcSignName?: string | null;
  siteEngineerSignName?: string | null;
  issueRemarks?: string | null;
} | null): DrawingIssueDraft {
  if (!rev) return emptyDrawingIssueDraft();
  const day = (d?: string | Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");
  return {
    receivedDate: day(rev.receivedDate),
    copiesReceived: rev.copiesReceived != null ? String(rev.copiesReceived) : "",
    issuedToContractorAt: day(rev.issuedToContractorAt),
    issuedToClientAt: day(rev.issuedToClientAt),
    clientSignName: rev.clientSignName || "",
    pmcSignName: rev.pmcSignName || "",
    siteEngineerSignName: rev.siteEngineerSignName || "",
    clientSignPhotoId: null,
    pmcSignPhotoId: null,
    siteEngineerSignPhotoId: null,
    remarks: rev.issueRemarks || "",
  };
}

/** Client Site Drawing Register — R0 through R6 */
export const SITE_REGISTER_REV_SLOTS = ["R0", "R1", "R2", "R3", "R4", "R5", "R6"] as const;

export const SITE_REGISTER_ISSUE_ROWS = [
  { key: "receivedDate", label: "Date of receiving" },
  { key: "copiesReceived", label: "Total copies received" },
  { key: "issuedToContractorAt", label: "Issued to contractor" },
  { key: "clientSign", label: "Client signature" },
  { key: "pmcSign", label: "PMC signature" },
  { key: "siteEngineerSign", label: "Site engineer signature" },
  { key: "issuedToClientAt", label: "Issued to client" },
] as const;
