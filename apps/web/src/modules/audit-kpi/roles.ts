import { MODULE_REGISTRY, createModuleRoleHelpers } from "@sharnam/shared";

const PERM = MODULE_REGISTRY["audit-kpi"].permissionModule;

export const auditKpiModuleRoles = createModuleRoleHelpers(PERM);

export const {
  canView: canViewAuditKpi,
  canCreate: canCreateAuditKpi,
  canEdit: canEditAuditKpi,
  canApprove: canApproveAuditKpi,
} = auditKpiModuleRoles;
