import { MODULE_REGISTRY } from "@sharnam/shared";
import { createModuleRoleHelpers } from "../_shared/createModuleRoles.js";

const PERM = MODULE_REGISTRY["quality"].permissionModule;

export const qualityModuleRoles = createModuleRoleHelpers(PERM);

export const {
  permissionModule: qualityPermissionModule,
  viewRoles: qualityViewRoles,
  createRoles: qualityCreateRoles,
  editRoles: qualityEditRoles,
  approveRoles: qualityApproveRoles,
  canView: canViewQuality,
  canCreate: canCreateQuality,
  canEdit: canEditQuality,
  canApprove: canApproveQuality,
} = qualityModuleRoles;
