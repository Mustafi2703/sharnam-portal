/**
 * SPDC internal org — company department + job title (HR / letters / payroll).
 * Separate from portal **login role** (admin, office, site_employee, hr, client, vendor, employee).
 */

export const SPDC_DEPARTMENTS = [
  "Director's Office",
  "Human Resources",
  "Planning & Estimation",
  "Projects — Site",
  "Projects — Office",
  "Billing & Accounts",
  "Safety",
  "MEPF",
  "IT & Admin",
  "Tender & Business Development",
] as const;

export type SpdcDepartment = (typeof SPDC_DEPARTMENTS)[number];

/** Company role on appointment letters and HRMS user profile — not the portal login role. */
export const SPDC_COMPANY_ROLES = [
  "Director",
  "HR",
  "Coordinator",
  "Billing Engineer",
  "Planning Engineer",
  "Project Manager",
  "Senior Engineer",
  "Junior Engineer",
  "Safety Engineer",
  "MEPF Engineer",
] as const;

export type SpdcCompanyRole = (typeof SPDC_COMPANY_ROLES)[number];

const COMPANY_ROLE_SET = new Set<string>(SPDC_COMPANY_ROLES);

export function isSpdcCompanyRole(value: string | null | undefined): value is SpdcCompanyRole {
  if (!value) return false;
  return COMPANY_ROLE_SET.has(value.trim());
}

/**
 * Default portal login for new SPDC staff — site team gets /login/site with project modules via membership.
 * Directors and pure office coordinators may use office login instead (HR can override in Users).
 */
export function suggestedLoginRoleForCompanyRole(
  designation: string | null | undefined,
): "office" | "hr" | "site_employee" {
  const d = (designation || "").trim().toLowerCase();
  if (!d) return "site_employee";
  if (d === "hr" || d.includes("human resource")) return "hr";
  if (d === "director") return "office";
  if (d.includes("billing") || d.includes("planning")) return "office";
  return "site_employee";
}

export function spdcDepartmentOptions(existing: string[] = []): string[] {
  const merged = new Set<string>([...SPDC_DEPARTMENTS, ...existing.map((x) => x.trim()).filter(Boolean)]);
  return [...merged].sort((a, b) => a.localeCompare(b));
}

export function spdcCompanyRoleOptions(existing: string[] = []): string[] {
  const merged = new Set<string>([...SPDC_COMPANY_ROLES, ...existing.map((x) => x.trim()).filter(Boolean)]);
  return [...merged].sort((a, b) => a.localeCompare(b));
}

/** On-project assignment role (ProjectMember.role) — separate from company designation. */
export const PROJECT_MEMBER_ROLE_LABELS: Record<string, string> = {
  project_manager: "Project Manager",
  site_engineer: "Site Engineer",
  quality_lead: "Quality Lead",
  document_controller: "Document Controller",
  member: "Team member",
  viewer: "Viewer",
  client: "Client",
  consultant: "Consultant",
  vendor: "Vendor",
};

export function projectMemberRoleLabel(role: string | null | undefined): string {
  const key = String(role || "member").trim();
  return PROJECT_MEMBER_ROLE_LABELS[key] || key.replace(/_/g, " ");
}

/** Default project assignment from HRMS company role (designation). */
export function suggestedProjectMemberRole(designation: string | null | undefined): string {
  const d = (designation || "").trim().toLowerCase();
  if (!d) return "member";
  if (d.includes("project manager") || d === "director" || d === "coordinator") return "project_manager";
  if (d.includes("quality")) return "quality_lead";
  if (d.includes("planning") || d.includes("billing")) return "member";
  if (d.includes("engineer") || d.includes("safety") || d.includes("mepf")) return "site_engineer";
  if (d === "hr") return "member";
  return "member";
}
