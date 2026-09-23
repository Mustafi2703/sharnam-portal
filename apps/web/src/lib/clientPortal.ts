/** Client representatives — project modules read-only; signature upload when SPDC sends a pack. */

export function isClientPortalUser(role?: string | null): boolean {
  return role === "client";
}

const APP_BLOCKED = [
  /^\/crm(\/|$)/,
  /^\/hrm(\/|$)/,
  /^\/hrms(\/|$)/,
  /^\/master(\/|$)/,
  /^\/custom-sheets(\/|$)/,
  /^\/roles(\/|$)/,
  /^\/audit(\/|$)/,
  /^\/stakeholder(\/|$)/,
];

const PROJECT_BLOCKED = [
  /\/setup$/,
  /\/dpr-maker$/,
  /\/wpr-maker$/,
  /\/upload-revision/,
  /\/checklist\/assign$/,
  /checklist-master/,
  /\/email$/,
  /\/directory$/,
  /\/vendors$/,
  /\/hub\/cost(\/|$)/,
  /\/hub\/finance(\/|$)/,
  /\/hub\/auditKpi(\/|$)/,
  /\/cost(\/|$)/,
  /\/finance(\/|$)/,
  /\/expense-vouchers/,
];

/** Redirect target when a client hits a blocked URL; null = allowed. */
export function clientPortalRedirect(pathname: string): string | null {
  for (const re of APP_BLOCKED) {
    if (re.test(pathname)) return "/dashboard";
  }
  for (const re of PROJECT_BLOCKED) {
    if (re.test(pathname)) {
      const m = pathname.match(/^\/projects\/([^/]+)/);
      return m ? `/projects/${m[1]}` : "/dashboard";
    }
  }
  return null;
}

export const CLIENT_PROJECT_MODULE_KEYS = new Set([
  "home",
  "drawings",
  "dms",
  "quality",
  "safety",
  "progress",
  "comms",
  "reports",
  "closure",
]);
