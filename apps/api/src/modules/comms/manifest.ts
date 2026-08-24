import type { ModuleFileRef } from "@sharnam/shared";
import { MODULE_REGISTRY } from "@sharnam/shared";

export const COMMS_MODULE_MANIFEST: ModuleFileRef[] = MODULE_REGISTRY["comms"].api.files;
export const COMMS_MODULE = MODULE_REGISTRY["comms"];
