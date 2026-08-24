import { MODULE_REGISTRY, createModuleRoleHelpers } from "@sharnam/shared";

const PERM = MODULE_REGISTRY["comms"].permissionModule;

export const commsModuleRoles = createModuleRoleHelpers(PERM);

export const {
  canView: canViewComms,
  canCreate: canCreateComms,
  canEdit: canEditComms,
  canApprove: canApproveComms,
} = commsModuleRoles;
