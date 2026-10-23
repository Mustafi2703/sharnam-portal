import { randomUUID } from "crypto";
import { Router } from "express";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { prisma } from "../prisma.js";
import { audit } from "../services/audit.js";

/** JSON array of { id, label } in AppSetting. No schema change. */
export const WORKING_HOURS_SETTING_KEY = "hrm.workingHours";

export type WorkingHourOption = { id: string; label: string };

/** Shown until someone saves the list. An explicit empty save stays empty. */
const DEFAULT_WORKING_HOURS: WorkingHourOption[] = [
  { id: "default-0930-1830", label: "9:30 AM To 6:30 PM" },
  { id: "default-0900-1800", label: "9:00 AM To 6:00 PM" },
  { id: "default-1000-1900", label: "10:00 AM To 7:00 PM" },
];

class WorkingHoursError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function cleanLabel(raw: unknown): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
}

function cleanOption(raw: unknown): WorkingHourOption | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as { id?: unknown; label?: unknown };
  const id = String(row.id || "").trim();
  const label = cleanLabel(row.label);
  if (!id || !label) return null;
  return { id, label };
}

async function readStored(): Promise<WorkingHourOption[] | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: WORKING_HOURS_SETTING_KEY } });
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.value) as unknown;
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const options: WorkingHourOption[] = [];
    for (const item of parsed) {
      const option = cleanOption(item);
      if (!option) continue;
      const key = option.label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      options.push(option);
    }
    return options;
  } catch {
    return [];
  }
}

async function writeOptions(options: WorkingHourOption[]) {
  const value = JSON.stringify(options);
  await prisma.appSetting.upsert({
    where: { key: WORKING_HOURS_SETTING_KEY },
    create: { key: WORKING_HOURS_SETTING_KEY, value },
    update: { value },
  });
}

async function optionsForWrite(): Promise<WorkingHourOption[]> {
  const stored = await readStored();
  if (!stored) return DEFAULT_WORKING_HOURS.map((row) => ({ ...row }));
  return stored.map((row) => ({ ...row }));
}

function assertUnique(options: WorkingHourOption[], label: string, exceptId?: string) {
  const key = label.toLowerCase();
  if (options.some((row) => row.id !== exceptId && row.label.toLowerCase() === key)) {
    throw new WorkingHoursError(400, "That working hour option already exists");
  }
}

function sendError(res: { status: (code: number) => { json: (body: unknown) => void } }, err: unknown) {
  if (err instanceof WorkingHoursError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: "Could not update working hours" });
}

export const hrmWorkingHoursRouter = Router();
hrmWorkingHoursRouter.use(requireAuth);

hrmWorkingHoursRouter.get("/working-hours", requireRoles("admin", "office", "hr"), async (_req, res) => {
  const stored = await readStored();
  res.json(stored ?? DEFAULT_WORKING_HOURS.map((row) => ({ ...row })));
});

hrmWorkingHoursRouter.post("/working-hours", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  try {
    const label = cleanLabel(req.body?.label);
    if (!label) throw new WorkingHoursError(400, "Enter working hours");
    const options = await optionsForWrite();
    assertUnique(options, label);
    const option = { id: randomUUID(), label };
    options.push(option);
    await writeOptions(options);
    await audit("hrm.working_hours.add", {
      userId: req.user!.id,
      entity: "AppSetting",
      entityId: WORKING_HOURS_SETTING_KEY,
      meta: option,
    });
    res.status(201).json(option);
  } catch (err) {
    sendError(res, err);
  }
});

hrmWorkingHoursRouter.patch("/working-hours/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  try {
    const label = cleanLabel(req.body?.label);
    if (!label) throw new WorkingHoursError(400, "Enter working hours");
    const options = await optionsForWrite();
    const index = options.findIndex((row) => row.id === req.params.id);
    if (index < 0) throw new WorkingHoursError(404, "Working hours option not found");
    assertUnique(options, label, req.params.id);
    const option = { id: req.params.id, label };
    options[index] = option;
    await writeOptions(options);
    await audit("hrm.working_hours.update", {
      userId: req.user!.id,
      entity: "AppSetting",
      entityId: WORKING_HOURS_SETTING_KEY,
      meta: option,
    });
    res.json(option);
  } catch (err) {
    sendError(res, err);
  }
});

hrmWorkingHoursRouter.delete("/working-hours/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  try {
    const options = await optionsForWrite();
    const next = options.filter((row) => row.id !== req.params.id);
    if (next.length === options.length) throw new WorkingHoursError(404, "Working hours option not found");
    await writeOptions(next);
    await audit("hrm.working_hours.delete", {
      userId: req.user!.id,
      entity: "AppSetting",
      entityId: WORKING_HOURS_SETTING_KEY,
      meta: { id: req.params.id },
    });
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err);
  }
});
