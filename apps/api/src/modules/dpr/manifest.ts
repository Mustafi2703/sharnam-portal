import type { ModuleFileRef } from "@sharnam/shared";
import { MODULE_REGISTRY } from "@sharnam/shared";

export const DPR_MODULE_MANIFEST: ModuleFileRef[] = MODULE_REGISTRY["dpr"].api.files;
export const DPR_MODULE = MODULE_REGISTRY["dpr"];
