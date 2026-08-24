/**
 * Finance commercial packages — mirrors Payment Summary - VIATRIX workbook tabs.
 * Canonical module config lives here (not in packages/shared).
 * Portal hub alignment: each package maps to a workspace module for Cost / Progress / Safety links.
 */
export type FinanceBillKind = "ra" | "material";

/** Portal workspace module this commercial package rolls up to (see workspaces.ts). */
export type FinanceHubModule = "finance" | "cost" | "progress" | "safety";

export type FinanceSheetColumn = {
  key: string;
  label: string;
  type?: "text" | "number" | "date";
  /** RaBill / FinanceMaterialInvoice field */
  field?: string;
  width?: number;
};

export const FINANCE_RA_COLUMNS: FinanceSheetColumn[] = [
  { key: "srNo", label: "Sr. No.", type: "number" },
  { key: "description", label: "Description of Goods", field: "raNumber" },
  { key: "taxInvoiceNo", label: "Tax Invoice No.", field: "invoiceNumber" },
  { key: "invoiceDate", label: "Invoice Date", field: "invoiceDate", type: "date" },
  { key: "againstBillRaised", label: "Against bill Raised", field: "againstBillRaised", type: "number" },
  { key: "priceVariation", label: "Price Variation of material", field: "priceVariation", type: "number" },
  { key: "totalInvoiceWithoutGst", label: "Total Invoice value without GST", field: "totalInvoiceWithoutGst", type: "number" },
  { key: "advanceAdjusted", label: "Steel advance 85% adjusted as per consumption", field: "advanceAdjusted", type: "number" },
  { key: "totalInvoiceWithGst", label: "Total Invoice value withGST", field: "totalInvoiceWithGst", type: "number" },
  { key: "retentionAmount", label: "Retentions (5%)", field: "retentionAmount", type: "number" },
  { key: "netAmountPayable", label: "Net Amount Payable Against This Bill With Advanced Amount", field: "netAmountPayable", type: "number" },
];

export const FINANCE_MATERIAL_COLUMNS: FinanceSheetColumn[] = [
  { key: "srNo", label: "Sr. No.", field: "srNo" },
  { key: "receivedDate", label: "Recieved Date", field: "receivedDate", type: "date" },
  { key: "description", label: "Description of Goods", field: "description" },
  { key: "taxInvoiceNo", label: "Tax Invoice No.", field: "taxInvoiceNo" },
  { key: "invoiceDate", label: "Invoice Date", field: "invoiceDate", type: "date" },
  { key: "amountWithoutGst", label: "Total Invoice value without GST", field: "amountWithoutGst", type: "number" },
  { key: "amountWithGst", label: "Total Invoice value with GST", field: "amountWithGst", type: "number" },
];

export function sheetColumnsForPackage(pkg: FinancePackage): FinanceSheetColumn[] {
  return pkg.billKind === "ra" ? FINANCE_RA_COLUMNS : FINANCE_MATERIAL_COLUMNS;
}

export type FinancePackage = {
  key: string;
  label: string;
  billKind: FinanceBillKind;
  discipline: string;
  sheetName: string;
  summarySheet?: string;
  poHints?: string[];
  /** Which portal hub module owns engineering qty / inspection context for this package */
  hubModule: FinanceHubModule;
  /** Cost MB/BBS package label hint (Cost module) */
  costPackageHint?: string;
};

