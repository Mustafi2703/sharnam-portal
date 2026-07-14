import type { ModuleKey, ModulePermissions, PermissionAction, RoleKey } from "@sharnam/shared";
import { DEFAULT_ROLE_PERMISSIONS, can as sharedCan } from "@sharnam/shared";

export function can(
  permissions: ModulePermissions | null | undefined,
  module: ModuleKey,
  action: PermissionAction,
  role?: RoleKey | null
): boolean {
  if (role === "admin") return true;
  if (permissions) return sharedCan(permissions, module, action);
  if (role) return sharedCan(DEFAULT_ROLE_PERMISSIONS[role], module, action);
  return false;
}

/** Roles that may upload drawings / revisions / publish (not client) */
export function canManageDrawings(role?: RoleKey | null) {
  return (
    role === "admin" ||
    role === "office" ||
    role === "employee" ||
    role === "site_employee" ||
    role === "vendor"
  );
}

/** Client: view only for drawings; may raise RFIs */
export function isClientViewOnly(role?: RoleKey | null) {
  return role === "client";
}

export function canEditChecklist(role?: RoleKey | null) {
  return role === "admin" || role === "office" || role === "site_employee" || role === "vendor" || role === "employee";
}

export function canApproveChecklist(role?: RoleKey | null) {
  return role === "admin" || role === "office";
}
