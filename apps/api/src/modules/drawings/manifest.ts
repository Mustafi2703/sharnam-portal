import type { ModuleFileRef } from "@sharnam/shared";
import { MODULE_REGISTRY } from "@sharnam/shared";

export const DRAWINGS_MODULE_MANIFEST: ModuleFileRef[] = MODULE_REGISTRY["drawings"].api.files;
export const DRAWINGS_MODULE = MODULE_REGISTRY["drawings"];
