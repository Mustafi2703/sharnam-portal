import type { ModuleFileRef } from "@sharnam/shared";
import { MODULE_REGISTRY } from "@sharnam/shared";

export const CHECKLIST_MODULE_MANIFEST: ModuleFileRef[] = MODULE_REGISTRY["checklist"].api.files;
export const CHECKLIST_MODULE = MODULE_REGISTRY["checklist"];
