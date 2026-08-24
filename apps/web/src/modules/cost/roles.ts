import { MODULE_REGISTRY, createModuleRoleHelpers } from "@sharnam/shared";

const PERM = MODULE_REGISTRY["cost"].permissionModule;

export const costModuleRoles = createModuleRoleHelpers(PERM);

export const {
  canView: canViewCost,
  canCreate: canCreateCost,
  canEdit: canEditCost,
  canApprove: canApproveCost,
} = costModuleRoles;
