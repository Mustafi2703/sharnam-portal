/** Maps a QAP "records" cell to the enclosures the IR must attach. */

export type QapEnclosureKind = "checklist" | "file";

export type QapRequiredEnclosure = {
  key: string;
  label: string;
  kind: QapEnclosureKind;
};

const RULES: { test: RegExp; item: QapRequiredEnclosure }[] = [
  { test: /work\s*check\s*list|checklist/i, item: { key: "checklist", label: "Work Check List", kind: "checklist" } },
  { test: /\bmtc\b|material test certificate/i, item: { key: "mtc", label: "MTC", kind: "file" } },
  { test: /\btpc\b|test report/i, item: { key: "testReport", label: "TPC / Test Report", kind: "file" } },
  { test: /calibration/i, item: { key: "calibration", label: "Calibration Certificate", kind: "file" } },
  { test: /bar bending|bbs/i, item: { key: "bbs", label: "Bar Bending Schedule", kind: "file" } },
  { test: /setting out/i, item: { key: "settingOut", label: "Setting out plan", kind: "file" } },
  { test: /level book/i, item: { key: "levelBook", label: "Level book", kind: "file" } },
  { test: /concrete log/i, item: { key: "concreteLog", label: "Concrete log", kind: "file" } },
  { test: /register\/?\s*note|register/i, item: { key: "registerNote", label: "Register/Note", kind: "file" } },
  { test: /material data sheet|\bmds\b/i, item: { key: "mds", label: "Material Data Sheet", kind: "file" } },
  { test: /photograph/i, item: { key: "photographs", label: "Photographs", kind: "file" } },
];

export function requiredEnclosures(records: string | null | undefined): QapRequiredEnclosure[] {
  const text = String(records || "");
  if (!text.trim()) return [];
  const parts = text.split(/[,;\n|/]+/).map((p) => p.trim()).filter(Boolean);
  const out: QapRequiredEnclosure[] = [];
  const seen = new Set<string>();
  const chunks = parts.length ? parts : [text];
  for (const chunk of chunks) {
    for (const rule of RULES) {
      if (!rule.test.test(chunk) || seen.has(rule.item.key)) continue;
      seen.add(rule.item.key);
      out.push(rule.item);
    }
  }
  return out;
}

export function enclosureFileName(irNo: string, recordLabel: string, originalName: string): string {
  const clean = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return `${clean(irNo) || "IR"} - ${clean(recordLabel) || "record"} - ${clean(originalName) || "file"}`;
}
