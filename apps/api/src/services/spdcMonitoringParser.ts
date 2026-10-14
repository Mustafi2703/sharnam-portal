/**
 * SPDC Monitoring* sheet parser — section / subsection headings + 39-column BOQ rows.
 * Used by seed, structure upload, and workbook verify.
 */

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function s(v: unknown, max = 500): string {
  const t = String(v ?? "").trim();
  return t ? t.slice(0, max) : "";
}

export type ParsedMonitoringLine = {
  packageName: string;
  section: string | null;
  itemNo: string | null;
  description: string;
  uom: string | null;
  rate: number;
  boqQty: number;
  extraQty: number;
  gfcQty: number;
  achievedQty: number;
  certifiedQty: number;
  excessQty: number;
  savingQty: number;
  boqCost: number;
  extraItemCost: number;
  gfcCost: number;
  achievedCost: number;
  excessCost: number;
  savingCost: number;
  certifiedInvoiceCost: number;
  pctBoq: number;
  pctGfc: number;
  pctAchieved: number;
  pctCertified: number;
  evBoq: number;
  evGfc: number;
  evCertified: number;
  actualCost: number;
  cpi: number;
  cpiStatus: string | null;
  etcBoq: number;
  etcGfc: number;
  etcCertified: number;
  eac: number;
  vac: number;
  varBoqGfc: number;
  varGfcAchieved: number;
  varGfcCertified: number;
  overrunBoq: number;
  overrunGfc: number;
  overrunCertified: number;
  rowKind: "section" | "subsection" | "item";
};

function isTotalRow(description: string) {
  return /^total amount$/i.test(description.trim());
}

function isSkipRow(description: string, itemNo: string) {
  if (!description && !itemNo) return true;
  if (/^item\s*no\.?$/i.test(itemNo) || /^item of work$/i.test(description)) return true;
  if (/^qty$/i.test(description) && !itemNo) return true;
  // Package title rows — sometimes in col A, sometimes col B.
  const title = description || itemNo;
  if (/^(electric|plumbing|civil)\s+work$/i.test(title.trim())) return true;
  return false;
}

/** Heading row — package section or sub-section (Size, Dormitory Room, Part - B, letter A/B, Section 1.00). */
function isHeadingRow(itemNo: string, description: string, uom: string, rate: number, boqQty: number) {
  if (isTotalRow(description)) return "total";
  if (/^part\s*[-–]\s*[a-z0-9]+$/i.test(itemNo) && !uom && rate === 0 && boqQty === 0) return "section";
  if (/^size$/i.test(description) && !uom && rate === 0 && boqQty === 0) return "subsection";
  // Letter band (A / B / a) — Plumbing / Electric style subsections.
  if (/^[A-Za-z]$/.test(itemNo) && !uom && rate === 0 && boqQty === 0 && description) return "subsection";
  // "Section 1.00" / "EXCAVATION" / "Compound Wall" — section band with no measures.
  if (/^section\s+/i.test(description) && !uom && rate === 0 && boqQty === 0) return "section";
  if (!itemNo && !uom && rate === 0 && boqQty === 0 && description) return "section";
  // Numbered parent with description but no UOM/rate/qty (Civil Excavation 1.0).
  if (itemNo && description && !uom && rate === 0 && boqQty === 0) return "subsection";
  return null;
}

function sectionPath(section: string | null, subsection: string | null) {
  if (section && subsection) return `${section} › ${subsection}`;
  return section || subsection || null;
}

