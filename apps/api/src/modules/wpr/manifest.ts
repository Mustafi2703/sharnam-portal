import type { ModuleFileRef } from "@sharnam/shared";
import { MODULE_REGISTRY } from "@sharnam/shared";

export const WPR_MODULE_MANIFEST: ModuleFileRef[] = MODULE_REGISTRY["wpr"].api.files;
export const WPR_MODULE = MODULE_REGISTRY["wpr"];
