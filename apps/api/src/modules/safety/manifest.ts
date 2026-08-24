import type { ModuleFileRef } from "@sharnam/shared";
import { MODULE_REGISTRY } from "@sharnam/shared";

export const SAFETY_MODULE_MANIFEST: ModuleFileRef[] = MODULE_REGISTRY["safety"].api.files;
export const SAFETY_MODULE = MODULE_REGISTRY["safety"];
