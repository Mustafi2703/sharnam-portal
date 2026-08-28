/** SPDC MB / BBS row kinds — mirrors Monitoring section › subsection › entry bands. */

export type MbRowKind = "item" | "description" | "subitem" | "subsection" | "data" | "total" | "note";

export type BbsRowKind = "section" | "subsection" | "subheader" | "data" | "note";

type MbLike = {
  srNo?: string | null;
  description?: string | null;
  remark?: string | null;
  rowKind?: string | null;
  nos1?: number | null;
  nos2?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  qty?: number | null;
};

type BbsLike = {
  barMark?: string | null;
  location?: string | null;
  sectionMark?: string | null;
  rowKind?: string | null;
  diameterMm?: number | null;
  totalLength?: number | null;
  nos?: number | null;
  weightKg?: number | null;
  shapeLenA?: number | null;
};

const MB_ROW_KINDS = new Set<MbRowKind>(["item", "description", "subitem", "subsection", "data", "total", "note"]);
const BBS_ROW_KINDS = new Set<BbsRowKind>(["section", "subsection", "subheader", "data", "note"]);

function hasMbMeasure(r: MbLike) {
  return (
    Math.abs(Number(r.qty) || 0) > 0 ||
    Math.abs(Number(r.nos1) || 0) > 0 ||
    Math.abs(Number(r.length) || 0) > 0 ||
    Math.abs(Number(r.width) || 0) > 0 ||
    Math.abs(Number(r.height) || 0) > 0
  );
}

function isMbTotal(desc: string) {
  return /total up to date|previous bill qty|this bill quantity/i.test(desc.trim());
}

export function mbRowKind(r: MbLike): MbRowKind {
  const stored = String(r.rowKind ?? "").trim() as MbRowKind;
  if (stored && MB_ROW_KINDS.has(stored)) return stored;
  const desc = String(r.description ?? "").trim();
  const sr = String(r.srNo ?? "").trim();
  if (!desc) return "note";
  if (isMbTotal(desc)) return "total";
  if (hasMbMeasure(r)) return "data";
  if (sr && /^\d+$/.test(sr)) {
    if (/^-do\b/i.test(desc)) return "subitem";
    return "item";
  }
  if (!sr && desc.length > 90) return "description";
  if (
    !sr &&
    desc.length <= 64 &&
    !/[.;]/.test(desc) &&
    !/^providing|^excavation|^filling|^less |^ded |^do /i.test(desc) &&
    (/^[A-Z][A-Za-z0-9\s\-&/().]+$/.test(desc) || /^[A-Z][A-Z0-9\s\-&/().]+$/.test(desc))
  ) {
    return "subsection";
  }
  if (sr && /^-do\b/i.test(desc)) return "subitem";
  return "note";
}

export function bbsRowKind(r: BbsLike): BbsRowKind {
  const stored = String(r.rowKind ?? "").trim() as BbsRowKind;
  if (stored && BBS_ROW_KINDS.has(stored)) return stored;
  const mark = String(r.barMark ?? "").trim();
  const loc = String(r.location ?? r.sectionMark ?? "").trim();
  if (/^\s*(grand\s*)?total\b/i.test(loc) || /^\s*(grand\s*)?total\b/i.test(mark) || /^dia\s*\d+/i.test(loc)) {
    return "note";
  }
  const hasData =
    Math.abs(Number(r.diameterMm) || 0) >= 6 ||
    Math.abs(Number(r.totalLength) || 0) > 0 ||
    Math.abs(Number(r.nos) || 0) > 0 ||
    Math.abs(Number(r.weightKg) || 0) > 0 ||
    Math.abs(Number(r.shapeLenA) || 0) > 0;

  if (hasData) return "data";
  if (!loc && !mark) return "note";
  if (/^(l|b|h|dia|spacing|d)$/i.test(loc) || /^(l|b|h|dia|spacing|d)$/i.test(mark)) return "subheader";
  if (mark && /^[A-Z]$/.test(mark)) return "section";
  if (mark && /^\d+$/.test(mark)) return "subsection";
  if (/^footing\s*=|^column\s|^beam\s|^slab\s|^ring\s|^steel\s/i.test(loc)) return "subsection";
  if (/lvl\s*=|^\d+\.\d+\s*m\b|v\.length|p\.b\.|p\.c\.c\./i.test(loc)) return "note";
  return "note";
}

export function mbRowBandClass(kind: MbRowKind): string {
  switch (kind) {
    case "item":
      return "boq-section-row cost-row--item";
    case "subitem":
      return "boq-subsection-row cost-row--subitem";
    case "subsection":
      return "boq-subsection-row cost-row--subsection";
    case "description":
      return "boq-desc-row cost-row--description";
    case "total":
      return "boq-total-row cost-row--total";
    default:
      return "boq-note-row cost-row--note";
  }
}

export function bbsRowBandClass(kind: BbsRowKind): string {
  switch (kind) {
    case "section":
      return "boq-section-row cost-row--bbs-section";
    case "subsection":
      return "boq-subsection-row cost-row--bbs-subsection";
    case "subheader":
      return "boq-subheader-row cost-row--bbs-subheader";
    default:
      return "boq-note-row cost-row--note";
  }
}
