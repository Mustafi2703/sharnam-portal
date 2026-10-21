/** One source for Drawings pick-list defaults. Projects that saved a custom list keep it. */
export const PICKLIST_DEFAULTS = {
  drawingTypes: ["Concept Drawings", "Schematic Drawings", "Detailed Design (DD) Drawings", "Tender Drawings", "Good For Construction (GFC)"],
  disciplines: ["Architecture", "Structural", "MEPF", "PEB", "Infrastructure", "Multi-discipline"],
  delayResponsibility: ["Architecture Consultant", "Structural Consultant", "MEPF Consultant", "BIM Consultant", "Contractor", "PMC", "Client"],
  issuedTo: ["Main Contractor", "PMC / Client"],
  rfiPriorities: ["CRITICAL", "HIGH", "NORMAL", "LOW"],
  rfiCategories: ["Drawing discrepancy", "Missing information", "Design clarification", "Specification conflict", "Site constraint", "Material substitution", "Statutory requirement", "Interface / coordination"],
  impactLevels: ["None", "Low", "Medium", "High"],
  coordinationPriorities: ["Low", "Medium", "High", "Critical"],
} as const;

export type PicklistKey = keyof typeof PICKLIST_DEFAULTS;
