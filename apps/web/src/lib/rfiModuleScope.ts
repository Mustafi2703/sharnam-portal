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
  | "Manual"
  | "ClientConcern";

/** Which module owns the current RFI page — keeps Drawing / Quality / Safety checklists separate. */
export type RfiModuleScope = "drawings" | "quality" | "safety" | "comms" | "inspection" | "field" | "home";

export function rfiModuleScope(pathname: string, search: string): RfiModuleScope {
  const ws = resolveProjectWorkspace(pathname, search);
  if (ws === "home") return "home";
  if (ws === "drawings" || ws === "quality" || ws === "safety" || ws === "comms" || ws === "field" || ws === "inspection")
    return ws;
  return "home";
}

export function defaultRfiKindForModule(scope: RfiModuleScope): RfiKindFilter | null {
  if (scope === "quality") return "QualityInspection";
  if (scope === "safety") return "SafetyChecklist";
  if (scope === "drawings") return "DrawingChecklist";
  return null;
}

export function rfiKindFromSearch(search: URLSearchParams): RfiKindFilter | null {
  const q = search.get("kind");
  if (!q) return null;
  return q as RfiKindFilter;
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
      subtitle: "Request for Information — link a drawing revision. Register lives under Drawings → RFI register.",
    };
  }
  if (scope === "drawings" && kind === "All") {
    return {
      eyebrow: "Drawings module",
      title: "RFI register",
      subtitle: "Drawing checklist fills and PMC requests for information — SPDC_RFI_Form_and_Register.xlsx.",
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
  return {
    eyebrow: "Simple request types",
    title: "Requests",
    subtitle: "Ask (PMC), drawing checklist, QI fill, or safety checklist — each module has its own tools.",
  };
}

export function rfiListKindFilter(scope: RfiModuleScope, kindFilter: RfiKindFilter): RfiKindFilter {
  if (scope === "quality") return "QualityInspection";
  if (scope === "safety") return "SafetyChecklist";
  if (scope === "drawings" && (kindFilter === "RequestForInformation" || kindFilter === "All")) return kindFilter;
  if (scope === "drawings") return "DrawingChecklist";
  return kindFilter;
}

export function checklistFamilyForRfiKind(rfiKind: string | undefined): "DrawingCheck" | "QualityInspection" | "Safety" | "SiteExecution" {
  if (rfiKind === "QualityInspection") return "QualityInspection";
  if (rfiKind === "SafetyChecklist") return "Safety";
  if (rfiKind === "DrawingChecklist") return "DrawingCheck";
  return "SiteExecution";
}

export function isModuleScopedRfi(scope: RfiModuleScope): boolean {
  return scope === "drawings" || scope === "quality" || scope === "safety";
}

export function moduleForChecklistFamily(family: string): WorkspaceKey | "field" {
  if (family === "DrawingCheck") return "drawings";
  if (family === "Safety") return "safety";
  if (family === "SiteExecution") return "field";
  return "quality";
}
