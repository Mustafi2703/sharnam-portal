/**
 * Working-hour options for employee onboarding.
 * Stored as one JSON row in AppSetting so HR can add and edit shifts without a schema change.
 */
import { randomUUID } from "crypto";
import { prisma } from "../prisma.js";

export const WORKING_HOURS_SETTING_KEY = "hrms.workingHours";

export type WorkingHourOption = { id: string; label: string };

/** Used only when HR has never saved the list. An explicit empty save stays empty. */
export const DEFAULT_WORKING_HOURS: WorkingHourOption[] = [
  { id: "default-0930-1830", label: "9:30 AM To 6:30 PM" },
  { id: "default-0900-1800", label: "9:00 AM To 6:00 PM" },
  { id: "default-1000-1900", label: "10:00 AM To 7:00 PM" },
];

export class WorkingHoursError extends Error {
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
  const label = cleanLabel(row.label);
  const id = String(row.id || "").trim();
  if (!label || !id) return null;
  return { id, label };
}

async function readStored(): Promise<WorkingHourOption[] | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: WORKING_HOURS_SETTING_KEY } });
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.value) as { options?: unknown };
    if (!Array.isArray(parsed.options)) return [];
    const seen = new Set<string>();
    const options: WorkingHourOption[] = [];
    for (const item of parsed.options) {
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
  const value = JSON.stringify({ options });
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

export async function listWorkingHours(): Promise<{ options: WorkingHourOption[]; usingDefaults: boolean }> {
  const stored = await readStored();
  if (!stored) return { options: DEFAULT_WORKING_HOURS.map((row) => ({ ...row })), usingDefaults: true };
  return { options: stored, usingDefaults: false };
}

function assertUnique(options: WorkingHourOption[], label: string, exceptId?: string) {
  const key = label.toLowerCase();
  if (options.some((row) => row.id !== exceptId && row.label.toLowerCase() === key)) {
    throw new WorkingHoursError(400, "That working hour option already exists");
  }
}

export async function addWorkingHour(labelRaw: unknown): Promise<WorkingHourOption> {
  const label = cleanLabel(labelRaw);
  if (!label) throw new WorkingHoursError(400, "Enter working hours");
  const options = await optionsForWrite();
  assertUnique(options, label);
  const option = { id: randomUUID(), label };
  options.push(option);
  await writeOptions(options);
  return option;
}

export async function updateWorkingHour(id: string, labelRaw: unknown): Promise<WorkingHourOption> {
  const label = cleanLabel(labelRaw);
  if (!label) throw new WorkingHoursError(400, "Enter working hours");
  const options = await optionsForWrite();
  const index = options.findIndex((row) => row.id === id);
  if (index < 0) throw new WorkingHoursError(404, "Working hours option not found");
  assertUnique(options, label, id);
  const option = { id, label };
  options[index] = option;
  await writeOptions(options);
  return option;
}

export async function deleteWorkingHour(id: string): Promise<void> {
  const options = await optionsForWrite();
  const next = options.filter((row) => row.id !== id);
  if (next.length === options.length) throw new WorkingHoursError(404, "Working hours option not found");
  await writeOptions(next);
}
