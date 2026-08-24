import { MODULE_REGISTRY, createModuleRoleHelpers } from "@sharnam/shared";

const PERM = MODULE_REGISTRY["checklist"].permissionModule;

export const checklistModuleRoles = createModuleRoleHelpers(PERM);

export const {
  canView: canViewChecklist,
  canCreate: canCreateChecklist,
  canEdit: canEditChecklist,
  canApprove: canApproveChecklist,
} = checklistModuleRoles;
