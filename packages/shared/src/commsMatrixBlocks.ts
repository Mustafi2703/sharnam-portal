/**
 * Communication matrix blocks, BPCL layout: one lettered block per company. NAME OF COMPANY, SINGLE POINT OF
 * CONTACT and OFFICE ADD. belong to the company (merged down the block); every person keeps their own name,
 * designation, mobile, e-mail and TO/CC. Company SPOC and address live on the company's section-header row.
 */

export type MatrixRowLike = {
  id: string;
  orgSection?: string | null;
  orgName?: string | null;
  isSectionHeader?: boolean | null;
  sortOrder?: number | null;
  personName?: string | null;
  designation?: string | null;
  company?: string | null;
  spoc?: string | null;
  mobile?: string | null;
  email?: string | null;
  mailRole?: string | null;
  officeAddress?: string | null;
};

export type MatrixBlock<R extends MatrixRowLike = MatrixRowLike> = {
  key: string;
  letter: string;
  orgSection: string;
  company: string;
  headerId: string | null;
  /** Every header row for this company (duplicates included) so delete and clean-up remove them all. */
  headerIds: string[];
  /** Company SPOC as entered on the block; falls back to the TO people when nobody set one. */
  spoc: string;
  spocIsSet: boolean;
  officeAddress: string;
  people: R[];
  /** Company-only rows (no person yet) — kept so they can be edited, left out of exports. */
  placeholders: R[];
};

export const MATRIX_SECTION_ORDER = ["Client", "PMC", "Consultant", "Contractor", "Other"] as const;

export function matrixSectionOf(raw?: string | null): string {
  const s = String(raw || "").trim();
  if (s === "Designer") return "Consultant";
  if (s === "Vendor") return "Contractor";
  return (MATRIX_SECTION_ORDER as readonly string[]).includes(s) ? s : "Other";
}

export function matrixCompanyKey(name?: string | null): string {
  return String(name || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const text = (v?: string | null) => String(v ?? "").trim();

/** A row naming the company instead of a person (no e-mail). Shown only when the company has nobody else. */
/** Designations offered for any matrix person — BPCL Communication Matrix first, then common site titles. Custom values are allowed. */
export const MATRIX_DESIGNATIONS = [
  "Director",
  "Project Manager",
  "Project Co-ordinator",
  "Billing Engineer",
  "HR & Safety Compliance",
  "Head – Procurement",
  "Managing Director",
  "General Manager",
  "Project Head",
  "Site In-charge",
  "Site Engineer",
  "Planning Engineer",
  "QA/QC Engineer",
  "Safety Officer",
  "Design Manager",
  "Architect",
  "Structural Engineer",
  "MEP Engineer",
  "Quantity Surveyor",
  "Procurement Manager",
  "Purchase Officer",
  "Accounts / Finance",
  "Store In-charge",
  "Supervisor",
] as const;

export function isMatrixPlaceholder(row: MatrixRowLike): boolean {
  if (text(row.email)) return false;
  const person = matrixCompanyKey(row.personName);
  return !person || person === matrixCompanyKey(row.company || row.orgName);
}

/** Person rows only. A company with nobody added prints no blank lines. */
export function matrixBlockRows<R extends MatrixRowLike>(block: MatrixBlock<R>): R[] {
  return block.people;
}

function blockKey(section: string, company: string) {
  return `${section}|${section === "PMC" ? "pmc" : matrixCompanyKey(company)}`;
}

export function letterFor(index: number): string {
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

export function buildMatrixBlocks<R extends MatrixRowLike>(rows: R[], opts: { keepEmpty?: boolean } = {}): MatrixBlock<R>[] {
  const sorted = [...rows].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const blocks = new Map<string, MatrixBlock<R> & { firstSort: number }>();
  const ensure = (section: string, company: string, sort: number) => {
    const key = blockKey(section, company);
    let b = blocks.get(key);
    if (!b) {
      b = { key, letter: "", orgSection: section, company, headerId: null, headerIds: [], spoc: "", spocIsSet: false, officeAddress: "", people: [], placeholders: [], firstSort: sort };
      blocks.set(key, b);
    }
    b.firstSort = Math.min(b.firstSort, sort);
    return b;
  };

  for (const r of sorted) {
    if (r.isSectionHeader) continue;
    const section = matrixSectionOf(r.orgSection);
    const company = text(r.company) || text(r.orgName) || section;
    const b = ensure(section, company, r.sortOrder ?? 0);
    (isMatrixPlaceholder(r) ? b.placeholders : b.people).push(r);
  }

  for (const h of sorted) {
    if (!h.isSectionHeader) continue;
    const section = matrixSectionOf(h.orgSection);
    const key = blockKey(section, text(h.orgName));
    const existing = blocks.get(key);
    if (!existing && !opts.keepEmpty) continue;
    const b = existing ?? ensure(section, text(h.orgName) || section, h.sortOrder ?? 0);
    b.headerIds.push(h.id);
    if (b.headerId) continue;
    b.headerId = h.id;
    const headerName = text(h.orgName);
    const genericHeader = !headerName || headerName.toLowerCase() === section.toLowerCase();
    if (headerName && !genericHeader) b.company = headerName;
    else if (!text(b.company) || text(b.company).toLowerCase() === section.toLowerCase()) {
      const fromPeople = text(b.people.find((p) => text(p.company) && text(p.company).toLowerCase() !== section.toLowerCase())?.company);
      if (fromPeople) b.company = fromPeople;
    }
    if (text(h.spoc)) {
      b.spoc = text(h.spoc);
      b.spocIsSet = true;
    }
    if (text(h.officeAddress)) b.officeAddress = text(h.officeAddress);
  }

  const ordered = [...blocks.values()].sort(
    (a, b) =>
      MATRIX_SECTION_ORDER.indexOf(a.orgSection as (typeof MATRIX_SECTION_ORDER)[number]) -
        MATRIX_SECTION_ORDER.indexOf(b.orgSection as (typeof MATRIX_SECTION_ORDER)[number]) || a.firstSort - b.firstSort,
  );

  return ordered.map(({ firstSort: _firstSort, ...b }, i) => {
    if (!b.spocIsSet) b.spoc = "";
    if (!b.officeAddress) b.officeAddress = text(b.people.find((p) => text(p.officeAddress))?.officeAddress) || text(b.placeholders.find((p) => text(p.officeAddress))?.officeAddress);
    return { ...b, letter: letterFor(i) };
  });
}
