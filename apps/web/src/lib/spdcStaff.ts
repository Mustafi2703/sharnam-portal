/** SPDC internal staff — not CRM clients, consultants, vendors, or their portal logins. */
const STAFF_ROLES = new Set(["admin", "office", "hr", "site_employee"]);

export function isSpdcStaffUser(u: { role?: string | null; vendorId?: string | null }) {
  const role = String(u.role || "");
  if (STAFF_ROLES.has(role)) return true;
  return role === "employee" && !u.vendorId;
}

export function isSpdcStaffMember(m: {
  portalRole?: string | null;
  role?: string | null;
  vendorId?: string | null;
}) {
  return isSpdcStaffUser({ role: m.portalRole || m.role, vendorId: m.vendorId });
}
