/** Horizontal sub-nav inside the Drawings module (GFC, register, design coordination, etc.) */

export type DrawingsNavItem = {
  key: string;
  label: string;
  to: string;
  query?: string;
  roles?: string[];
};

export const DRAWINGS_MODULE_NAV: DrawingsNavItem[] = [
  { key: "hub", label: "Module hub", to: "hub/drawings" },
  { key: "gfc", label: "GFC register", to: "drawings" },
  { key: "register", label: "Register dashboard", to: "drawings/register" },
  { key: "register-master", label: "Master register", to: "drawings/register", query: "sheet=master" },
  { key: "coordination", label: "Design coordination", to: "drawings/coordination" },
  { key: "library", label: "Drawing files", to: "drawings/library" },
  {
    key: "checklist",
    label: "Checklist manager",
    to: "drawings/checklist-master",
    roles: ["admin", "office", "employee"],
  },
  {
    key: "fill-log",
    label: "Checklist fill log",
    to: "drawings/checklist-logs",
  },
  {
    key: "rfi-register",
    label: "RFI register",
    to: "rfis",
    query: "view=register",
  },
  {
    key: "rfi-fill",
    label: "Request fill",
    to: "rfis",
    query: "kind=DrawingChecklist&compose=1",
  },
  {
    key: "rfi-ask",
    label: "Ask RFI",
    to: "rfis",
    query: "kind=RequestForInformation&compose=1",
  },
];

export function drawingsNavActive(key: string, pathname: string, search: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  const pid = parts.indexOf("projects");
  const rest = pid >= 0 ? parts.slice(pid + 2).join("/") : "";

  switch (key) {
    case "hub":
      return rest === "hub/drawings";
    case "gfc":
      return rest === "drawings";
    case "register":
      return rest.startsWith("drawings/register") && !search.includes("sheet=");
    case "register-master":
      return rest.startsWith("drawings/register") && search.includes("sheet=master");
    case "coordination":
      return rest === "drawings/coordination" || rest === "coordination";
    case "library":
      return rest.startsWith("drawings/library");
    case "checklist":
      return rest === "drawings/checklist-master";
    case "fill-log":
      return rest === "drawings/checklist-logs";
    case "rfi-register":
      return rest === "rfis" && search.includes("view=register");
    case "rfi-fill":
      return rest === "rfis" && search.includes("kind=DrawingChecklist") && search.includes("compose=1");
    case "rfi-ask":
      return rest === "rfis" && search.includes("kind=RequestForInformation") && search.includes("compose=1");
    default:
      return false;
  }
}
