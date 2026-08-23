import { resolveProjectWorkspace } from "./projectWorkspace";
import type { WorkspaceKey } from "../workspaces";

export type RfiKindFilter =
  | "All"
  | "RequestForInformation"
  | "DrawingChecklist"
  | "QualityInspection"
  | "SafetyChecklist"
  | "QualityIR"
  | "SafetyIR"
  | "ActivityInspection"
  | "SiteExecution"
  | "Manual"
  | "ClientConcern";

/** Which module owns the current RFI page — keeps Drawing / Quality / Safety checklists separate. */
export type RfiModuleScope = "drawings" | "quality" | "safety" | "comms" | "inspection" | "progress" | "home";

export function rfiModuleScope(pathname: string, search: string): RfiModuleScope {
  const ws = resolveProjectWorkspace(pathname, search);
  if (ws === "home") return "home";
  if (
    ws === "drawings" ||
    ws === "quality" ||
    ws === "safety" ||
    ws === "comms" ||
    ws === "progress" ||
    ws === "inspection"
  )
    return ws;
  return "home";
}

export function defaultRfiKindForModule(scope: RfiModuleScope): RfiKindFilter | null {
  if (scope === "quality") return "QualityInspection";
  if (scope === "safety") return "SafetyChecklist";
  if (scope === "drawings") return "DrawingChecklist";
  if (scope === "progress" || scope === "comms") return "SiteExecution";
  return null;
}

export function rfiKindFromSearch(search: URLSearchParams): RfiKindFilter | null {
  const q = search.get("kind");
  if (!q) return null;
  return q as RfiKindFilter;
}

/** Drawings → Ask (PMC RFI) compose page — separate from the read-only register. */
export function isRfiComposeMode(search: URLSearchParams): boolean {
  return search.get("compose") === "1";
}

/** Drawings → RFI register (SPDC log) — list only, no compose form on the same screen. */
export function isDrawingRfiRegisterMode(scope: RfiModuleScope, search: URLSearchParams): boolean {
  return scope === "drawings" && search.get("view") === "register" && !isRfiComposeMode(search);
}

/** Kind pills shown per module — never mix Drawing check with QI or Safety on module pages. */
export function rfiKindPillsForScope(scope: RfiModuleScope): [RfiKindFilter, string][] {
  switch (scope) {
    case "drawings":
      return [
        ["DrawingChecklist", "Request checklist fill"],
        ["RequestForInformation", "Ask (PMC RFI)"],
        ["All", "All RFIs"],
      ];
    case "quality":
      return [["QualityInspection", "Request QI fill"]];
    case "safety":
      return [["SafetyChecklist", "Safety checklist fill"]];
    case "progress":
    case "comms":
      return [["SiteExecution", "Site checklist fill"]];
    case "inspection":
      return [
        ["QualityIR", "Quality IR"],
        ["SafetyIR", "Safety IR"],
        ["ActivityInspection", "Activity checklist"],
      ];
    case "comms":
      return [
        ["All", "All"],
        ["RequestForInformation", "Ask (PMC)"],
        ["QualityIR", "Quality IR"],
        ["SafetyIR", "Safety IR"],
        ["ActivityInspection", "Activity checklist"],
        ["ClientConcern", "Client"],
      ];
    default:
      return [
        ["All", "All"],
        ["RequestForInformation", "Ask (PMC)"],
        ["DrawingChecklist", "Request checklist fill"],
        ["QualityInspection", "Request QI fill"],
        ["SafetyChecklist", "Safety checklist fill"],
        ["ClientConcern", "Client"],
      ];
  }
}

export function rfiPageCopy(scope: RfiModuleScope, kind: RfiKindFilter): { eyebrow: string; title: string; subtitle: string } {
  if (scope === "quality" || kind === "QualityInspection") {
    return {
      eyebrow: "Quality module",
      title: "Request QI fill",
      subtitle:
        "Quality inspection checklists only — separate from Drawings and Safety. Procore-style QI is under Quality → QI & checklist fills.",
    };
  }
  if (scope === "safety" || kind === "SafetyChecklist") {
    return {
      eyebrow: "Safety module",
      title: "Safety checklist fill request",
      subtitle: "Safety checklists only — not Quality QI or Drawing check master.",
    };
  }
  if (scope === "drawings" && kind === "RequestForInformation") {
    return {
      eyebrow: "Drawings module",
      title: "Ask (PMC RFI)",
      subtitle:
        "Request for Information — link a drawing revision and attach the Drawing Check checklist for this RFI. View the log under Drawings → RFI register.",
    };
  }
  if (scope === "drawings" && (kind === "All" || kind === "Manual")) {
    return {
      eyebrow: "Drawings module",
      title: "RFI register",
      subtitle:
        "Live SPDC RFI register — drawing checklist fills and PMC requests for information. Use Ask (PMC RFI) to raise a new entry.",
    };
  }
  if (scope === "drawings" || kind === "DrawingChecklist") {
    return {
      eyebrow: "Drawings module",
      title: "Request drawing checklist fill",
      subtitle:
        "Drawing Check Master templates only — link a drawing revision when relevant. Quality and Safety checklists live in their own modules.",
    };
  }
  if ((scope === "progress" || scope === "comms") || kind === "SiteExecution") {
    return {
      eyebrow: "Site execution",
      title: "Site checklist fill",
      subtitle: "Site execution checklists from Progress checklist master — fill, then the sheet report is generated.",
    };
  }
  if (scope === "inspection" || kind === "QualityIR" || kind === "SafetyIR" || kind === "ActivityInspection") {
    return {
      eyebrow: "Inspection module",
      title: "Inspection request",
      subtitle: "Quality, Safety, or Activity — select the checklist from master for this fill.",
    };
  }
  return {
    eyebrow: "Simple request types",
    title: "Requests",
    subtitle: "Ask (PMC), drawing checklist, QI fill, or safety checklist — each module has its own tools.",
  };
}

export function rfiListKindFilter(scope: RfiModuleScope, kindFilter: RfiKindFilter): RfiKindFilter {
  if (scope === "quality") return "QualityInspection";
  if (scope === "safety") return "SafetyChecklist";
  if (scope === "progress" || scope === "comms") return "SiteExecution";
  if (scope === "drawings" && kindFilter === "All") return "All";
  if (scope === "drawings" && kindFilter === "RequestForInformation") return "RequestForInformation";
  if (scope === "drawings") return "DrawingChecklist";
  return kindFilter;
}

export function checklistFamilyForRfiKind(
  rfiKind: string | undefined
): "DrawingCheck" | "QualityInspection" | "Safety" | "SiteExecution" | "ActivityInspection" {
  if (rfiKind === "QualityInspection" || rfiKind === "QualityIR") return "QualityInspection";
  if (rfiKind === "SafetyChecklist" || rfiKind === "SafetyIR") return "Safety";
  if (rfiKind === "DrawingChecklist" || rfiKind === "RequestForInformation" || rfiKind === "Manual") return "DrawingCheck";
  if (rfiKind === "ActivityInspection") return "ActivityInspection";
  return "SiteExecution";
}

export function isModuleScopedRfi(scope: RfiModuleScope): boolean {
  return scope === "drawings" || scope === "quality" || scope === "safety" || scope === "progress" || scope === "comms";
}

export function moduleForChecklistFamily(family: string): WorkspaceKey {
  if (family === "DrawingCheck") return "drawings";
  if (family === "Safety") return "safety";
  if (family === "SiteExecution") return "progress";
  return "quality";
}
