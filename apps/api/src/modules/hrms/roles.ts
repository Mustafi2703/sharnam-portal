import { MODULE_REGISTRY } from "@sharnam/shared";
import { createModuleRoleHelpers } from "../_shared/createModuleRoles.js";

const PERM = MODULE_REGISTRY["hrms"].permissionModule;

export const hrmsModuleRoles = createModuleRoleHelpers(PERM);

export const {
  permissionModule: hrmsPermissionModule,
  viewRoles: hrmsViewRoles,
  createRoles: hrmsCreateRoles,
  editRoles: hrmsEditRoles,
  approveRoles: hrmsApproveRoles,
  canView: canViewHrms,
  canCreate: canCreateHrms,
  canEdit: canEditHrms,
  canApprove: canApproveHrms,
} = hrmsModuleRoles;
