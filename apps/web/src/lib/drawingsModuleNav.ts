/** Horizontal sub-nav inside the Drawings module. */
import { GFC_SCREEN } from "./drawingsLabels";

export type DrawingsNavItem = {
  key: string;
  label: string;
  to: string;
  query?: string;
  roles?: string[];
};

export const DRAWINGS_MODULE_NAV: DrawingsNavItem[] = [
  { key: "hub", label: "Module Hub", to: "hub/drawings" },
  { key: "register", label: "Dashboard", to: "drawings/register" },
  { key: "gfc", label: GFC_SCREEN, to: "drawings" },
  { key: "register-master", label: "Master Register", to: "drawings/register/master" },
  { key: "library", label: "Drawing Files", to: "drawings/library" },
  {
    key: "rfi-ask",
    label: "Ask PMC RFI",
    to: "rfis",
    query: "kind=RequestForInformation&compose=1",
  },
  { key: "coordination", label: "Design Coordination", to: "drawings/coordination" },
  {
    key: "rfi-register",
    label: "RFI Log",
    to: "rfis",
    query: "view=register",
  },
  {
    key: "coordination-log",
    label: "Coordination Log",
    to: "drawings/coordination",
    query: "view=log",
  },
  {
    key: "checklist",
    label: "Checklist Manager",
    to: "drawings/checklist-master",
    roles: ["admin", "office", "employee"],
  },
  {
    key: "fill-log",
    label: "Checklist Fill Log",
    to: "drawings/checklist-logs",
  },
  { key: "settings", label: "Drawing Settings", to: "drawings/settings", roles: ["admin", "office"] },
];

function onCoordination(rest: string) {
  return rest === "drawings/coordination" || rest === "coordination";
}

export function drawingsNavActive(key: string, pathname: string, search: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  const pid = parts.indexOf("projects");
  const rest = pid >= 0 ? parts.slice(pid + 2).join("/") : "";
  const logView = new URLSearchParams(search).get("view") === "log";

  switch (key) {
    case "hub":
      return rest === "hub/drawings";
    case "gfc":
      return rest === "drawings";
    case "register":
      return rest === "drawings/register";
    case "register-master":
      return rest === "drawings/register/master";
    case "coordination":
      return onCoordination(rest) && !logView;
    case "coordination-log":
      return onCoordination(rest) && logView;
    case "library":
      return rest.startsWith("drawings/library");
    case "checklist":
      return rest === "drawings/checklist-master";
    case "fill-log":
      return rest === "drawings/checklist-logs";
    case "settings":
      return rest === "drawings/settings";
    case "rfi-register":
      return rest === "rfis" && search.includes("view=register");
    case "rfi-ask":
      return rest === "rfis" && search.includes("kind=RequestForInformation") && search.includes("compose=1");
    default:
      return false;
  }
}
