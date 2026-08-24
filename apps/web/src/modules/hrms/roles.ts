import { MODULE_REGISTRY, createModuleRoleHelpers } from "@sharnam/shared";

const PERM = MODULE_REGISTRY["hrms"].permissionModule;

export const hrmsModuleRoles = createModuleRoleHelpers(PERM);

export const {
  canView: canViewHrms,
  canCreate: canCreateHrms,
  canEdit: canEditHrms,
  canApprove: canApproveHrms,
} = hrmsModuleRoles;
