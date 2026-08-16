/** Horizontal sub-nav inside the Drawings module (GFC, register, design coordination, etc.) */

export type DrawingsNavItem = {
  key: string;
  label: string;
  to: string;
  query?: string;
  roles?: string[];
};

export const DRAWINGS_MODULE_NAV: DrawingsNavItem[] = [
  { key: "gfc", label: "GFC register", to: "drawings" },
  { key: "register", label: "Master register", to: "drawings/register" },
  { key: "coordination", label: "Design coordination", to: "drawings/coordination" },
  { key: "library", label: "Drawing files", to: "drawings/library" },
  {
    key: "checklist",
    label: "Checklist manager",
    to: "checklist-master",
    query: "family=DrawingCheck",
    roles: ["admin", "office", "employee"],
  },
];

export function drawingsNavActive(key: string, pathname: string, search: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  const pid = parts.indexOf("projects");
  const rest = pid >= 0 ? parts.slice(pid + 2).join("/") : "";

  switch (key) {
    case "gfc":
      return rest === "drawings";
    case "register":
      return rest.startsWith("drawings/register");
    case "coordination":
      return rest === "drawings/coordination" || rest === "coordination";
    case "library":
      return rest.startsWith("drawings/library");
    case "checklist":
      return rest === "checklist-master" && search.includes("family=DrawingCheck");
    default:
      return false;
  }
}
