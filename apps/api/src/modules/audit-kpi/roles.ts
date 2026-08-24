import { MODULE_REGISTRY } from "@sharnam/shared";
import { createModuleRoleHelpers } from "../_shared/createModuleRoles.js";

const PERM = MODULE_REGISTRY["audit-kpi"].permissionModule;

export const auditKpiModuleRoles = createModuleRoleHelpers(PERM);

export const {
  permissionModule: auditKpiPermissionModule,
  viewRoles: auditKpiViewRoles,
  createRoles: auditKpiCreateRoles,
  editRoles: auditKpiEditRoles,
  approveRoles: auditKpiApproveRoles,
  canView: canViewAuditKpi,
  canCreate: canCreateAuditKpi,
  canEdit: canEditAuditKpi,
  canApprove: canApproveAuditKpi,
} = auditKpiModuleRoles;
