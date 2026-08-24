import { MODULE_REGISTRY } from "@sharnam/shared";
import { createModuleRoleHelpers } from "../_shared/createModuleRoles.js";

const PERM = MODULE_REGISTRY.cost.permissionModule;

export const costModuleRoles = createModuleRoleHelpers(PERM);

export const {
  permissionModule: costPermissionModule,
  viewRoles: costViewRoles,
  createRoles: costCreateRoles,
  editRoles: costEditRoles,
  approveRoles: costApproveRoles,
  canView: canViewCost,
  canCreate: canCreateCost,
  canEdit: canEditCost,
  canApprove: canApproveCost,
} = costModuleRoles;

/** Client portal — no cost module access. */
export function costBlockedForClient(role: string | null | undefined) {
  return role === "client";
}

/** Site can edit achieved/GFC qty on monitoring; office edits rates and structure. */
export function canEditCostSiteQty(role: string | null | undefined) {
  return role === "admin" || role === "office" || role === "employee" || role === "site_employee";
}

export function canEditCostOfficeOnly(role: string | null | undefined) {
  return role === "admin" || role === "office" || role === "employee";
}