export function parseSpdcMonitoringRows(rows: unknown[][], packageName: string): ParsedMonitoringLine[] {
  const out: ParsedMonitoringLine[] = [];
  let section: string | null = null;
  let subsection: string | null = null;

  // Row 0 = column headers; row 1+ may be package/section bands (Compound Wall, Dormitory Block).
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    let description = s(row[1], 500);
    let itemNo = s(row[0], 40);
    // Some SPDC rows put the band title only in column A.
    if (!description && itemNo && !/^\d/.test(itemNo) && !/^[A-Za-z]$/.test(itemNo)) {
      description = itemNo;
      itemNo = "";
    }
    if (isSkipRow(description, itemNo)) continue;

    const uom = s(row[2], 20);
    const rate = n(row[3]);
    const boqQty = n(row[4]);
    const heading = isHeadingRow(itemNo, description, uom, rate, boqQty);

    if (heading === "total") continue;

    if (heading === "section") {
      section = description || itemNo || "Section";
      subsection = null;
      continue;
    }

    if (heading === "subsection") {
      // Prefer description; letter-only rows use "A · Title".
      subsection = description || itemNo || "Subsection";
      if (/^[A-Za-z]$/.test(itemNo) && description) subsection = `${itemNo} · ${description}`;
      continue;
    }

    const gfcQty = n(row[6]);
    const extraQty = n(row[5]);
    const achievedQty = n(row[7]);
    const certifiedQty = n(row[10]);
    const boqCost = n(row[11]) || rate * boqQty;
    const extraItemCost = n(row[12]) || extraQty * rate;
    const gfcCost = n(row[13]) || gfcQty * rate;
    const achievedCost = n(row[14]) || achievedQty * rate;
    const excessCost = n(row[15]);
    const savingCost = n(row[16]);
    const certifiedInvoiceCost = n(row[17]) || certifiedQty * rate;
    const actualCost = n(row[25]) || achievedCost;

    out.push({
      packageName,
      section: sectionPath(section, subsection),
      itemNo: itemNo || null,
      description,
      uom: uom || null,
      rate,
      boqQty,
      extraQty,
      gfcQty,
      achievedQty,
      certifiedQty,
      excessQty: Math.max(0, gfcQty - boqQty),
      savingQty: Math.max(0, boqQty - gfcQty),
      boqCost,
      extraItemCost,
      gfcCost,
      achievedCost,
      excessCost: excessCost || Math.max(0, gfcCost - boqCost),
      savingCost: savingCost || Math.max(0, boqCost - gfcCost),
      certifiedInvoiceCost,
      pctBoq: n(row[18]),
      pctGfc: n(row[19]),
      pctAchieved: n(row[20]),
      pctCertified: n(row[21]),
      evBoq: n(row[22]) || achievedCost,
      evGfc: n(row[23]) || achievedCost,
      evCertified: n(row[24]),
      actualCost,
      cpi: n(row[26]),
      cpiStatus: s(row[27], 40) || null,
      etcBoq: n(row[28]),
      etcGfc: n(row[29]),
      etcCertified: n(row[30]),
      eac: n(row[31]) || boqCost,
      vac: n(row[32]),
      varBoqGfc: n(row[33]),
      varGfcAchieved: n(row[34]),
      varGfcCertified: n(row[35]),
      overrunBoq: n(row[36]),
      overrunGfc: n(row[37]),
      overrunCertified: n(row[38]),
      rowKind: "item",
    });
  }

  return out;
}

/** Detect SPDC Monitoring layout (39 cols, Item No / Item of Work headers). */
export function isSpdcMonitoringSheet(rows: unknown[][]): boolean {
  if (!rows.length) return false;
  const h0 = rows.slice(0, 3).map((r) => s((r as unknown[])[0]).toLowerCase()).join(" ");
  const h1 = rows.slice(0, 3).map((r) => s((r as unknown[])[1]).toLowerCase()).join(" ");
  return /item no|item no\./i.test(h0) && /item of work|description/i.test(h1);
}

export function monitoringItemRows(lines: ParsedMonitoringLine[]) {
  return lines.filter((l) => l.rowKind === "item");
}

/** Prisma create payload (without projectId). */
export function monitoringLineToDb(line: ParsedMonitoringLine) {
  return {
    packageName: line.packageName,
    section: line.section,
    itemNo: line.itemNo,
    description: line.description,
    uom: line.uom,
    rate: line.rate,
    boqQty: line.boqQty,
    extraQty: line.extraQty,
    gfcQty: line.gfcQty,
    achievedQty: line.achievedQty,
    excessQty: line.excessQty,
    savingQty: line.savingQty,
    certifiedQty: line.certifiedQty,
    boqCost: line.boqCost,
    extraItemCost: line.extraItemCost,
    gfcCost: line.gfcCost,
    achievedCost: line.achievedCost,
    excessCost: line.excessCost,
    savingCost: line.savingCost,
    certifiedInvoiceCost: line.certifiedInvoiceCost,
    pctBoq: line.pctBoq,
    pctGfc: line.pctGfc,
    pctAchieved: line.pctAchieved,
    pctCertified: line.pctCertified,
    evBoq: line.evBoq,
    evGfc: line.evGfc,
    evCertified: line.evCertified,
    actualCost: line.actualCost,
    cpi: line.cpi,
    cpiStatus: line.cpiStatus,
    etcBoq: line.etcBoq,
    etcGfc: line.etcGfc,
    etcCertified: line.etcCertified,
    eac: line.eac,
    vac: line.vac,
    varBoqGfc: line.varBoqGfc,
    varGfcAchieved: line.varGfcAchieved,
    varGfcCertified: line.varGfcCertified,
    overrunBoq: line.overrunBoq,
    overrunGfc: line.overrunGfc,
    overrunCertified: line.overrunCertified,
  };
}
