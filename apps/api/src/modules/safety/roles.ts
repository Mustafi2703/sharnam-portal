import { MODULE_REGISTRY } from "@sharnam/shared";
import { createModuleRoleHelpers } from "../_shared/createModuleRoles.js";

const PERM = MODULE_REGISTRY["safety"].permissionModule;

export const safetyModuleRoles = createModuleRoleHelpers(PERM);

export const {
  permissionModule: safetyPermissionModule,
  viewRoles: safetyViewRoles,
  createRoles: safetyCreateRoles,
  editRoles: safetyEditRoles,
  approveRoles: safetyApproveRoles,
  canView: canViewSafety,
  canCreate: canCreateSafety,
  canEdit: canEditSafety,
  canApprove: canApproveSafety,
} = safetyModuleRoles;
