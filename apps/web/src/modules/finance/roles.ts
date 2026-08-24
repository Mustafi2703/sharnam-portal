import { MODULE_REGISTRY, createModuleRoleHelpers } from "@sharnam/shared";

const PERM = MODULE_REGISTRY["finance"].permissionModule;

export const financeModuleRoles = createModuleRoleHelpers(PERM);

export const {
  canView: canViewFinance,
  canCreate: canCreateFinance,
  canEdit: canEditFinance,
  canApprove: canApproveFinance,
} = financeModuleRoles;
