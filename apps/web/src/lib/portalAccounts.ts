import { STAKEHOLDER_CONSULTANT_TRADES } from "./vendorTypes";

const CONSULTANT_TRADES = new Set<string>(STAKEHOLDER_CONSULTANT_TRADES);

/** Portal login kinds — client / consultant vs vendor-contractor vs SPDC staff. */

export type PortalAccountKind = "staff" | "client" | "vendor" | "stakeholder";

export type PortalAccountForm = {
  fullName: string;
  email: string;
  role: string;
  phone: string;
  empCode: string;
  department: string;
  designation: string;
  password: string;
  isActive: boolean;
};

export const EMPTY_PORTAL_ACCOUNT_FORM: PortalAccountForm = {
  fullName: "",
  email: "",
  role: "client",
  phone: "",
  empCode: "",
  department: "",
  designation: "",
  password: "Demo@1234",
  isActive: true,
};

export function portalAccountKind(
  role: string | null | undefined,
  profile?: { empCode?: string | null; department?: string | null } | null,
): PortalAccountKind {
  if (role === "client") return "client";
  if (role === "vendor") return "vendor";
  if (role === "admin" || role === "office" || role === "site_employee") return "staff";
  if (role === "employee") {
    const dept = profile?.department?.trim();
    if (!dept || CONSULTANT_TRADES.has(dept)) return "stakeholder";
    const staffDept = /^(site|office|hr|hrm|accounts|admin|finance|it|tender|operations|spdc)$/i.test(dept);
    return staffDept ? "staff" : "stakeholder";
  }
  return "staff";
}

export function loginPathForAccount(role: string, kind?: PortalAccountKind): string {
  const resolved = kind || portalAccountKind(role);
  if (resolved === "client" || role === "client") return "/login/client";
  if (resolved === "vendor" || role === "vendor") return "/login/vendor";
  if (resolved === "stakeholder") return "/login/stakeholder";
  if (role === "site_employee") return "/login/site";
  if (role === "employee") return "/login/employee";
  return "/login/office";
}

export function accountKindLabel(kind: PortalAccountKind): string {
  switch (kind) {
    case "client":
      return "Client";
    case "vendor":
      return "Vendor / contractor";
    case "stakeholder":
      return "Consultant / stakeholder";
    default:
      return "SPDC staff";
  }
}

export function accountKindHint(kind: PortalAccountKind): string {
  switch (kind) {
    case "client":
      return "Owner contact. View published GFC, progress, and raise concerns — no drawing upload.";
    case "vendor":
      return "Same company type as contractor. Bid BOQs, RFIs, and assigned fills — no clock-in.";
    case "stakeholder":
      return "Other consultants, designers, and partner PMC. Not an SPDC staff login.";
    default:
      return "Office, site, and employees. Emp code and department apply only to staff.";
  }
}

export function roleSelectLabel(role: string, kind?: PortalAccountKind): string {
  const resolved = kind || portalAccountKind(role);
  if (resolved === "client" || role === "client") return "Client (owner) — /login/client";
  if (resolved === "vendor" || role === "vendor") return "Vendor / contractor — /login/vendor";
  if (resolved === "stakeholder") return "Consultant / stakeholder — /login/stakeholder";
  if (role === "admin") return "Admin — /login/office";
  if (role === "office") return "SPDC office — /login/office";
  if (role === "site_employee") return "SPDC site — /login/site";
  if (role === "employee") return "SPDC employee — /login/employee";
  return role;
}

export function roleFromAccountKind(kind: PortalAccountKind, staffRole = "office"): string {
  if (kind === "client") return "client";
  if (kind === "vendor") return "vendor";
  if (kind === "stakeholder") return "employee";
  return staffRole;
}

export function badgeToneForKind(kind: PortalAccountKind): "brand" | "ok" | "warn" | "neutral" {
  if (kind === "client") return "brand";
  if (kind === "vendor") return "warn";
  if (kind === "stakeholder") return "neutral";
  return "ok";
}
