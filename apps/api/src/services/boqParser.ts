/**
 * BOQ Excel parser — patterns adapted from Mustafi2703/parikh-procurement
 * (backend/services/boq_import.py): header sniffing, section inference, skip totals.
 */
import * as XLSX from "xlsx";

export type ParsedBoqRow = {
  srNo?: string;
  description: string;
  section?: string;
  qty: number;
  rate: number;
  unit?: string;
  amount: number;
  costCode?: string;
  rowKind: "item" | "section" | "note";
};

const HEADER_ALIASES: Record<string, string[]> = {
  srNo: ["sr", "sr.", "sr.no", "sr no", "sno", "s.no", "item no", "itemno"],
  description: ["description", "desc", "item", "particulars", "work description"],
  qty: ["qty", "quantity", "boq qty"],
  rate: ["rate", "unit rate", "basic rate"],
  unit: ["unit", "uom", "units"],
  amount: ["amount", "total", "amt"],
  costCode: ["cost code", "costcode", "code", "wbs"],
};

function norm(s: unknown): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  const n = parseFloat(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function mapHeader(row: unknown[]): Record<string, number> {
  const map: Record<string, number> = {};
  row.forEach((cell, idx) => {
    const h = norm(cell);
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(h) || aliases.some((a) => h.includes(a))) {
        map[key] = idx;
      }
    }
  });
  return map;
}

function isJunk(desc: string): boolean {
  const d = desc.toLowerCase();
  return (
    !desc.trim() ||
    d.startsWith("total") ||
    d.includes("grand total") ||
    d.includes("note:") ||
    d.includes("excluding gst") ||
    d === "description"
  );
}

function isSection(desc: string, qty: number, rate: number): boolean {
  if (qty || rate) return false;
  const d = desc.trim();
  return (
    /^section\b/i.test(d) ||
    /^[A-Z0-9 .\-]{3,}$/.test(d) && d === d.toUpperCase() && d.length < 80
  );
}

export function parseBoqBuffer(buffer: Buffer): ParsedBoqRow[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    defval: "",
  }) as unknown[][];

  let headerIdx = -1;
  let colMap: Record<string, number> = {};
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const m = mapHeader(rows[i] || []);
    if (m.description !== undefined && (m.qty !== undefined || m.rate !== undefined || m.amount !== undefined)) {
      headerIdx = i;
      colMap = m;
      break;
    }
  }
  if (headerIdx < 0) {
    colMap = { srNo: 0, description: 1, qty: 2, rate: 3, unit: 4, amount: 5 };
    headerIdx = 0;
  }

  const out: ParsedBoqRow[] = [];
  let currentSection: string | undefined;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const description = String(row[colMap.description ?? 1] ?? "").trim();
    if (isJunk(description)) continue;

    const qty = num(row[colMap.qty ?? -1]);
    const rate = num(row[colMap.rate ?? -1]);
    let amount = num(row[colMap.amount ?? -1]);
    if (!amount && qty && rate) amount = qty * rate;

    if (isSection(description, qty, rate)) {
      currentSection = description;
      out.push({
        description,
        section: description,
        qty: 0,
        rate: 0,
        amount: 0,
        rowKind: "section",
        srNo: String(row[colMap.srNo ?? 0] ?? ""),
      });
      continue;
    }

    out.push({
      srNo: String(row[colMap.srNo ?? 0] ?? ""),
      description,
      section: currentSection,
      qty,
      rate,
      unit: colMap.unit !== undefined ? String(row[colMap.unit] ?? "") : undefined,
      amount,
      costCode: colMap.costCode !== undefined ? String(row[colMap.costCode] ?? "") : undefined,
      rowKind: "item",
    });
  }

  return out;
}
