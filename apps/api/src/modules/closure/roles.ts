import { MODULE_REGISTRY } from "@sharnam/shared";
import { createModuleRoleHelpers } from "../_shared/createModuleRoles.js";

const PERM = MODULE_REGISTRY["closure"].permissionModule;

export const closureModuleRoles = createModuleRoleHelpers(PERM);

export const {
  permissionModule: closurePermissionModule,
  viewRoles: closureViewRoles,
  createRoles: closureCreateRoles,
  editRoles: closureEditRoles,
  approveRoles: closureApproveRoles,
  canView: canViewClosure,
  canCreate: canCreateClosure,
  canEdit: canEditClosure,
  canApprove: canApproveClosure,
} = closureModuleRoles;
