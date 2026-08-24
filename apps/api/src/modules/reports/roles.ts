import { MODULE_REGISTRY } from "@sharnam/shared";
import { createModuleRoleHelpers } from "../_shared/createModuleRoles.js";

const PERM = MODULE_REGISTRY["reports"].permissionModule;

export const reportsModuleRoles = createModuleRoleHelpers(PERM);

export const {
  permissionModule: reportsPermissionModule,
  viewRoles: reportsViewRoles,
  createRoles: reportsCreateRoles,
  editRoles: reportsEditRoles,
  approveRoles: reportsApproveRoles,
  canView: canViewReports,
  canCreate: canCreateReports,
  canEdit: canEditReports,
  canApprove: canApproveReports,
} = reportsModuleRoles;
