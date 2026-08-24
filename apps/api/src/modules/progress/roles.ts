import { MODULE_REGISTRY } from "@sharnam/shared";
import { createModuleRoleHelpers } from "../_shared/createModuleRoles.js";

const PERM = MODULE_REGISTRY["progress"].permissionModule;

export const progressModuleRoles = createModuleRoleHelpers(PERM);

export const {
  permissionModule: progressPermissionModule,
  viewRoles: progressViewRoles,
  createRoles: progressCreateRoles,
  editRoles: progressEditRoles,
  approveRoles: progressApproveRoles,
  canView: canViewProgress,
  canCreate: canCreateProgress,
  canEdit: canEditProgress,
  canApprove: canApproveProgress,
} = progressModuleRoles;
