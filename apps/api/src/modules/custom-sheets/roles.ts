import { MODULE_REGISTRY } from "@sharnam/shared";
import { createModuleRoleHelpers } from "../_shared/createModuleRoles.js";

const PERM = MODULE_REGISTRY["custom-sheets"].permissionModule;

export const customSheetsModuleRoles = createModuleRoleHelpers(PERM);

export const {
  permissionModule: customSheetsPermissionModule,
  viewRoles: customSheetsViewRoles,
  createRoles: customSheetsCreateRoles,
  editRoles: customSheetsEditRoles,
  approveRoles: customSheetsApproveRoles,
  canView: canViewCustomSheets,
  canCreate: canCreateCustomSheets,
  canEdit: canEditCustomSheets,
  canApprove: canApproveCustomSheets,
} = customSheetsModuleRoles;
