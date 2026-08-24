import { MODULE_REGISTRY, createModuleRoleHelpers } from "@sharnam/shared";

const PERM = MODULE_REGISTRY["reports"].permissionModule;

export const reportsModuleRoles = createModuleRoleHelpers(PERM);

export const {
  canView: canViewReports,
  canCreate: canCreateReports,
  canEdit: canEditReports,
  canApprove: canApproveReports,
} = reportsModuleRoles;
