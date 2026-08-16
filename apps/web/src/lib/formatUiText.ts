/** Acronyms / brands — keep canonical casing when title-casing UI labels */
const ACRONYMS = new Set([
  "PDF",
  "DWG",
  "GFC",
  "DPR",
  "WPR",
  "RFI",
  "RFIs",
  "QI",
  "QAP",
  "NCR",
  "CAR",
  "SOR",
  "ISO",
  "HRMS",
  "CRM",
  "DMS",
  "BBS",
  "MB",
  "BOQ",
  "PMC",
  "SPDC",
  "MEP",
  "MEPF",
  "IST",
  "GPS",
  "COP",
  "MoM",
  "MOM",
  "HSE",
  "XLSX",
  "CSV",
  "HTML",
  "URL",
  "API",
  "KPI",
  "TL",
  "RA",
  "PO",
  "DC",
  "DWG",
  "R0",
  "R1",
  "R2",
  "R3",
  "R4",
  "R5",
]);

const BRANDS: Record<string, string> = {
  sharepoint: "SharePoint",
  onedrive: "OneDrive",
  excel: "Excel",
  procore: "Procore",
};

function formatWord(word: string): string {
  if (!word) return word;
  const bare = word.replace(/['’]/g, "");
  const upper = bare.toUpperCase();

  if (ACRONYMS.has(bare) || ACRONYMS.has(upper)) {
    return ACRONYMS.has(bare) ? bare : upper;
  }
  if (/^R\d+$/.test(bare)) return bare.toUpperCase();
  if (/^[A-Z]{1,4}-\d[\dA-Z-]*$/i.test(bare)) return bare.toUpperCase();
  if (/^\d+$/.test(bare)) return bare;

  const brand = BRANDS[bare.toLowerCase()];
  if (brand) return brand;

  if (bare === bare.toUpperCase() && bare.length >= 2 && bare.length <= 5) {
    return bare;
  }

  const lower = word.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Title-case UI copy: each word capitalized, rest lowercase; preserves acronyms and drawing codes. */
export function formatUiText(text: string | null | undefined): string {
  if (text == null || text === "") return text ?? "";
  return String(text).replace(/\b([A-Za-z0-9']+)\b/g, (word) => formatWord(word));
}
