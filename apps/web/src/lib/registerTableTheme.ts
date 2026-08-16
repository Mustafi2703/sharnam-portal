/** Theme-aware CSS classes for drawing register tables (light + dark via index.css) */

export function disciplineClass(discipline?: string | null) {
  const d = (discipline || "").toLowerCase();
  if (d.includes("arch") || d.includes("facade") || d.includes("interior")) return "reg-discipline reg-discipline--arch";
  if (d.includes("struct")) return "reg-discipline reg-discipline--struct";
  if (d.includes("mep")) return "reg-discipline reg-discipline--mep";
  if (d.includes("civil")) return "reg-discipline reg-discipline--civil";
  return "reg-discipline reg-discipline--default";
}

const PACKAGE_CLASS: Record<string, string> = {
  "Package A": "reg-pkg reg-pkg--a",
  "Package B": "reg-pkg reg-pkg--b",
  "Package C": "reg-pkg reg-pkg--c",
  "Package D": "reg-pkg reg-pkg--d",
};

export function packageClass(pkg?: string | null) {
  if (!pkg) return "reg-pkg reg-pkg--default";
  return PACKAGE_CLASS[pkg] || "reg-pkg reg-pkg--default";
}

export function delayClass(days: number | null | undefined) {
  if (days == null) return "reg-delay reg-delay--na";
  if (days < 0) return "reg-delay reg-delay--early";
  if (days > 0) return "reg-delay reg-delay--late";
  return "reg-delay reg-delay--on-time";
}