export const FINANCE_PACKAGES: FinancePackage[] = [
  {
    key: "civil",
    label: "Civil · RA Bill",
    billKind: "ra",
    discipline: "Civil",
    sheetName: "CIVIL RA Bill",
    summarySheet: "Summary Civil",
    poHints: ["civil", "structural", "factory building"],
    hubModule: "cost",
    costPackageHint: "Civil",
  },
  {
    key: "peb-supply",
    label: "PEB · Supply Material",
    billKind: "material",
    discipline: "PEB",
    sheetName: "PEB Supply Material",
    poHints: ["peb", "pre-engineered", "supply"],
    hubModule: "progress",
    costPackageHint: "PEB Supply",
  },
  {
    key: "peb-erection",
    label: "PEB · Erection",
    billKind: "material",
    discipline: "PEB",
    sheetName: "PEB ERECTION",
    poHints: ["peb", "erection"],
    hubModule: "progress",
    costPackageHint: "PEB Erection",
  },
  {
    key: "civil-steel",
    label: "Civil · Steel",
    billKind: "material",
    discipline: "Civil",
    sheetName: "CIVIL STEEL",
    poHints: ["steel", "rebar", "tmt"],
    hubModule: "cost",
    costPackageHint: "Steel",
  },
  {
    key: "fire",
    label: "Fire / Karmasth",
    billKind: "material",
    discipline: "Fire",
    sheetName: "Karmasth Fire",
    poHints: ["fire", "karmasth", "fm200", "sprinkler"],
    hubModule: "safety",
    costPackageHint: "Fire Fighting",
  },
  {
    key: "mep",
    label: "MEP · RA Bill",
    billKind: "ra",
    discipline: "MEP",
    sheetName: "MEP RA Bill",
    poHints: ["mep", "electrical", "plumbing", "hvac", "mechanical"],
    hubModule: "cost",
    costPackageHint: "MEP",
  },
  {
    key: "safety",
    label: "Safety",
    billKind: "material",
    discipline: "Safety",
    sheetName: "Safety",
    poHints: ["safety", "ppe", "scaffolding"],
    hubModule: "safety",
  },
  {
    key: "facade",
    label: "Facade / Finishing",
    billKind: "ra",
    discipline: "Facade",
    sheetName: "Facade RA Bill",
    poHints: ["facade", "finishing", "cladding"],
    hubModule: "progress",
    costPackageHint: "Facade",
  },
  {
    key: "other",
    label: "Other",
    billKind: "material",
    discipline: "Other",
    sheetName: "Other",
    hubModule: "finance",
  },
];

