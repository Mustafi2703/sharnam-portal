/** Anushka Jha — people management only. Same password as other SPDC logins. */
export const HR_DESK_ONLY_EMAILS = ["anushka.jha@spdc.in"];

export function isHrDeskOnly(email?: string | null) {
  return HR_DESK_ONLY_EMAILS.includes(String(email || "").trim().toLowerCase());
}

export function hrDeskApiAllowed(originalUrl: string, method: string) {
  const path = String(originalUrl || "").split("?")[0];
  if (path.startsWith("/api/auth")) return true;
  if (path.startsWith("/api/hrm")) return true;
  if (method === "GET" && (path === "/api/projects" || path === "/api/users")) return true;
  return false;
}
