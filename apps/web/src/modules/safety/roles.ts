import { MODULE_REGISTRY, createModuleRoleHelpers } from "@sharnam/shared";

const PERM = MODULE_REGISTRY["safety"].permissionModule;

export const safetyModuleRoles = createModuleRoleHelpers(PERM);

export const {
  canView: canViewSafety,
  canCreate: canCreateSafety,
  canEdit: canEditSafety,
  canApprove: canApproveSafety,
} = safetyModuleRoles;
