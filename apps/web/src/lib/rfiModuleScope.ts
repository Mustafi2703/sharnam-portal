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

/** SPDC branded export templates per checklist / RFI family */
export const SPDC_CHECKLIST_TEMPLATES = {
  drawingRfi: "SPDC_RFI_Form_and_Register.xlsx",
  qualityIr: "SPDC_Request_for_Inspection_Form.xlsx",
  safety: "SPDC_Safety_Inspection_Request_and_Checklists.xlsx",
  activity: "SPDC_Activity_Inspection_Checklist_Format.xlsx",
} as const;

/** Which module owns the current RFI page — keeps Drawing / Quality / Safety / Activity separate. */
export type RfiModuleScope = "drawings" | "quality" | "safety" | "comms" | "inspection" | "home";

export function rfiModuleScope(pathname: string, search: string): RfiModuleScope {
  const ws = resolveProjectWorkspace(pathname, search);
  if (ws === "home") return "home";
  if (ws === "drawings" || ws === "quality" || ws === "safety" || ws === "comms" || ws === "inspection") return ws;
  return "home";
}

export function defaultRfiKindForModule(scope: RfiModuleScope): RfiKindFilter | null {
  if (scope === "quality") return "QualityInspection";
  if (scope === "safety") return "SafetyChecklist";
  if (scope === "drawings") return "RequestForInformation";
  if (scope === "inspection") return "ActivityInspection";
  return null;
}

export function rfiKindFromSearch(search: URLSearchParams): RfiKindFilter | null {
  const q = search.get("kind");
  if (!q) return null;
  return q as RfiKindFilter;
}

export function isRfiComposeMode(search: URLSearchParams): boolean {
  return search.get("compose") === "1";
}

export function isDrawingRfiRegisterMode(scope: RfiModuleScope, search: URLSearchParams): boolean {
  return scope === "drawings" && search.get("view") === "register" && !isRfiComposeMode(search);
}

export function rfiKindPillsForScope(scope: RfiModuleScope): [RfiKindFilter, string][] {
  switch (scope) {
    case "drawings":
      return [
        ["RequestForInformation", "Ask (PMC RFI)"],
        ["DrawingChecklist", "Drawing checklist fill"],
        ["All", "All drawing RFIs"],
      ];
    case "quality":
      return [
        ["QualityInspection", "Quality IR fill"],
        ["SiteExecution", "Site execution fill"],
      ];
    case "safety":
      return [["SafetyChecklist", "Safety checklist fill"]];
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
        ["ClientConcern", "Client"],
      ];
    default:
      return [
        ["All", "All"],
        ["RequestForInformation", "Ask (PMC)"],
        ["DrawingChecklist", "Drawing checklist"],
        ["QualityInspection", "Quality IR"],
        ["SafetyChecklist", "Safety"],
        ["ActivityInspection", "Activity"],
        ["SiteExecution", "Site execution"],
        ["ClientConcern", "Client"],
      ];
  }
}

