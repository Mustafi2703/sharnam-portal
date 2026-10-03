/**
 * NCR / CAR activity log — persisted in formDataJson.activityLog + AuditEvent.
 */
import { audit } from "./audit.js";
import { prisma } from "../prisma.js";

export type NcrActivityEntry = {
  at: string;
  action: string;
  by?: string;
  userId?: string;
  note?: string;
};

export function parseNcrFormObject(raw?: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const p = JSON.parse(raw);
    return typeof p === "object" && p ? (p as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function readActivityLog(form: Record<string, unknown>): NcrActivityEntry[] {
  const raw = form.activityLog;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({
      at: String(x.at || ""),
      action: String(x.action || ""),
      by: x.by != null ? String(x.by) : undefined,
      userId: x.userId != null ? String(x.userId) : undefined,
      note: x.note != null ? String(x.note) : undefined,
    }))
    .filter((x) => x.at && x.action);
}

export function appendActivityToForm(
  form: Record<string, unknown>,
  entry: Omit<NcrActivityEntry, "at"> & { at?: string }
): Record<string, unknown> {
  const log = readActivityLog(form);
  log.push({
    at: entry.at || new Date().toISOString(),
    action: entry.action,
    by: entry.by,
    userId: entry.userId,
    note: entry.note,
  });
  // Keep last 80 events
  return { ...form, activityLog: log.slice(-80) };
}

export async function logQualityNcrActivity(opts: {
  ncrId: string;
  projectId: string;
  action: string;
  userId?: string;
  byName?: string;
  note?: string;
  meta?: Record<string, unknown>;
  formDataJson?: string | null;
}): Promise<string> {
  const form = parseNcrFormObject(opts.formDataJson);
  const merged = appendActivityToForm(form, {
    action: opts.action,
    by: opts.byName,
    userId: opts.userId,
    note: opts.note,
  });
  const nextJson = JSON.stringify(merged);
  await prisma.qualityNcr.update({
    where: { id: opts.ncrId },
    data: { formDataJson: nextJson },
  });
  await audit(`quality.ncr.${opts.action}`, {
    userId: opts.userId,
    entity: "QualityNcr",
    entityId: opts.ncrId,
    meta: { projectId: opts.projectId, note: opts.note, ...opts.meta },
  });
  return nextJson;
}

export async function listQualityNcrActivity(ncrId: string) {
  const row = await prisma.qualityNcr.findUnique({
    where: { id: ncrId },
    select: { formDataJson: true },
  });
  const formLog = readActivityLog(parseNcrFormObject(row?.formDataJson));
  const audits = await prisma.auditEvent.findMany({
    where: { entity: "QualityNcr", entityId: ncrId },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: { user: { select: { fullName: true, email: true } } },
  });
  const fromAudit = audits.map((a) => ({
    at: a.createdAt.toISOString(),
    action: a.action.replace(/^quality\.ncr\./, ""),
    by: a.user?.fullName || a.user?.email || undefined,
    userId: a.userId || undefined,
    note: (() => {
      try {
        const m = a.metaJson ? JSON.parse(a.metaJson) : null;
        return m?.note ? String(m.note) : undefined;
      } catch {
        return undefined;
      }
    })(),
    source: "audit" as const,
  }));
  const fromForm = formLog.map((e) => ({ ...e, source: "form" as const }));
  const seen = new Set<string>();
  const merged = [...fromForm, ...fromAudit]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .filter((e) => {
      const key = `${e.at.slice(0, 19)}|${e.action}|${e.by || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return merged.slice(0, 80);
}
