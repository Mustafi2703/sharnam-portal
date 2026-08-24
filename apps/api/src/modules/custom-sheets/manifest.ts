import type { ModuleFileRef } from "@sharnam/shared";
import { MODULE_REGISTRY } from "@sharnam/shared";

export const CUSTOM_SHEETS_MODULE_MANIFEST: ModuleFileRef[] = MODULE_REGISTRY["custom-sheets"].api.files;
export const CUSTOM_SHEETS_MODULE = MODULE_REGISTRY["custom-sheets"];
