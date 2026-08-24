import { MODULE_REGISTRY } from "@sharnam/shared";
import { createModuleRoleHelpers } from "../_shared/createModuleRoles.js";

const PERM = MODULE_REGISTRY["finance"].permissionModule;

export const financeModuleRoles = createModuleRoleHelpers(PERM);

export const {
  permissionModule: financePermissionModule,
  viewRoles: financeViewRoles,
  createRoles: financeCreateRoles,
  editRoles: financeEditRoles,
  approveRoles: financeApproveRoles,
  canView: canViewFinance,
  canCreate: canCreateFinance,
  canEdit: canEditFinance,
  canApprove: canApproveFinance,
} = financeModuleRoles;
