import type { ModuleFileRef } from "@sharnam/shared";
import { MODULE_REGISTRY } from "@sharnam/shared";

export const QUALITY_MODULE_MANIFEST: ModuleFileRef[] = MODULE_REGISTRY["quality"].api.files;
export const QUALITY_MODULE = MODULE_REGISTRY["quality"];
