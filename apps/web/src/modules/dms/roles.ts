import { MODULE_REGISTRY, createModuleRoleHelpers } from "@sharnam/shared";

const PERM = MODULE_REGISTRY["dms"].permissionModule;

export const dmsModuleRoles = createModuleRoleHelpers(PERM);

export const {
  canView: canViewDms,
  canCreate: canCreateDms,
  canEdit: canEditDms,
  canApprove: canApproveDms,
} = dmsModuleRoles;
