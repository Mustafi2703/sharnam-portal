/** Download a CSV file from header + row arrays (browser-side). */
export function downloadCsv(filename: string, headers: string[], rows: (string | number | boolean | null | undefined)[][]) {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const body = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const CHECKLIST_CSV_HEADERS = ["description", "instruction", "section", "requirePhoto"] as const;

export const CHECKLIST_CSV_DETAILED_SAMPLE: string[][] = [
  ["Verify drawing number matches GFC register", "Cross-check against latest published revision", "Identity", "true"],
  ["Check north orientation / key plan", "Confirm site north matches sheet", "Layout", "false"],
  ["Confirm levels and grid references", "Highlight mismatches vs survey", "Levels", "true"],
  ["Review notes and legends for conflicts", "Log conflicts as RFI if needed", "Notes", "false"],
  ["Safety / site constraint callouts present", "Photo of sheet title block required", "Safety", "true"],
];

export const USER_CSV_HEADERS = [
  "fullName",
  "email",
  "role",
  "phone",
  "empCode",
  "department",
  "designation",
  "password",
] as const;

export const USER_CSV_DETAILED_SAMPLE: string[][] = [
  ["Asha Site", "asha.site@example.com", "site_employee", "9876500001", "EMP-1001", "Site", "Supervisor", "Demo@1234"],
  ["Ravi Office", "ravi.office@example.com", "office", "9876500002", "EMP-1002", "PMC", "Coordinator", "Demo@1234"],
  ["Client User", "client.demo@example.com", "client", "9876500003", "", "", "", "Demo@1234"],
  ["Vendor Contact", "vendor.demo@example.com", "vendor", "9876500004", "", "Trade", "Contractor", "Demo@1234"],
];
