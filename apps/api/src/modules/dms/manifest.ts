import type { ModuleFileRef } from "@sharnam/shared";
import { MODULE_REGISTRY } from "@sharnam/shared";

export const DMS_MODULE_MANIFEST: ModuleFileRef[] = MODULE_REGISTRY["dms"].api.files;
export const DMS_MODULE = MODULE_REGISTRY["dms"];
