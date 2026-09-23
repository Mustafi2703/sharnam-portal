export const ROLES = [
  "admin",
  "office",
  "hr",
  "site_employee",
  "client",
  "employee",
  "vendor",
] as const;

export type RoleKey = (typeof ROLES)[number];

export const PORTALS = [
  "admin",
  "office",
  "hr",
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
  hr: {
    ...emptyPermissions(false),
    hrm: { view: true, create: true, edit: true, approve: true },
    users: { view: true, create: true, edit: true, approve: false },
  },
  site_employee: {
    ...emptyPermissions(false),
    projects: { view: true, create: false, edit: false, approve: false },
    drawings: { view: true, create: true, edit: true, approve: true },
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
    rfis: { view: true, create: false, edit: false, approve: false },
    inspections: { view: true, create: false, edit: false, approve: false },
    safety: { view: true, create: false, edit: false, approve: false },
  },
  employee: {
    ...emptyPermissions(false),
    projects: { view: true, create: false, edit: false, approve: false },
    drawings: { view: true, create: true, edit: true, approve: true },
    dms: { view: true, create: false, edit: false, approve: false },
    checklist: { view: true, create: true, edit: true, approve: false },
    daily_diary: { view: true, create: true, edit: true, approve: false },
    communications: { view: true, create: true, edit: false, approve: false },
    meetings: { view: true, create: false, edit: false, approve: false },
    cost_tracking: { view: true, create: false, edit: false, approve: false },
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
  vendor: {
    ...emptyPermissions(false),
    projects: { view: true, create: false, edit: false, approve: false },
    drawings: { view: true, create: false, edit: false, approve: false },
    dms: { view: false, create: false, edit: false, approve: false },
    checklist: { view: true, create: true, edit: true, approve: false },
    daily_diary: { view: false, create: false, edit: false, approve: false },
    communications: { view: true, create: false, edit: false, approve: false },
    meetings: { view: false, create: false, edit: false, approve: false },
    cost_tracking: { view: false, create: false, edit: false, approve: false },
    reports: { view: false, create: false, edit: false, approve: false },
    audit: { view: false, create: false, edit: false, approve: false },
    crm: { view: false, create: false, edit: false, approve: false },
    hrm: { view: false, create: false, edit: false, approve: false },
    roles: { view: false, create: false, edit: false, approve: false },
    users: { view: false, create: false, edit: false, approve: false },
    vendors: { view: true, create: false, edit: false, approve: false },
    rfis: { view: true, create: false, edit: true, approve: false },
    inspections: { view: true, create: false, edit: true, approve: false },
    safety: { view: true, create: false, edit: true, approve: false },
  },
};

export function portalForRole(role: RoleKey): PortalKey {
  switch (role) {
    case "admin":
      return "admin";
    case "office":
    case "employee":
      return "office";
    case "hr":
      return "hr";
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
  vendorId?: string | null;
  /** HR Head — HRMS only, no project / CRM / DMS desk. */
  hrDeskOnly?: boolean;
  /** Active accepted offer — new joiner pre-joining desk. */
  joiningOfferId?: string | null;
  preJoinComplete?: boolean;
  /** Set while an admin is signed in as this user for testing. */
  impersonatedBy?: { id: string; email: string; fullName: string } | null;
};

/** Indian Standard Time — used for site attendance punches and display. */
export const IST_TIMEZONE = "Asia/Kolkata";

export function formatIstTimeHHMM(d = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

/** Calendar day at local midnight for attendance date keys (IST). */
export function istStartOfDay(d = new Date()): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const [y, m, day] = ymd.split("-").map(Number);
  return new Date(y, m - 1, day, 0, 0, 0, 0);
}

/** YYYY-MM-DD in IST for API / calendar keys. */
export function formatIstDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function formatIstPunchTime(time: string | null | undefined): string {
  if (!time) return "—";
  if (/^\d{1,2}:\d{2}$/.test(time)) return `${time} IST`;
  const parsed = new Date(time);
  if (!Number.isNaN(parsed.getTime())) return `${formatIstTimeHHMM(parsed)} IST`;
  return time;
}

function punchTimeToMinutes(time: string): number | null {
  const t = time.trim();
  if (/^\d{1,2}:\d{2}$/.test(t)) {
    const [h, m] = t.split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  }
  const parsed = new Date(t);
  if (Number.isNaN(parsed.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(parsed);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

/** Minutes between check-in and check-out (same calendar day punches, HH:MM IST). */
export function attendanceSiteMinutes(
  checkIn?: string | null,
  checkOut?: string | null,
): number | null {
  if (!checkIn || !checkOut) return null;
  const start = punchTimeToMinutes(checkIn);
  const end = punchTimeToMinutes(checkOut);
  if (start == null || end == null) return null;
  let diff = end - start;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

export function formatAttendanceDuration(minutes: number | null | undefined): string {
  if (minutes == null || minutes < 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export {
  type SheetCell,
  colLetter,
  colIndex,
  parseCellRef,
  isFormula,
  normalizeCell,
  migrateRows,
  cellEditValue,
  cellPreview,
  evaluateFormula,
  evaluateAllRows,
  sheetCellsToAoa,
  applyFormulasToWorksheet,
  SUPPORTED_FORMULAS,
} from "./sheetFormulas.js";

export {
  type PortalModuleId,
  type ModuleDefinition,
  type ModuleFileRef,
  MODULE_REGISTRY,
  PORTAL_MODULE_IDS,
  getModuleDefinition,
  moduleViewRoles,
} from "./moduleRegistry.js";

export {
  rolesForModule,
  roleCanModule,
  createModuleRoleHelpers,
} from "./moduleRoles.js";

export {
  SPDC_DEPARTMENTS,
  SPDC_COMPANY_ROLES,
  type SpdcDepartment,
  type SpdcCompanyRole,
  isSpdcCompanyRole,
  suggestedLoginRoleForCompanyRole,
  spdcDepartmentOptions,
  spdcCompanyRoleOptions,
} from "./spdcOrg.js";

export {
  CANDIDATE_STAGES,
  CANDIDATE_STAGE_IDS,
  ACTIVE_CANDIDATE_STAGES,
  candidateStageLabel,
  candidateStageTone,
  INTERVIEWER_SEATS,
  type CandidateStageId,
  type InterviewerSeatId,
} from "./hrmsStages.js";

export {
  SPDC_PMC_NAME,
  SPDC_OFFICE_ADDRESS,
  SPDC_OFFICE_PHONE,
  SPDC_OFFICE_FOOTER,
} from "./spdcBranding.js";

export {
  CUBE_SIZE_MM,
  cubeStrengthFromLoadKN,
  gradeTargetMPa,
  cubeResultFromStrengths,
  applyCubeFormula,
  isPourCardTemplate,
  normalizeCubeSr,
  cubeGroupKey,
} from "./cubeStrength.js";
