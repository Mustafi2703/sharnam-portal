import type { ModuleFileRef } from "@sharnam/shared";
import { MODULE_REGISTRY } from "@sharnam/shared";

export const REPORTS_MODULE_MANIFEST: ModuleFileRef[] = MODULE_REGISTRY["reports"].api.files;
export const REPORTS_MODULE = MODULE_REGISTRY["reports"];
