import { useCallback, useEffect, useState } from "react";
import { api } from "../api";

export type DrawingPicklists = {
  drawingTypes: string[];
  disciplines: string[];
  delayResponsibility: string[];
  issuedTo: string[];
  rfiPriorities: string[];
  rfiCategories: string[];
  impactLevels: string[];
  coordinationPriorities: string[];
};

export const DEFAULT_PICKLISTS: DrawingPicklists = {
  drawingTypes: ["Concept Drawings", "Schematic Drawings", "Detailed Design (DD) Drawings", "Tender Drawings", "Good For Construction (GFC)"],
  disciplines: ["Architecture", "Structural", "MEPF"],
  delayResponsibility: ["Architecture Consultant", "Structural Consultant", "MEPF Consultant", "BIM Consultant", "Contractor", "PMC"],
  issuedTo: ["Main Contractor", "PMC / Client"],
  rfiPriorities: ["CRITICAL", "HIGH", "NORMAL", "LOW"],
  rfiCategories: ["Drawing discrepancy", "Missing information", "Design clarification", "Specification conflict", "Site constraint", "Material substitution", "Statutory requirement", "Interface / coordination"],
  impactLevels: ["None", "Low", "Medium", "High"],
  coordinationPriorities: ["Low", "Medium", "High", "Critical"],
};

export const PICKLIST_META: { key: keyof DrawingPicklists; title: string; hint: string }[] = [
  { key: "disciplines", title: "Disciplines", hint: "Register, GFC upload, RFIs and design coordination all offer these." },
  { key: "drawingTypes", title: "Drawing types", hint: "Concept → Schematic → DD → Tender → GFC." },
  { key: "delayResponsibility", title: "Delay responsibility", hint: "Who a late drawing is charged to — drives the delay chart." },
  { key: "issuedTo", title: "Issued to", hint: "Who a drawing issue goes to." },
  { key: "rfiPriorities", title: "RFI priority", hint: "CRITICAL 3 d · HIGH 7 d · NORMAL 14 d · LOW 21 d response (SPDC RFI control sheet)." },
  { key: "rfiCategories", title: "RFI category", hint: "The category pick-list on the RFI form and register." },
  { key: "impactLevels", title: "RFI schedule / cost impact", hint: "Used on the RFI form." },
  { key: "coordinationPriorities", title: "Design coordination priority", hint: "Used on design coordination issues." },
];

export type PicklistState = {
  lists: DrawingPicklists;
  defaults: DrawingPicklists;
  custom: string[];
  used: { disciplines: string[]; drawingTypes: string[]; delayResponsibility: string[]; packages: string[] };
  loaded: boolean;
};

/** This project's pick-lists (falls back to the defaults while loading or when the call fails). */
export function useDrawingPicklists(projectId?: string, token?: string | null) {
  const [state, setState] = useState<PicklistState>({
    lists: DEFAULT_PICKLISTS,
    defaults: DEFAULT_PICKLISTS,
    custom: [],
    used: { disciplines: [], drawingTypes: [], delayResponsibility: [], packages: [] },
    loaded: false,
  });
  const reload = useCallback(async () => {
    if (!projectId) return;
    try {
      const out = await api<any>(`/api/drawings/project/${projectId}/picklists`, { token });
      setState({
        lists: { ...DEFAULT_PICKLISTS, ...(out.lists || {}) },
        defaults: { ...DEFAULT_PICKLISTS, ...(out.defaults || {}) },
        custom: out.custom || [],
        used: { disciplines: [], drawingTypes: [], delayResponsibility: [], packages: [], ...(out.used || {}) },
        loaded: true,
      });
    } catch {
      /* keep defaults */
    }
  }, [projectId, token]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { ...state, reload };
}

/** A pick-list plus any value already on a record, so older data stays selectable. */
export function withCurrent(list: readonly string[], ...extra: (string | null | undefined)[]): string[] {
  const out = [...list];
  for (const v of extra) {
    const t = (v || "").trim();
    if (t && !out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out;
}
