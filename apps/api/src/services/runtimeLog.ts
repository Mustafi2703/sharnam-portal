/** In-process ring buffer so HR / office can see API failures without server SSH. */

export type RuntimeLogLevel = "info" | "warn" | "error";

export type RuntimeLogEntry = {
  id: string;
  at: string;
  level: RuntimeLogLevel;
  source: string;
  message: string;
  status?: number;
  method?: string;
  path?: string;
  userId?: string;
  userEmail?: string;
  detail?: string;
};

const MAX = 250;
const buffer: RuntimeLogEntry[] = [];
let seq = 0;

export function pushRuntimeLog(input: Omit<RuntimeLogEntry, "id" | "at"> & { at?: string }): RuntimeLogEntry {
  const entry: RuntimeLogEntry = {
    id: `rt-${Date.now().toString(36)}-${++seq}`,
    at: input.at || new Date().toISOString(),
    level: input.level,
    source: input.source,
    message: String(input.message || "Unknown").slice(0, 500),
    status: input.status,
    method: input.method,
    path: input.path,
    userId: input.userId,
    userEmail: input.userEmail,
    detail: input.detail ? String(input.detail).slice(0, 2000) : undefined,
  };
  buffer.unshift(entry);
  if (buffer.length > MAX) buffer.length = MAX;
  const line = `[runtime ${entry.level}] ${entry.source} ${entry.message}`;
  if (entry.level === "error") console.error(line, entry.detail || "");
  else if (entry.level === "warn") console.warn(line);
  else console.log(line);
  return entry;
}

export function listRuntimeLogs(take = 100): RuntimeLogEntry[] {
  return buffer.slice(0, Math.min(Math.max(take, 1), MAX));
}

export function errorDetail(err: unknown): string {
  if (err instanceof Error) return err.stack || err.message;
  return String(err);
}
