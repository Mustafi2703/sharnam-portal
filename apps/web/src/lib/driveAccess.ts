/** Portal vs raw SharePoint / download rights. */

export const SPDC_PORTAL_ROLES = ["admin", "office", "employee", "site_employee"] as const;

export const HR_HEAD_EMAIL = "anushka.jha@spdc.in";

export function isSpdcEmployee(role?: string | null): boolean {
  return !!role && (SPDC_PORTAL_ROLES as readonly string[]).includes(role);
}

/** Raw SharePoint / OneDrive browse — admin only. Everyone else uses the portal viewer. */
export function canBrowseSharePoint(role?: string | null): boolean {
  return role === "admin";
}

/** Download / print toolbar on PDF and export files. */
export function canDownloadPortalFiles(role?: string | null): boolean {
  return role === "admin" || role === "office";
}

export function portalFileSrc(url: string, opts?: { allowToolbar?: boolean }): string {
  if (!url) return url;
  const allow = opts?.allowToolbar ?? false;
  const looksPdf = /\.pdf(\?|#|$)/i.test(url) || /application\/pdf/i.test(url);
  if (!looksPdf) return url;
  const base = url.split("#")[0];
  return allow ? base : `${base}#toolbar=0&navpanes=0`;
}

export function isHrApprover(user?: { email?: string | null; role?: string | null } | null): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.email?.toLowerCase() === HR_HEAD_EMAIL) return true;
  return user.role === "office";
}
