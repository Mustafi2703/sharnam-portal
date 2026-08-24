import type { ModuleFileRef } from "@sharnam/shared";
import { MODULE_REGISTRY } from "@sharnam/shared";

export const CLOSURE_MODULE_MANIFEST: ModuleFileRef[] = MODULE_REGISTRY["closure"].api.files;
export const CLOSURE_MODULE = MODULE_REGISTRY["closure"];
