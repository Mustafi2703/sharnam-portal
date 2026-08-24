import type { ModuleFileRef } from "@sharnam/shared";
import { MODULE_REGISTRY } from "@sharnam/shared";

export const HRMS_MODULE_MANIFEST: ModuleFileRef[] = MODULE_REGISTRY["hrms"].api.files;
export const HRMS_MODULE = MODULE_REGISTRY["hrms"];
