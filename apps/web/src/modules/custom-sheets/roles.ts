import { MODULE_REGISTRY, createModuleRoleHelpers } from "@sharnam/shared";

const PERM = MODULE_REGISTRY["custom-sheets"].permissionModule;

export const customSheetsModuleRoles = createModuleRoleHelpers(PERM);

export const {
  canView: canViewCustomSheets,
  canCreate: canCreateCustomSheets,
  canEdit: canEditCustomSheets,
  canApprove: canApproveCustomSheets,
} = customSheetsModuleRoles;
