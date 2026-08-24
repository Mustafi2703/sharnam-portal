import { MODULE_REGISTRY, createModuleRoleHelpers } from "@sharnam/shared";

const PERM = MODULE_REGISTRY["drawings"].permissionModule;

export const drawingsModuleRoles = createModuleRoleHelpers(PERM);

export const {
  canView: canViewDrawings,
  canCreate: canCreateDrawings,
  canEdit: canEditDrawings,
  canApprove: canApproveDrawings,
} = drawingsModuleRoles;
