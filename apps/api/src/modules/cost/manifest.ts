import type { ModuleFileRef } from "@sharnam/shared";
import { MODULE_REGISTRY } from "@sharnam/shared";

/** Live + planned backend files for Cost module (see docs/MODULE_FOLDER_STRUCTURE.md). */
export const COST_MODULE_MANIFEST: ModuleFileRef[] = MODULE_REGISTRY.cost.api.files;
export const COST_MODULE = MODULE_REGISTRY.cost;
