import fs from "fs";
import path from "path";

/** Full SPDC PMC proposal (~63 pages) — Arvind reference document. */
export function resolveProposalDocxPath(): string {
  const candidates = [
    path.join(process.cwd(), "Sharnam_modules_docs", "SPDC_PMC_Proposal_ Arvind (1).docx"),
    path.join(process.cwd(), "Sharnam_modules_docs", "SPDC_PMC_Proposal_ Arvind.docx"),
    path.join(process.cwd(), "templates", "SPDC-PMC-Proposal-Arvind.docx"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("SPDC PMC proposal template (.docx) not found — add templates/SPDC-PMC-Proposal-Arvind.docx");
}

export function proposalDocxFilename(quotationNo?: string) {
  const safe = (quotationNo || "SPDC-PMC-Proposal").replace(/[^a-zA-Z0-9._/-]+/g, "-");
  return `${safe}-Full-Proposal.docx`;
}
