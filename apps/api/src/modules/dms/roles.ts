import { MODULE_REGISTRY } from "@sharnam/shared";
import { createModuleRoleHelpers } from "../_shared/createModuleRoles.js";

const PERM = MODULE_REGISTRY["dms"].permissionModule;

export const dmsModuleRoles = createModuleRoleHelpers(PERM);

export const {
  permissionModule: dmsPermissionModule,
  viewRoles: dmsViewRoles,
  createRoles: dmsCreateRoles,
  editRoles: dmsEditRoles,
  approveRoles: dmsApproveRoles,
  canView: canViewDms,
  canCreate: canCreateDms,
  canEdit: canEditDms,
  canApprove: canApproveDms,
} = dmsModuleRoles;
