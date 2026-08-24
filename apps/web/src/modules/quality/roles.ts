import { MODULE_REGISTRY, createModuleRoleHelpers } from "@sharnam/shared";

const PERM = MODULE_REGISTRY["quality"].permissionModule;

export const qualityModuleRoles = createModuleRoleHelpers(PERM);

export const {
  canView: canViewQuality,
  canCreate: canCreateQuality,
  canEdit: canEditQuality,
  canApprove: canApproveQuality,
} = qualityModuleRoles;
