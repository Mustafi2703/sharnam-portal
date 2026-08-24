import type { ModuleFileRef } from "@sharnam/shared";
import { MODULE_REGISTRY } from "@sharnam/shared";

export const PROGRESS_MODULE_MANIFEST: ModuleFileRef[] = MODULE_REGISTRY["progress"].api.files;
export const PROGRESS_MODULE = MODULE_REGISTRY["progress"];
