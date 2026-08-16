export type DrawingIssueDraft = {
  receivedDate: string;
  copiesReceived: string;
  issuedToContractorAt: string;
  issuedToClientAt: string;
  contractorSignName: string;
  clientSignName: string;
  contractorSignature: File | null;
  clientSignature: File | null;
  remarks: string;
};

export function emptyDrawingIssueDraft(): DrawingIssueDraft {
  return {
    receivedDate: "",
    copiesReceived: "",
    issuedToContractorAt: "",
    issuedToClientAt: "",
    contractorSignName: "",
    clientSignName: "",
    contractorSignature: null,
    clientSignature: null,
    remarks: "",
  };
}

export function appendIssueToFormData(fd: FormData, issue: DrawingIssueDraft) {
  if (issue.receivedDate) fd.append("receivedDate", issue.receivedDate);
  if (issue.copiesReceived) fd.append("copiesReceived", issue.copiesReceived);
  if (issue.issuedToContractorAt) fd.append("issuedToContractorAt", issue.issuedToContractorAt);
  if (issue.issuedToClientAt) fd.append("issuedToClientAt", issue.issuedToClientAt);
  if (issue.contractorSignName.trim()) fd.append("contractorSignName", issue.contractorSignName.trim());
  if (issue.clientSignName.trim()) fd.append("clientSignName", issue.clientSignName.trim());
  if (issue.remarks.trim()) fd.append("issueRemarks", issue.remarks.trim());
  if (issue.contractorSignature) fd.append("contractorSignature", issue.contractorSignature);
  if (issue.clientSignature) fd.append("clientSignature", issue.clientSignature);
}

export function issueFromRevision(rev?: {
  receivedDate?: string | Date | null;
  copiesReceived?: number | null;
  issuedToContractorAt?: string | Date | null;
  issuedToClientAt?: string | Date | null;
  contractorSignName?: string | null;
  clientSignName?: string | null;
  issueRemarks?: string | null;
} | null): DrawingIssueDraft {
  if (!rev) return emptyDrawingIssueDraft();
  const day = (d?: string | Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");
  return {
    receivedDate: day(rev.receivedDate),
    copiesReceived: rev.copiesReceived != null ? String(rev.copiesReceived) : "",
    issuedToContractorAt: day(rev.issuedToContractorAt),
    issuedToClientAt: day(rev.issuedToClientAt),
    contractorSignName: rev.contractorSignName || "",
    clientSignName: rev.clientSignName || "",
    contractorSignature: null,
    clientSignature: null,
    remarks: rev.issueRemarks || "",
  };
}

/** Client Site Drawing Register — R0 through R6 */
export const SITE_REGISTER_REV_SLOTS = ["R0", "R1", "R2", "R3", "R4", "R5", "R6"] as const;

export const SITE_REGISTER_ISSUE_ROWS = [
  { key: "receivedDate", label: "Date of receiving" },
  { key: "copiesReceived", label: "Total copies received" },
  { key: "issuedToContractorAt", label: "Issued to contractor" },
  { key: "contractorSign", label: "Receiver signature (contractor)" },
  { key: "issuedToClientAt", label: "Issued to client" },
  { key: "clientSign", label: "Receiver signature (client)" },
] as const;
