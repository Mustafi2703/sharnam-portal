import type { ModuleFileRef } from "@sharnam/shared";
import { MODULE_REGISTRY } from "@sharnam/shared";

export const FINANCE_MODULE_MANIFEST: ModuleFileRef[] = MODULE_REGISTRY["finance"].api.files;
export const FINANCE_MODULE = MODULE_REGISTRY["finance"];
