import { MODULE_REGISTRY, createModuleRoleHelpers } from "@sharnam/shared";

const PERM = MODULE_REGISTRY["closure"].permissionModule;

export const closureModuleRoles = createModuleRoleHelpers(PERM);

export const {
  canView: canViewClosure,
  canCreate: canCreateClosure,
  canEdit: canEditClosure,
  canApprove: canApproveClosure,
} = closureModuleRoles;
