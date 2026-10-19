/** Office admins the client asked to keep. Matches the API keep list. */
export const KEPT_PORTAL_EMAILS = ["nirav@spdc.in", "saurabh@spdc.in", "operations@spdc.in"];

export function isKeptPortalEmail(email?: string | null) {
  return KEPT_PORTAL_EMAILS.includes(String(email || "").trim().toLowerCase());
}
