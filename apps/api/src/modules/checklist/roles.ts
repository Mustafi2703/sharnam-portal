import { MODULE_REGISTRY } from "@sharnam/shared";
import { createModuleRoleHelpers } from "../_shared/createModuleRoles.js";

const PERM = MODULE_REGISTRY["checklist"].permissionModule;

export const checklistModuleRoles = createModuleRoleHelpers(PERM);

export const {
  permissionModule: checklistPermissionModule,
  viewRoles: checklistViewRoles,
  createRoles: checklistCreateRoles,
  editRoles: checklistEditRoles,
  approveRoles: checklistApproveRoles,
  canView: canViewChecklist,
  canCreate: canCreateChecklist,
  canEdit: canEditChecklist,
  canApprove: canApproveChecklist,
} = checklistModuleRoles;
