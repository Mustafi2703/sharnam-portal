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

/** SPDC branded export templates per family (one sheet → one product). */
export const SPDC_CHECKLIST_TEMPLATES = {
  drawingRfi: "SPDC_RFI_Form_and_Register.xlsx",
  qualityIr: "SPDC_Request_for_Inspection_Form.xlsx",
  safety: "SPDC_Safety_Inspection_Request_and_Checklists.xlsx",
  activity: "SPDC_Activity_Inspection_Checklist_Format.xlsx",
} as const;

/**
 * Four SPDC products (not ten rfiKinds):
 * 1. Request for Information     → Drawings
 * 2. Request for Inspection F-01 → Quality (+ Activity F-02 as enclosure)
 * 3. Safety IR F-01 + checklists → Safety (+ HSE register)
 * 4. Drawing checklist fill      → Drawings (gate), not a design RFI
 */
export type RfiModuleScope = "drawings" | "quality" | "safety" | "comms" | "inspection" | "home";

export function rfiModuleScope(pathname: string, search: string): RfiModuleScope {
  const ws = resolveProjectWorkspace(pathname, search);
  if (ws === "home") return "home";
  if (ws === "drawings" || ws === "quality" || ws === "safety" || ws === "comms") return ws;
  return "home";
}

/** Canonical kind stored when raising from a module. */
export function defaultRfiKindForModule(scope: RfiModuleScope): RfiKindFilter | null {
  if (scope === "quality") return "QualityIR";
  if (scope === "safety") return "SafetyIR";
  if (scope === "drawings") return "RequestForInformation";
  if (scope === "inspection") return null; // overview only — open Quality / Safety registers
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

/** Pills on the RFI desk — keep to the sheet product for that module. */
export function rfiKindPillsForScope(scope: RfiModuleScope): [RfiKindFilter, string][] {
  switch (scope) {
    case "drawings":
      return [
        ["RequestForInformation", "Request for Information"],
        ["DrawingChecklist", "Drawing checklist fill"],
        ["All", "All drawing requests"],
      ];
    case "quality":
      // Raise happens on inspection-register; /rfis redirects there.
      return [
        ["QualityIR", "Request for Inspection (F-01)"],
        ["ActivityInspection", "Activity checklist (F-02)"],
      ];
    case "safety":
      return [["SafetyIR", "Safety IR (F-01)"]];
    case "inspection":
      // Overview desk — no compose kinds here; registers live on Quality / Safety.
      return [];
    case "comms":
      return [["ClientConcern", "Client concern"]];
    default:
      return [
        ["RequestForInformation", "Drawing RFI"],
        ["QualityIR", "Quality IR"],
        ["SafetyIR", "Safety IR"],
        ["ActivityInspection", "Activity checklist"],
        ["ClientConcern", "Client"],
      ];
  }
}

export function rfiPageCopy(scope: RfiModuleScope, kind: RfiKindFilter): { eyebrow: string; title: string; subtitle: string } {
  if (scope === "inspection") {
    return {
      eyebrow: "Inspection overview",
      title: "Inspection desk",
      subtitle:
        "Overview only. Raise and maintain registers on Quality (F-01 / F-02) or Safety (Safety IR / HSE). This desk does not create a fifth type of request.",
    };
  }
  if (scope === "quality" && kind === "SiteExecution") {
    return {
      eyebrow: "Quality module · site execution",
      title: "Site checklist fill request",
      subtitle: "Field site checklists — assign from Quality site master. Not a design RFI.",
    };
  }
  if (scope === "quality" || kind === "QualityInspection" || kind === "QualityIR") {
    return {
      eyebrow: "Quality module · register",
      title: "Request for Inspection (F-01)",
      subtitle: `Live log of open / answered / closed IRs. Template: ${SPDC_CHECKLIST_TEMPLATES.qualityIr}`,
    };
  }
  if (kind === "ActivityInspection") {
    return {
      eyebrow: "Quality module · F-02",
      title: "Activity inspection checklist",
      subtitle: `Enclosure to a Quality IR — ${SPDC_CHECKLIST_TEMPLATES.activity}. Link the IR number on the form.`,
    };
  }
  if (scope === "safety" || kind === "SafetyChecklist" || kind === "SafetyIR") {
    return {
      eyebrow: "Safety module · register",
      title: "Safety IR & clearance",
      subtitle: `Pre-start clearance + checklist fills. Template: ${SPDC_CHECKLIST_TEMPLATES.safety}`,
    };
  }
  if (scope === "drawings" && kind === "RequestForInformation") {
    return {
      eyebrow: "Drawings module · register",
      title: "Request for Information",
      subtitle: `Design query - link the drawing and revision. Register: ${SPDC_CHECKLIST_TEMPLATES.drawingRfi}`,
    };
  }
  if (scope === "drawings" && (kind === "All" || kind === "Manual")) {
    return {
      eyebrow: "Drawings module · register",
      title: "Drawing RFI register",
      subtitle: `Log of open and closed information RFIs (+ drawing checklist fills). ${SPDC_CHECKLIST_TEMPLATES.drawingRfi}`,
    };
  }
  if (scope === "drawings" || kind === "DrawingChecklist") {
    return {
      eyebrow: "Drawings module",
      title: "Drawing checklist fill",
      subtitle: "Drawing Check master — gate before GFC upload. Not a design information RFI.",
    };
  }
  return {
    eyebrow: "Requests",
    title: "Request desk",
    subtitle: "Drawings = RFI. Quality = Inspection F-01. Safety = Safety IR. Each has its own register log.",
  };
}

export function rfiListKindFilter(scope: RfiModuleScope, kindFilter: RfiKindFilter): RfiKindFilter {
  if (scope === "quality") {
    if (kindFilter === "SiteExecution") return "SiteExecution";
    if (kindFilter === "ActivityInspection") return "ActivityInspection";
    return "QualityIR";
  }
  if (scope === "safety") {
    if (kindFilter === "SafetyChecklist") return "SafetyChecklist";
    return "SafetyIR";
  }
  if (scope === "inspection") return kindFilter;
  if (scope === "drawings" && kindFilter === "All") return "All";
  if (scope === "drawings" && kindFilter === "RequestForInformation") return "RequestForInformation";
  if (scope === "drawings" && kindFilter === "DrawingChecklist") return "DrawingChecklist";
  if (scope === "drawings") return "All";
  return kindFilter;
}

/** Normalize legacy aliases so QualityInspection ≡ QualityIR for scoping. */
export function canonicalRfiKind(rfiKind: string | null | undefined): string {
  const k = rfiKind || "RequestForInformation";
  if (k === "QualityInspection") return "QualityIR";
  if (k === "SafetyChecklist") return "SafetyIR";
  if (k === "Manual") return "RequestForInformation";
  return k;
}

/** Keeps each product’s register clean — no cross-module bleed. */
export function rfiKindAllowedInModuleScope(scope: RfiModuleScope, rfiKind: string | null | undefined): boolean {
  const kind = canonicalRfiKind(rfiKind);
  switch (scope) {
    case "drawings":
      return kind === "RequestForInformation" || kind === "DrawingChecklist";
    case "quality":
      return kind === "QualityIR" || kind === "ActivityInspection" || kind === "SiteExecution";
    case "safety":
      return kind === "SafetyIR";
    case "inspection":
      // Overview can list Quality + Safety IRs for navigation only.
      return kind === "QualityIR" || kind === "SafetyIR" || kind === "ActivityInspection";
    case "comms":
      return kind === "ClientConcern";
    default:
      return true;
  }
}

export function rfiLogTitle(scope: RfiModuleScope): string {
  switch (scope) {
    case "drawings":
      return "Request for Information register";
    case "quality":
      return "Request for Inspection register";
    case "safety":
      return "Safety IR & HSE register";
    case "inspection":
      return "Inspection overview (opens Quality / Safety registers)";
    case "comms":
      return "Client concerns";
    default:
      return "Request log";
  }
}

export function checklistFamilyForRfiKind(
  rfiKind: string | undefined
): "DrawingCheck" | "QualityInspection" | "Safety" | "SiteExecution" | "ActivityInspection" {
  const k = canonicalRfiKind(rfiKind);
  if (k === "QualityIR") return "QualityInspection";
  if (k === "SafetyIR") return "Safety";
  if (k === "ActivityInspection") return "ActivityInspection";
  if (k === "SiteExecution") return "SiteExecution";
  if (k === "DrawingChecklist" || k === "RequestForInformation") return "DrawingCheck";
  return "SiteExecution";
}

export function isModuleScopedRfi(scope: RfiModuleScope): boolean {
  return scope === "drawings" || scope === "quality" || scope === "safety" || scope === "inspection" || scope === "comms";
}

export function moduleForChecklistFamily(family: string): WorkspaceKey {
  if (family === "DrawingCheck") return "drawings";
  if (family === "Safety") return "safety";
  if (family === "ActivityInspection") return "quality";
  if (family === "SiteExecution") return "quality";
  return "quality";
}

export function checklistMasterPath(family: string, projectId: string): string {
  if (family === "DrawingCheck") return `/projects/${projectId}/drawings/checklist-master`;
  if (family === "Safety") return `/projects/${projectId}/safety/checklist-master`;
  if (family === "ActivityInspection") return `/projects/${projectId}/quality/site-checklist-master`;
  if (family === "SiteExecution") return `/projects/${projectId}/quality/site-checklist-master`;
  return `/projects/${projectId}/quality/checklist-master`;
}

export function checklistLogsPath(family: string, projectId: string): string {
  if (family === "DrawingCheck") return `/projects/${projectId}/drawings/checklist-logs`;
  if (family === "Safety") return `/projects/${projectId}/safety/checklist-logs`;
  if (family === "ActivityInspection") return `/projects/${projectId}/quality/site-checklist-logs`;
  if (family === "SiteExecution") return `/projects/${projectId}/quality/site-checklist-logs`;
  return `/projects/${projectId}/quality/checklist-logs`;
}

/** Dedicated register tool URLs — one register per SPDC product. */
export function registerToolPath(
  projectId: string,
  product: "drawing-rfi" | "quality-ir" | "activity-f02" | "safety-ir" | "hse"
): string {
  switch (product) {
    case "drawing-rfi":
      return `/projects/${projectId}/rfis?view=register`;
    case "quality-ir":
      return `/projects/${projectId}/inspection-register?tab=quality-ir&lock=quality`;
    case "activity-f02":
      return `/projects/${projectId}/inspection-register?tab=activity-checklist&lock=quality`;
    case "safety-ir":
      return `/projects/${projectId}/inspection-register?tab=safety-ir&lock=safety`;
    case "hse":
      return `/projects/${projectId}/inspection-register?tab=hse-register&lock=safety`;
  }
}

/** Query string that opens an RFI of this kind in the module it belongs to. */
export function rfiSearchForKind(kind: string | null | undefined, rfiId?: string): string {
  const q = new URLSearchParams();
  const k = canonicalRfiKind(kind);
  if (k === "RequestForInformation" || k === "DrawingChecklist") {
    q.set("view", "register");
    if (k === "DrawingChecklist") q.set("kind", "DrawingChecklist");
  } else if (k === "QualityIR" || k === "ActivityInspection") {
    q.set("tab", k === "ActivityInspection" ? "activity-checklist" : "quality-ir");
    q.set("lock", "quality");
  } else if (k === "SafetyIR") {
    q.set("tab", "safety-ir");
    q.set("lock", "safety");
  } else {
    q.set("kind", k);
  }
  if (rfiId) q.set("rfi", rfiId);
  return `?${q.toString()}`;
}

export function homeModuleForRfiKind(kind: string | null | undefined): "drawings" | "quality" | "safety" | "comms" {
  const k = canonicalRfiKind(kind);
  if (k === "RequestForInformation" || k === "DrawingChecklist") return "drawings";
  if (k === "QualityIR" || k === "ActivityInspection" || k === "SiteExecution") return "quality";
  if (k === "SafetyIR") return "safety";
  if (k === "ClientConcern") return "comms";
  return "drawings";
}
