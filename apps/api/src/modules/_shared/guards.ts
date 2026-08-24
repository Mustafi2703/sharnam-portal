import type { RequestHandler } from "express";
import type { ModuleKey, PermissionAction, PortalModuleId } from "@sharnam/shared";
import { MODULE_REGISTRY } from "@sharnam/shared";
import { requirePermission, requireRoles, type AuthedRequest } from "../../auth.js";

/** Resolve permission module for a portal module folder. */
export function permissionModuleFor(id: PortalModuleId): ModuleKey {
  return MODULE_REGISTRY[id].permissionModule;
}

/** Express middleware — view / list (uses shared permission matrix). */
export function requireModuleView(id: PortalModuleId): RequestHandler {
  return requirePermission(permissionModuleFor(id), "view");
}

export function requireModuleCreate(id: PortalModuleId): RequestHandler {
  return requirePermission(permissionModuleFor(id), "create");
}

export function requireModuleEdit(id: PortalModuleId): RequestHandler {
  return requirePermission(permissionModuleFor(id), "edit");
}

export function requireModuleApprove(id: PortalModuleId): RequestHandler {
  return requirePermission(permissionModuleFor(id), "approve");
}

/** Cost-specific: office full edit; site_employee limited BOQ achieved/GFC only. */
export function requireCostOfficeEdit(): RequestHandler {
  return requireRoles("admin", "office", "employee");
}

export function requireCostSiteQtyEdit(): RequestHandler {
  return requireRoles("admin", "office", "employee", "site_employee");
}

export function clientBlocked(req: AuthedRequest, res: Parameters<RequestHandler>[1]): boolean {
  if (req.user?.role === "client") {
    res.status(403).json({ error: "Forbidden for client portal" });
    return true;
  }
  return false;
}

export type { PermissionAction };
