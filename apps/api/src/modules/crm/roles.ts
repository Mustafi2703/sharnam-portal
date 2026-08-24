import { MODULE_REGISTRY } from "@sharnam/shared";
import { createModuleRoleHelpers } from "../_shared/createModuleRoles.js";

const PERM = MODULE_REGISTRY["crm"].permissionModule;

export const crmModuleRoles = createModuleRoleHelpers(PERM);

export const {
  permissionModule: crmPermissionModule,
  viewRoles: crmViewRoles,
  createRoles: crmCreateRoles,
  editRoles: crmEditRoles,
  approveRoles: crmApproveRoles,
  canView: canViewCrm,
  canCreate: canCreateCrm,
  canEdit: canEditCrm,
  canApprove: canApproveCrm,
} = crmModuleRoles;
