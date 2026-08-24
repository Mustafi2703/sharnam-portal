import { MODULE_REGISTRY, createModuleRoleHelpers } from "@sharnam/shared";

const PERM = MODULE_REGISTRY["crm"].permissionModule;

export const crmModuleRoles = createModuleRoleHelpers(PERM);

export const {
  canView: canViewCrm,
  canCreate: canCreateCrm,
  canEdit: canEditCrm,
  canApprove: canApproveCrm,
} = crmModuleRoles;
