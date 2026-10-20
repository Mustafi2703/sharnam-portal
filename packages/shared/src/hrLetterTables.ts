/**
 * Multi-row tables in the SPDC HR letter templates (apps/api/formats/hrms/<Kind>.docx).
 * The letter form stores each table as JSON (string[][]) under `key`; the Word filler finds the table by
 * `headerMatch` in its first row and writes the rows from `startCol`.
 * `fixedRows`: the template lists the items, the form only fills the other columns of each row.
 * Otherwise rows are free: the first rows of the template are used and more are added as needed.
 */
export type HrLetterTable = {
  key: string;
  label: string;
  hint?: string;
  headerMatch: string;
  startCol: number;
  /** Column 0 is a running No. that the filler writes for added rows. */
  numbered: boolean;
  columns: { label: string; type?: "text" | "date"; width?: number }[];
  fixedRows?: string[];
};

export const HR_LETTER_TABLES: Record<string, HrLetterTable[]> = {
  AssetReturn: [
    {
      key: "assetRows",
      label: "Assets returned",
      hint: "Fill only the rows that apply. Use Y / N for returned.",
      headerMatch: "Asset / item",
      startCol: 2,
      numbered: true,
      columns: [
        { label: "Make, model & serial / tag", width: 2 },
        { label: "Issued on", type: "date" },
        { label: "Qty" },
        { label: "Returned? (Y/N)" },
        { label: "Condition / remarks", width: 2 },
      ],
      fixedRows: [
        "Laptop / desktop with charger & bag",
        "Mobile phone with charger",
        "Official SIM card / data card",
        "Employee ID card and access card",
        "Office / site / store / cabin keys",
        "Measuring instruments (tape, level, distometer, total station, rebound hammer)",
        "Cube moulds / testing kits",
        "PPE (helmet, shoes, jacket, harness)",
        "Vehicle with RC, keys, fuel card and logbook",
        "Camera / tablet / pen drive / hard disk",
        "Books, codes, standards and stationery",
        "Cash / site imprest balance",
        "Others (named in Other item)",
      ],
    },
    {
      key: "documentRows",
      label: "Documents and records handed over",
      headerMatch: "Document / record",
      startCol: 2,
      numbered: true,
      columns: [{ label: "Handed over? (Y/N)" }, { label: "Received by", width: 2 }],
      fixedRows: [
        "Drawings (GFC / shop / as-built) and drawing register",
        "Measurement books, JMRs, RA bill working and BBS",
        "Site registers (hindrance, instruction, safety, material, test)",
        "QA/QC records, test reports, checklists, NCRs",
        "Correspondence, MoMs, RFIs and pending-issue list",
        "Original bills, vouchers and imprest account",
        "Contract documents, BOQs, work orders and approvals",
        "Statutory permits, licences and authority correspondence",
      ],
    },
    {
      key: "accessRows",
      label: "Systems and accounts closed",
      headerMatch: "System / account",
      startCol: 2,
      numbered: true,
      columns: [{ label: "Access closed? (Y/N)" }, { label: "IT sign", width: 2 }],
      fixedRows: [
        "Company email ID — mailbox backed up, auto-forward set",
        "SPDC portal (portal.spdc.in) user ID — pending entries completed",
        "Shared drives / SharePoint / cloud folders — ownership transferred",
        "Client portals and software licences (MSP, AutoCAD, etc.)",
        "Project WhatsApp / messaging groups — admin rights transferred",
        "Device passwords, PINs and encryption keys handed over",
        "Company data on personal devices deleted",
      ],
    },
  ],
  Confirmation: [
    {
      key: "ratingRows",
      label: "Probation review",
      headerMatch: "Rating (1–5)",
      startCol: 1,
      numbered: false,
      columns: [{ label: "Rating (1–5)" }, { label: "Remarks", width: 3 }],
      fixedRows: [
        "Technical knowledge and quality of work",
        "Planning, reporting and portal discipline",
        "Client and Contractor coordination",
        "Safety and compliance",
        "Attendance, integrity and conduct",
        "Overall",
      ],
    },
  ],
  Experience: [
    {
      key: "designationRows",
      label: "Designations held",
      hint: "One row per designation, oldest first. Empty uses the designation and dates above.",
      headerMatch: "Designation",
      startCol: 0,
      numbered: false,
      columns: [{ label: "Designation", width: 2 }, { label: "From", type: "date" }, { label: "To", type: "date" }],
    },
    {
      key: "projectRows",
      label: "Projects handled",
      hint: "One row per project. Empty uses the project above.",
      headerMatch: "Project / type of work",
      startCol: 1,
      numbered: true,
      columns: [{ label: "Project / type of work", width: 3 }, { label: "Location" }, { label: "Period", width: 2 }],
    },
  ],
  Warning: [
    {
      key: "incidentRows",
      label: "Incidents",
      hint: "One row per incident. Empty uses the issue in brief.",
      headerMatch: "Facts of the incident",
      startCol: 1,
      numbered: true,
      columns: [{ label: "Date(s)", type: "date" }, { label: "Facts of the incident / lapse", width: 3 }, { label: "Evidence on record", width: 2 }],
    },
  ],
  Promotion: [
    {
      key: "kraRows",
      label: "Key result areas",
      headerMatch: "Key result area",
      startCol: 1,
      numbered: true,
      columns: [{ label: "Key result area", width: 3 }, { label: "Target / measure", width: 2 }],
    },
  ],
  Offer: [
    {
      key: "previousEmployers",
      label: "Previous employers (for reference check)",
      headerMatch: "HR contact",
      startCol: 1,
      numbered: true,
      columns: [{ label: "Employer", width: 2 }, { label: "Period & designation", width: 2 }, { label: "HR contact (name / email)", width: 2 }],
    },
  ],
  Appointment: [
    {
      key: "chequeRows",
      label: "Security cheques",
      hint: "One row per cheque. Account: last 4 digits only.",
      headerMatch: "Cheque No.",
      startCol: 1,
      numbered: true,
      columns: [{ label: "Bank & branch", width: 2 }, { label: "Account (last 4)" }, { label: "Cheque no." }, { label: "Amount" }],
    },
  ],
  NdaJoining: [
    {
      key: "undertakingRows",
      label: "Client / project undertakings",
      headerMatch: "Undertaking ref",
      startCol: 1,
      numbered: true,
      columns: [{ label: "Client / project", width: 2 }, { label: "Undertaking ref. / date", width: 2 }, { label: "Valid until", type: "date" }],
    },
    {
      key: "priorInfoRows",
      label: "Prior information declared",
      headerMatch: "Description of prior",
      startCol: 1,
      numbered: true,
      columns: [{ label: "Description of prior information", width: 3 }, { label: "Evidence of prior ownership", width: 2 }],
    },
  ],
  NdaPostEmployment: [
    {
      key: "projectAccessRows",
      label: "Projects and information accessed",
      hint: "One row per project. Empty uses the project, client and period above.",
      headerMatch: "Type of information accessed",
      startCol: 1,
      numbered: true,
      columns: [{ label: "Project / site", width: 2 }, { label: "Client", width: 2 }, { label: "Period", width: 2 }, { label: "Type of information accessed", width: 3 }],
    },
  ],
};

/** Parse a stored table value; drops rows with nothing typed. */
export function parseHrLetterTable(value: unknown): string[][] {
  let rows: unknown = value;
  if (typeof value === "string") {
    try {
      rows = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(rows)) return [];
  return rows
    .filter(Array.isArray)
    .map((r) => (r as unknown[]).map((c) => String(c ?? "").trim()));
}

export function hrLetterTableHasData(rows: string[][]): boolean {
  return rows.some((r) => r.some(Boolean));
}
