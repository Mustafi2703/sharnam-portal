import { MODULE_REGISTRY } from "@sharnam/shared";
import { createModuleRoleHelpers } from "../_shared/createModuleRoles.js";

const PERM = MODULE_REGISTRY["comms"].permissionModule;

export const commsModuleRoles = createModuleRoleHelpers(PERM);

export const {
  permissionModule: commsPermissionModule,
  viewRoles: commsViewRoles,
  createRoles: commsCreateRoles,
  editRoles: commsEditRoles,
  approveRoles: commsApproveRoles,
  canView: canViewComms,
  canCreate: canCreateComms,
  canEdit: canEditComms,
  canApprove: canApproveComms,
} = commsModuleRoles;
