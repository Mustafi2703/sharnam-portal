export const ROLES = [
  "admin",
  "office",
  "site_employee",
  "client",
  "employee",
  "vendor",
] as const;

export type RoleKey = (typeof ROLES)[number];

export const PORTALS = [
  "admin",
  "office",
  "site",
  "client",
  "vendor",
] as const;

export type PortalKey = (typeof PORTALS)[number];

export const MODULES = [
  "projects",
  "drawings",
  "dms",
  "checklist",
  "daily_diary",
  "communications",
  "meetings",
  "cost_tracking",
  "reports",
  "audit",
  "crm",
  "hrm",
  "roles",
  "users",
  "vendors",
  "rfis",
  "inspections",
  "safety",
] as const;

export type ModuleKey = (typeof MODULES)[number];

export type PermissionAction = "view" | "create" | "edit" | "approve";

export type ModulePermissions = Record<
  ModuleKey,
  Record<PermissionAction, boolean>
>;

export function emptyPermissions(all = false): ModulePermissions {
  const perms = {} as ModulePermissions;
  for (const m of MODULES) {
    perms[m] = {
      view: all,
      create: all,
      edit: all,
      approve: all,
    };
  }
  return perms;
}

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, ModulePermissions> = {
  admin: emptyPermissions(true),
  office: {
    ...emptyPermissions(false),
    projects: { view: true, create: true, edit: true, approve: true },
    drawings: { view: true, create: true, edit: true, approve: true },
    dms: { view: true, create: true, edit: true, approve: false },
    checklist: { view: true, create: true, edit: true, approve: true },
    daily_diary: { view: true, create: true, edit: true, approve: true },
    communications: { view: true, create: true, edit: true, approve: false },
    meetings: { view: true, create: true, edit: true, approve: true },
    cost_tracking: { view: true, create: true, edit: true, approve: true },
    reports: { view: true, create: true, edit: false, approve: false },
    audit: { view: true, create: false, edit: false, approve: false },
    crm: { view: true, create: true, edit: true, approve: false },
    hrm: { view: true, create: true, edit: true, approve: true },
    roles: { view: false, create: false, edit: false, approve: false },
    users: { view: true, create: false, edit: false, approve: false },
    vendors: { view: true, create: true, edit: true, approve: false },
    rfis: { view: true, create: true, edit: true, approve: true },
    inspections: { view: true, create: true, edit: true, approve: true },
    safety: { view: true, create: true, edit: true, approve: true },
  },
  site_employee: {
    ...emptyPermissions(false),
    projects: { view: true, create: false, edit: false, approve: false },
    drawings: { view: true, create: false, edit: false, approve: false },
    dms: { view: true, create: false, edit: false, approve: false },
    checklist: { view: true, create: true, edit: true, approve: false },
    daily_diary: { view: true, create: true, edit: true, approve: false },
    communications: { view: true, create: false, edit: false, approve: false },
    meetings: { view: true, create: false, edit: true, approve: false },
    cost_tracking: { view: false, create: false, edit: false, approve: false },
    reports: { view: true, create: false, edit: false, approve: false },
    audit: { view: false, create: false, edit: false, approve: false },
    crm: { view: false, create: false, edit: false, approve: false },
    hrm: { view: false, create: false, edit: false, approve: false },
    roles: { view: false, create: false, edit: false, approve: false },
    users: { view: false, create: false, edit: false, approve: false },
    vendors: { view: true, create: false, edit: false, approve: false },
    rfis: { view: true, create: true, edit: true, approve: false },
    inspections: { view: true, create: true, edit: true, approve: false },
    safety: { view: true, create: true, edit: true, approve: false },
  },
  client: {
    ...emptyPermissions(false),
    projects: { view: true, create: false, edit: false, approve: false },
    drawings: { view: true, create: false, edit: false, approve: false },
    dms: { view: true, create: false, edit: false, approve: false },
    checklist: { view: true, create: false, edit: false, approve: false },
    daily_diary: { view: true, create: false, edit: false, approve: false },
    communications: { view: true, create: false, edit: false, approve: false },
    meetings: { view: true, create: false, edit: false, approve: false },
    cost_tracking: { view: false, create: false, edit: false, approve: false },
    reports: { view: true, create: false, edit: false, approve: false },
    audit: { view: false, create: false, edit: false, approve: false },
    crm: { view: false, create: false, edit: false, approve: false },
    hrm: { view: false, create: false, edit: false, approve: false },
    roles: { view: false, create: false, edit: false, approve: false },
    users: { view: false, create: false, edit: false, approve: false },
    vendors: { view: true, create: false, edit: false, approve: false },
    rfis: { view: true, create: true, edit: false, approve: false },
    inspections: { view: true, create: false, edit: false, approve: false },
    safety: { view: true, create: false, edit: false, approve: false },
  },
  employee: {
    ...emptyPermissions(false),
    projects: { view: true, create: false, edit: false, approve: false },
    drawings: { view: true, create: false, edit: false, approve: false },
    dms: { view: true, create: false, edit: false, approve: false },
    checklist: { view: true, create: true, edit: true, approve: false },
    daily_diary: { view: true, create: true, edit: true, approve: false },
    communications: { view: true, create: true, edit: false, approve: false },
    meetings: { view: true, create: false, edit: false, approve: false },
    cost_tracking: { view: true, create: false, edit: false, approve: false },
    reports: { view: true, create: false, edit: false, approve: false },
    audit: { view: false, create: false, edit: false, approve: false },
    crm: { view: true, create: false, edit: false, approve: false },
    hrm: { view: true, create: false, edit: false, approve: false },
    roles: { view: false, create: false, edit: false, approve: false },
    users: { view: false, create: false, edit: false, approve: false },
    vendors: { view: true, create: false, edit: false, approve: false },
    rfis: { view: true, create: true, edit: true, approve: false },
    inspections: { view: true, create: true, edit: true, approve: false },
    safety: { view: true, create: true, edit: true, approve: false },
  },
  vendor: {
    ...emptyPermissions(false),
    projects: { view: true, create: false, edit: false, approve: false },
    drawings: { view: true, create: false, edit: false, approve: false },
    dms: { view: true, create: false, edit: false, approve: false },
    checklist: { view: true, create: true, edit: true, approve: false },
    daily_diary: { view: true, create: true, edit: true, approve: false },
    communications: { view: true, create: false, edit: false, approve: false },
    meetings: { view: true, create: false, edit: false, approve: false },
    cost_tracking: { view: false, create: false, edit: false, approve: false },
    reports: { view: true, create: false, edit: false, approve: false },
    audit: { view: false, create: false, edit: false, approve: false },
    crm: { view: false, create: false, edit: false, approve: false },
    hrm: { view: false, create: false, edit: false, approve: false },
    roles: { view: false, create: false, edit: false, approve: false },
    users: { view: false, create: false, edit: false, approve: false },
    vendors: { view: true, create: false, edit: true, approve: false },
    rfis: { view: true, create: false, edit: true, approve: false },
    inspections: { view: true, create: false, edit: true, approve: false },
    safety: { view: true, create: true, edit: true, approve: false },
  },
};

export function portalForRole(role: RoleKey): PortalKey {
  switch (role) {
    case "admin":
      return "admin";
    case "office":
    case "employee":
      return "office";
    case "site_employee":
      return "site";
    case "client":
      return "client";
    case "vendor":
      return "vendor";
    default:
      return "office";
  }
}

export function can(
  permissions: ModulePermissions | null | undefined,
  module: ModuleKey,
  action: PermissionAction
): boolean {
  if (!permissions) return false;
  return Boolean(permissions[module]?.[action]);
}

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: RoleKey;
  portal: PortalKey;
};
