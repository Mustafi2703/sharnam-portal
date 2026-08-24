import type { ModuleFileRef } from "@sharnam/shared";
import { MODULE_REGISTRY } from "@sharnam/shared";

export const AUDIT_KPI_MODULE_MANIFEST: ModuleFileRef[] = MODULE_REGISTRY["audit-kpi"].api.files;
export const AUDIT_KPI_MODULE = MODULE_REGISTRY["audit-kpi"];
