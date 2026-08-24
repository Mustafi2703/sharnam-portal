import type { PortalModuleId, RoleKey } from "@sharnam/shared";
import {
  MODULE_REGISTRY,
  PORTAL_MODULE_IDS,
  getModuleDefinition,
  moduleViewRoles,
  createModuleRoleHelpers,
} from "@sharnam/shared";
import { can as canPermission } from "../permissions";

/** Cached role helpers keyed by portal module id. */
const roleHelpers = new Map<PortalModuleId, ReturnType<typeof createModuleRoleHelpers>>();

function helpersFor(id: PortalModuleId) {
  let h = roleHelpers.get(id);
  if (!h) {
    h = createModuleRoleHelpers(MODULE_REGISTRY[id].permissionModule);
    roleHelpers.set(id, h);
  }
  return h;
}

export { MODULE_REGISTRY, PORTAL_MODULE_IDS, getModuleDefinition, moduleViewRoles };
export type { PortalModuleId };

/** Can the role open this hub module (uses shared permission matrix). */
export function canAccessModule(role: RoleKey | null | undefined, id: PortalModuleId): boolean {
  if (!role) return false;
  return helpersFor(id).canView(role);
}

/** Same as canAccessModule but accepts custom permissions from API user payload. */
export function canAccessModuleWithPerms(
  role: RoleKey | null | undefined,
  id: PortalModuleId,
  permissions?: Parameters<typeof canPermission>[0]
): boolean {
  if (!role) return false;
  if (role === "admin") return true;
  const mod = MODULE_REGISTRY[id].permissionModule;
  if (permissions) return canPermission(permissions, mod, "view", role);
  return helpersFor(id).canView(role);
}

/** Hub tool filter — role in view list for module. */
export function roleInModuleViewList(role: RoleKey | null | undefined, id: PortalModuleId): boolean {
  return moduleViewRoles(id).includes(role as RoleKey);
}

/** Resolve docs path for module help links. */
export function moduleDocsPath(id: PortalModuleId): string {
  return MODULE_REGISTRY[id].docs;
}

/** List web page entry points for a module (migration map). */
export function moduleWebPages(id: PortalModuleId): string[] {
  return MODULE_REGISTRY[id].web.pages;
}

/** List component paths slated for colocation under modules/<id>/components. */
export function moduleWebComponents(id: PortalModuleId): string[] {
  return MODULE_REGISTRY[id].web.components;
}
