import type { ModuleFileRef } from "@sharnam/shared";
import { MODULE_REGISTRY } from "@sharnam/shared";

export const CRM_MODULE_MANIFEST: ModuleFileRef[] = MODULE_REGISTRY["crm"].api.files;
export const CRM_MODULE = MODULE_REGISTRY["crm"];
