import { MODULE_REGISTRY } from "@sharnam/shared";
import { createModuleRoleHelpers } from "../_shared/createModuleRoles.js";

const PERM = MODULE_REGISTRY["drawings"].permissionModule;

export const drawingsModuleRoles = createModuleRoleHelpers(PERM);

export const {
  permissionModule: drawingsPermissionModule,
  viewRoles: drawingsViewRoles,
  createRoles: drawingsCreateRoles,
  editRoles: drawingsEditRoles,
  approveRoles: drawingsApproveRoles,
  canView: canViewDrawings,
  canCreate: canCreateDrawings,
  canEdit: canEditDrawings,
  canApprove: canApproveDrawings,
} = drawingsModuleRoles;
