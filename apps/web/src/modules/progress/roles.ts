import { MODULE_REGISTRY, createModuleRoleHelpers } from "@sharnam/shared";

const PERM = MODULE_REGISTRY["progress"].permissionModule;

export const progressModuleRoles = createModuleRoleHelpers(PERM);

export const {
  canView: canViewProgress,
  canCreate: canCreateProgress,
  canEdit: canEditProgress,
  canApprove: canApproveProgress,
} = progressModuleRoles;
