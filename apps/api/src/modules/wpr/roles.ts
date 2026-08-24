import { MODULE_REGISTRY } from "@sharnam/shared";
import { createModuleRoleHelpers } from "../_shared/createModuleRoles.js";

const PERM = MODULE_REGISTRY["wpr"].permissionModule;

export const wprModuleRoles = createModuleRoleHelpers(PERM);

export const {
  permissionModule: wprPermissionModule,
  viewRoles: wprViewRoles,
  createRoles: wprCreateRoles,
  editRoles: wprEditRoles,
  approveRoles: wprApproveRoles,
  canView: canViewWpr,
  canCreate: canCreateWpr,
  canEdit: canEditWpr,
  canApprove: canApproveWpr,
} = wprModuleRoles;