export function normalizeFinanceKey(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Resolve package from URL key, sheet name, discipline label, or sheetCategory. */
export function resolveFinancePackage(raw: string | null | undefined): FinancePackage | null {
  if (!raw || raw === "all") return null;
  const key = normalizeFinanceKey(raw);
  const text = String(raw).trim().toLowerCase();

  for (const pkg of FINANCE_PACKAGES) {
    if (normalizeFinanceKey(pkg.key) === key) return pkg;
    if (normalizeFinanceKey(pkg.discipline) === key) return pkg;
    if (pkg.sheetName.toLowerCase() === text) return pkg;
    if (normalizeFinanceKey(pkg.sheetName) === key) return pkg;
  }

  if (/civil ra/i.test(text)) return FINANCE_PACKAGES.find((p) => p.key === "civil") ?? null;
  if (/peb supply/i.test(text)) return FINANCE_PACKAGES.find((p) => p.key === "peb-supply") ?? null;
  if (/peb erect/i.test(text)) return FINANCE_PACKAGES.find((p) => p.key === "peb-erection") ?? null;
  if (/civil steel/i.test(text)) return FINANCE_PACKAGES.find((p) => p.key === "civil-steel") ?? null;
  if (/fire|karmasth/i.test(text)) return FINANCE_PACKAGES.find((p) => p.key === "fire") ?? null;

  return FINANCE_PACKAGES.find((p) => p.key === "other") ?? null;
}

export function packageForRaBill(ra: { discipline?: string | null }): FinancePackage {
  const hit =
    resolveFinancePackage(ra.discipline) ??
    FINANCE_PACKAGES.find((p) => p.billKind === "ra" && p.discipline.toLowerCase() === String(ra.discipline ?? "").toLowerCase());
  return hit ?? FINANCE_PACKAGES.find((p) => p.key === "civil")!;
}

export function packageForMaterialInvoice(inv: { sheetCategory?: string | null }): FinancePackage {
  return resolveFinancePackage(inv.sheetCategory) ?? FINANCE_PACKAGES.find((p) => p.key === "other")!;
}

export function packageForPo(po: { packageName?: string | null; workTrade?: string | null }): FinancePackage | null {
  const blob = `${po.packageName ?? ""} ${po.workTrade ?? ""}`.toLowerCase();
  if (!blob.trim()) return null;
  for (const pkg of FINANCE_PACKAGES) {
    if (pkg.poHints?.some((h) => blob.includes(h))) return pkg;
  }
  return null;
}

export function raMatchesPackage(
  ra: { discipline?: string | null; purchaseOrder?: { packageName?: string | null; workTrade?: string | null } | null },
  pkg: FinancePackage | null
): boolean {
  if (!pkg) return true;
  if (pkg.billKind !== "ra") return false;
  const raPkg = packageForRaBill(ra);
  if (raPkg.key === pkg.key) return true;
  if (ra.discipline && ra.discipline.toLowerCase() === pkg.discipline.toLowerCase()) return true;
  const poPkg = ra.purchaseOrder ? packageForPo(ra.purchaseOrder) : null;
  return poPkg?.key === pkg.key;
}

export function materialMatchesPackage(
  inv: { sheetCategory?: string | null },
  pkg: FinancePackage | null
): boolean {
  if (!pkg) return true;
  if (pkg.billKind !== "material") return false;
  return packageForMaterialInvoice(inv).key === pkg.key;
}

export function poMatchesPackage(
  po: { packageName?: string | null; workTrade?: string | null },
  pkg: FinancePackage | null
): boolean {
  if (!pkg) return true;
  const poPkg = packageForPo(po);
  if (poPkg?.key === pkg.key) return true;
  if (pkg.poHints?.some((h) => `${po.packageName ?? ""} ${po.workTrade ?? ""}`.toLowerCase().includes(h))) return true;
  return false;
}

export function copMatchesPackage(
  cop: { workTrade?: string | null; purchaseOrder?: { packageName?: string | null; workTrade?: string | null } | null },
  pkg: FinancePackage | null
): boolean {
  if (!pkg) return true;
  const blob = `${cop.workTrade ?? ""} ${cop.purchaseOrder?.packageName ?? ""} ${cop.purchaseOrder?.workTrade ?? ""}`.toLowerCase();
  if (pkg.poHints?.some((h) => blob.includes(h))) return true;
  return pkg.discipline.toLowerCase() === String(cop.workTrade ?? "").toLowerCase();
}

export type FinanceDisciplineRollup = {
  key: string;
  label: string;
  billKind: FinanceBillKind;
  discipline: string;
  sheetName: string;
  raCount: number;
  materialCount: number;
  poCount: number;
  copCount: number;
  billedWithoutGst: number;
  billedWithGst: number;
  netPayable: number;
  retention: number;
  advanceAdjusted: number;
  copPayable: number;
};

export function buildFinanceDisciplineRollup(input: {
  ras: Array<{
    discipline?: string | null;
    totalInvoiceWithoutGst: number;
    totalInvoiceWithGst: number;
    netAmountPayable: number;
    retentionAmount: number;
    advanceAdjusted: number;
    purchaseOrder?: { packageName?: string | null; workTrade?: string | null } | null;
  }>;
  materials: Array<{
    sheetCategory?: string | null;
    amountWithoutGst: number;
    amountWithGst: number;
    netPayable: number;
    retentionAmount?: number;
  }>;
  pos: Array<{ packageName?: string | null; workTrade?: string | null }>;
  cops: Array<{
    amountPayable: number;
    workTrade?: string | null;
    purchaseOrder?: { packageName?: string | null; workTrade?: string | null } | null;
  }>;
}): FinanceDisciplineRollup[] {
  return FINANCE_PACKAGES.map((pkg) => {
    const pkgRas = input.ras.filter((r) => raMatchesPackage(r, pkg));
    const pkgMaterials = input.materials.filter((m) => materialMatchesPackage(m, pkg));
    const pkgPos = input.pos.filter((p) => poMatchesPackage(p, pkg));
    const pkgCops = input.cops.filter((c) => copMatchesPackage(c, pkg));

    const raBilled = pkgRas.reduce((n, r) => n + r.totalInvoiceWithoutGst, 0);
    const matBilled = pkgMaterials.reduce((n, m) => n + m.amountWithoutGst, 0);

    return {
      key: pkg.key,
      label: pkg.label,
      billKind: pkg.billKind,
      discipline: pkg.discipline,
      sheetName: pkg.sheetName,
      raCount: pkgRas.length,
      materialCount: pkgMaterials.length,
      poCount: pkgPos.length,
      copCount: pkgCops.length,
      billedWithoutGst: raBilled + matBilled,
      billedWithGst:
        pkgRas.reduce((n, r) => n + r.totalInvoiceWithGst, 0) +
        pkgMaterials.reduce((n, m) => n + m.amountWithGst, 0),
      netPayable:
        pkgRas.reduce((n, r) => n + r.netAmountPayable, 0) + pkgMaterials.reduce((n, m) => n + m.netPayable, 0),
      retention:
        pkgRas.reduce((n, r) => n + r.retentionAmount, 0) +
        pkgMaterials.reduce((n, m) => n + (m.retentionAmount ?? 0), 0),
      advanceAdjusted: pkgRas.reduce((n, r) => n + r.advanceAdjusted, 0),
      copPayable: pkgCops.reduce((n, c) => n + c.amountPayable, 0),
    };
  });
}
