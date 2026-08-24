import { MODULE_REGISTRY } from "@sharnam/shared";
import { createModuleRoleHelpers } from "../_shared/createModuleRoles.js";

const PERM = MODULE_REGISTRY["dpr"].permissionModule;

export const dprModuleRoles = createModuleRoleHelpers(PERM);

export const {
  permissionModule: dprPermissionModule,
  viewRoles: dprViewRoles,
  createRoles: dprCreateRoles,
  editRoles: dprEditRoles,
  approveRoles: dprApproveRoles,
  canView: canViewDpr,
  canCreate: canCreateDpr,
  canEdit: canEditDpr,
  canApprove: canApproveDpr,
} = dprModuleRoles;
