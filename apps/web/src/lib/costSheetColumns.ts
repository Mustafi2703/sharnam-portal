/** SPDC cost sheet column bands — matches Excel Monitoring / MB / BBS colour groups. */

export type MonColGroup = "meta" | "qty" | "cost" | "pct" | "ev";

export const MON_COLUMN_GROUPS: { key: MonColGroup; label: string; from: number; to: number }[] = [
  { key: "meta", label: "Item / Rate", from: 0, to: 4 },
  { key: "qty", label: "Quantities", from: 5, to: 11 },
  { key: "cost", label: "Cost ₹", from: 12, to: 18 },
  { key: "pct", label: "% Progress", from: 19, to: 22 },
  { key: "ev", label: "EV · CPI · ETC", from: 23, to: 39 },
];

export const MB_COLUMN_GROUPS = [
  { key: "meta", label: "Item", from: 0, to: 2 },
  { key: "dims", label: "Dimensions", from: 3, to: 7 },
  { key: "result", label: "Qty / Bill", from: 8, to: 11 },
] as const;

export const BBS_COLUMN_GROUPS = [
  { key: "meta", label: "Bar mark", from: 0, to: 3 },
  { key: "bar", label: "Bar nos", from: 4, to: 7 },
  { key: "shape", label: "Shape A–E", from: 8, to: 12 },
  { key: "total", label: "Length / Weight", from: 13, to: 15 },
] as const;

function monGroupForIndex(index: number): MonColGroup {
  if (index <= 4) return "meta";
  if (index <= 11) return "qty";
  if (index <= 18) return "cost";
  if (index <= 22) return "pct";
  return "ev";
}

export function monitoringColClass(index: number, opts?: { achieved?: boolean; sticky?: boolean; extra?: string }) {
  const g = monGroupForIndex(index);
  return [
    "cost-col",
    `cost-col--${g}`,
    opts?.achieved || index === 8 ? "cost-col--achieved" : "",
    opts?.sticky ? "sticky-col" : "",
    opts?.extra || "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function mbColClass(index: number, opts?: { sticky?: boolean; extra?: string }) {
  let g: string = "meta";
  if (index >= 3 && index <= 7) g = "dims";
  else if (index >= 8 && index <= 11) g = "result";
  return ["cost-col", `cost-col--${g}`, opts?.sticky ? "sticky-col" : "", opts?.extra || ""].filter(Boolean).join(" ");
}

export function bbsColClass(index: number, opts?: { sticky?: boolean; extra?: string }) {
  let g: string = "meta";
  if (index >= 4 && index <= 7) g = "bar";
  else if (index >= 8 && index <= 12) g = "shape";
  else if (index >= 13 && index <= 15) g = "total";
  return ["cost-col", `cost-col--${g}`, opts?.sticky ? "sticky-col" : "", opts?.extra || ""].filter(Boolean).join(" ");
}