export function rfiPageCopy(scope: RfiModuleScope, kind: RfiKindFilter): { eyebrow: string; title: string; subtitle: string } {
  if (scope === "quality" && kind === "SiteExecution") {
    return {
      eyebrow: "Quality module · site execution",
      title: "Site checklist fill request",
      subtitle:
        "Final Index / field site checklists (SPDC Activity format) — assign from Quality checklist master, partial save, branded XLSX to SharePoint.",
    };
  }
  if (scope === "quality" || kind === "QualityInspection" || kind === "QualityIR") {
    return {
      eyebrow: "Quality module",
      title: "Quality inspection request",
      subtitle: `SPDC Request for Inspection (F-01) — pick checklist from Quality master. Template: ${SPDC_CHECKLIST_TEMPLATES.qualityIr}`,
    };
  }
  if (scope === "safety" || kind === "SafetyChecklist" || kind === "SafetyIR") {
    return {
      eyebrow: "Safety module",
      title: "Safety checklist fill request",
      subtitle: `Safety walkthrough / IR — ${SPDC_CHECKLIST_TEMPLATES.safety}`,
    };
  }
  if (scope === "drawings" && kind === "RequestForInformation") {
    return {
      eyebrow: "Drawings module",
      title: "Ask (PMC RFI)",
      subtitle: `Request for Information — drawing clarification only. Register: ${SPDC_CHECKLIST_TEMPLATES.drawingRfi}`,
    };
  }
  if (scope === "drawings" && (kind === "All" || kind === "Manual")) {
    return {
      eyebrow: "Drawings module",
      title: "Drawing RFI register",
      subtitle: `Live SPDC RFI log — PMC asks and drawing checklist fills. Export matches ${SPDC_CHECKLIST_TEMPLATES.drawingRfi}.`,
    };
  }
  if (scope === "drawings" || kind === "DrawingChecklist") {
    return {
      eyebrow: "Drawings module",
      title: "Request drawing checklist fill",
      subtitle: "Drawing Check Master templates — link drawing + revision. Not used for Quality / Safety / Activity site fills.",
    };
  }
  if (scope === "inspection" || kind === "ActivityInspection") {
    return {
      eyebrow: "Inspection module",
      title: "Activity inspection request",
      subtitle: `Activity clearance — ${SPDC_CHECKLIST_TEMPLATES.activity}`,
    };
  }
  if (kind === "SiteExecution") {
    return {
      eyebrow: "Quality · site execution",
      title: "Site checklist fill",
      subtitle: "Site execution checklists from Quality master — not a Progress module tool.",
    };
  }
  return {
    eyebrow: "Requests",
    title: "RFI desk",
    subtitle: "Drawings = PMC RFI only. Quality / Safety / Activity = checklist masters with SPDC branded exports.",
  };
}

export function rfiListKindFilter(scope: RfiModuleScope, kindFilter: RfiKindFilter): RfiKindFilter {
  if (scope === "quality") return kindFilter === "SiteExecution" ? "SiteExecution" : "QualityInspection";
  if (scope === "safety") return "SafetyChecklist";
  if (scope === "inspection") return kindFilter;
  if (scope === "drawings" && kindFilter === "All") return "All";
  if (scope === "drawings" && kindFilter === "RequestForInformation") return "RequestForInformation";
  if (scope === "drawings" && kindFilter === "DrawingChecklist") return "DrawingChecklist";
  if (scope === "drawings") return "All";
  return kindFilter;
}

export function checklistFamilyForRfiKind(
  rfiKind: string | undefined
): "DrawingCheck" | "QualityInspection" | "Safety" | "SiteExecution" | "ActivityInspection" {
  if (rfiKind === "QualityInspection" || rfiKind === "QualityIR") return "QualityInspection";
  if (rfiKind === "SafetyChecklist" || rfiKind === "SafetyIR") return "Safety";
  if (rfiKind === "ActivityInspection") return "ActivityInspection";
  if (rfiKind === "SiteExecution") return "SiteExecution";
  if (rfiKind === "DrawingChecklist" || rfiKind === "RequestForInformation" || rfiKind === "Manual") return "DrawingCheck";
  return "SiteExecution";
}

export function isModuleScopedRfi(scope: RfiModuleScope): boolean {
  return scope === "drawings" || scope === "quality" || scope === "safety" || scope === "inspection" || scope === "comms";
}

export function moduleForChecklistFamily(family: string): WorkspaceKey {
  if (family === "DrawingCheck") return "drawings";
  if (family === "Safety") return "safety";
  if (family === "ActivityInspection") return "inspection";
  if (family === "SiteExecution") return "quality";
  return "quality";
}

export function checklistMasterPath(family: string, projectId: string): string {
  if (family === "DrawingCheck") return `/projects/${projectId}/drawings/checklist-master`;
  if (family === "Safety") return `/projects/${projectId}/safety/checklist-master`;
  if (family === "ActivityInspection") return `/projects/${projectId}/inspection/checklist-master`;
  if (family === "SiteExecution") return `/projects/${projectId}/quality/site-checklist-master`;
  return `/projects/${projectId}/quality/checklist-master`;
}

export function checklistLogsPath(family: string, projectId: string): string {
  if (family === "DrawingCheck") return `/projects/${projectId}/drawings/checklist-logs`;
  if (family === "Safety") return `/projects/${projectId}/safety/checklist-logs`;
  if (family === "ActivityInspection") return `/projects/${projectId}/inspection/checklist-logs`;
  if (family === "SiteExecution") return `/projects/${projectId}/quality/site-checklist-logs`;
  return `/projects/${projectId}/quality/checklist-logs`;
}
