import type { ModuleKey, PermissionAction, RoleKey } from "./index.js";
import { DEFAULT_ROLE_PERMISSIONS, ROLES, can } from "./index.js";

/** Build role → action map for a permission module (used in API + web). */
export function rolesForModule(module: ModuleKey, action: PermissionAction): RoleKey[] {
  return ROLES.filter((role) => can(DEFAULT_ROLE_PERMISSIONS[role], module, action));
}

export function roleCanModule(role: RoleKey | undefined | null, module: ModuleKey, action: PermissionAction): boolean {
  if (!role) return false;
  if (role === "admin") return true;
  return can(DEFAULT_ROLE_PERMISSIONS[role], module, action);
}

/** Factory for `modules/<name>/roles.ts` — one call per portal module. */
export function createModuleRoleHelpers(permissionModule: ModuleKey) {
  return {
    permissionModule,
    viewRoles: () => rolesForModule(permissionModule, "view"),
    createRoles: () => rolesForModule(permissionModule, "create"),
    editRoles: () => rolesForModule(permissionModule, "edit"),
    approveRoles: () => rolesForModule(permissionModule, "approve"),
    canView: (role: RoleKey | null | undefined) => roleCanModule(role, permissionModule, "view"),
    canCreate: (role: RoleKey | null | undefined) => roleCanModule(role, permissionModule, "create"),
    canEdit: (role: RoleKey | null | undefined) => roleCanModule(role, permissionModule, "edit"),
    canApprove: (role: RoleKey | null | undefined) => roleCanModule(role, permissionModule, "approve"),
  };
}
