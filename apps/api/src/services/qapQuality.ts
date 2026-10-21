/**
 * Stable QAP lines, IR counts, frequency due quantities, and weekly QPI.
 */
import { prisma } from "../prisma.js";
import {
  expectedIrCount,
  frequencyLabel,
  irChains,
  parseQapFrequency,
  irTypeForPmcRole,
  qapLineStatus,
  requiredEnclosures,
  signoffFlags,
  type QapIrSnap,
} from "@sharnam/shared";

export function rowIsHeader(row: {
  frequency?: string | null;
  contractorPerformer?: string | null;
  contractorChecker?: string | null;
  pmcRole?: string | null;
  clientRole?: string | null;
  description?: string | null;
}): boolean {
  const freq = String(row.frequency || "").trim();
  const roles = [row.contractorPerformer, row.contractorChecker, row.pmcRole, row.clientRole].some((v) => String(v || "").trim());
  if (freq || roles) return false;
  return true;
}

function lineKey(row: { section?: string | null; description?: string | null; frequency?: string | null; workPackage?: string | null }) {
  return [row.workPackage || "", row.section || "", row.description || "", row.frequency || ""].join("\u0001");
}

/** Group weekly rows onto one QapLine per plan line. Safe to call repeatedly. */
export async function ensureQapLines(projectId: string) {
  const activities = await prisma.qapActivity.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });
  const existing = await prisma.qapLine.findMany({ where: { projectId }, orderBy: { sortOrder: "asc" } });
  const byKey = new Map(existing.map((l) => [lineKey(l), l]));
  let sort = existing.reduce((m, l) => Math.max(m, l.sortOrder), 0);

  for (const row of activities) {
    const header = row.isHeader || rowIsHeader(row);
    const key = lineKey(row);
    let line = byKey.get(key);
    if (!line) {
      sort += 1;
      line = await prisma.qapLine.create({
        data: {
          projectId,
          workPackage: row.workPackage,
          srNo: row.srNo,
          section: row.section,
          activity: row.activity || row.section,
          description: row.description,
          frequency: row.frequency,
          codeOfConformance: row.codeOfConformance,
          testAgency: row.testAgency,
          contractorPerformer: row.contractorPerformer,
          contractorChecker: row.contractorChecker,
          pmcRole: row.pmcRole,
          clientRole: row.clientRole,
          records: row.records,
          discipline: row.discipline,
          isHeader: header,
          sortOrder: sort,
        },
      });
      byKey.set(key, line);
    } else if (line.isHeader !== header) {
      line = await prisma.qapLine.update({ where: { id: line.id }, data: { isHeader: header } });
      byKey.set(key, line);
    }
    if (row.qapLineId !== line.id || row.isHeader !== header) {
      await prisma.qapActivity.update({
        where: { id: row.id },
        data: { qapLineId: line.id, isHeader: header },
      });
    }
  }
  return byKey.size;
}

type DprLine = { description?: string; unit?: string; qtyToday?: number };

function sectionPattern(section: string | null | undefined): RegExp {
  const words = String(section || "")
    .split(/[^A-Za-z]+/)
    .filter((w) => w.length > 3)
    .slice(0, 6)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, ""));
  if (!words.length) return /.^/;
  return new RegExp(words.join("|"), "i");
}

const CONCRETE = /concret|rcc|pcc|pour|slab|column|footing|raft|beam/i;
const CUM = /cum|cmt|m3|m³|cu\.?\s?m/i;
const SQM = /sqm|sq\.?\s?m|m2|m²/i;
const NOS = /nos|no'?s|numbers?/i;

export async function dprQuantities(
  projectId: string,
  from: Date,
  to: Date,
  section: string | null | undefined
): Promise<{ cum: number; sqm: number; nos: number; pours: number }> {
  const snaps = await prisma.dprSnapshot.findMany({
    where: { projectId, logDate: { gte: new Date(from.getTime() - 86400000), lte: new Date(to.getTime() + 86400000) } },
    select: { linesJson: true },
  });
  const sectionRe = sectionPattern(section);
  let cum = 0;
  let sqm = 0;
  let nos = 0;
  let pours = 0;
  for (const sn of snaps) {
    let lines: DprLine[] = [];
    try {
      lines = JSON.parse(sn.linesJson || "[]");
    } catch {
      lines = [];
    }
    for (const l of lines) {
      const desc = l.description || "";
      const qty = Number(l.qtyToday) || 0;
      const unit = l.unit || "";
      if (CUM.test(unit) && (CONCRETE.test(desc) || sectionRe.test(desc))) {
        cum += qty;
        if (qty > 0 && CONCRETE.test(desc)) pours += 1;
      } else if (SQM.test(unit) && (sectionRe.test(desc) || sectionRe.source === ".^")) {
        sqm += qty;
      } else if (NOS.test(unit) && sectionRe.test(desc)) {
        nos += qty;
      }
    }
  }
  return { cum: Math.round(cum * 10) / 10, sqm: Math.round(sqm * 10) / 10, nos: Math.round(nos), pours };
}

export function weekRange(weekLabel: string, projectStart: Date | null): { start: Date; end: Date; ended: boolean } {
  const now = new Date();
  const m = String(weekLabel || "").match(/week\s*(\d+)/i);
  let start: Date;
  if (m && projectStart) {
    const n = parseInt(m[1], 10);
    const s = new Date(projectStart);
    const mon0 = new Date(s.getFullYear(), s.getMonth(), s.getDate() - ((s.getDay() + 6) % 7));
    start = new Date(mon0);
    start.setDate(start.getDate() + Math.max(0, n - 1) * 7);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  }
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end, ended: now.getTime() > end.getTime() };
}

function formOf(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function snapOf(rfi: { id: string; previousIrId: string | null; formDataJson: string | null; status: string; createdAt: Date }, final: boolean): QapIrSnap {
  const form = formOf(rfi.formDataJson);
  return {
    id: rfi.id,
    previousIrId: rfi.previousIrId,
    result: form.result ? String(form.result) : null,
    status: rfi.status,
    createdAt: rfi.createdAt.toISOString(),
    source: form.source ? String(form.source) : null,
    final,
  };
}

function isFinalStatus(status: string, form: Record<string, unknown>): boolean {
  if (/awaiting/i.test(status)) return false;
  if (status === "Approved" && String(form.result || "").toUpperCase().startsWith("A")) return true;
  if (status === "Approved" && String(form.result || "").toUpperCase().startsWith("B")) return true;
  return false;
}

/** Due / raised / approved and the status to store on each weekly row. */
export async function refreshQapWeek(projectId: string, weekLabel?: string | null) {
  await ensureQapLines(projectId);
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { startDate: true } });
  const activities = await prisma.qapActivity.findMany({
    where: { projectId, ...(weekLabel ? { weekLabel } : {}) },
  });
  const lines = await prisma.qapLine.findMany({ where: { projectId } });
  const lineById = new Map(lines.map((l) => [l.id, l]));
  const rfis = await prisma.rfi.findMany({
    where: { projectId, rfiKind: "QualityIR", qapLineId: { not: null } },
    select: { id: true, qapLineId: true, previousIrId: true, formDataJson: true, status: true, createdAt: true, number: true, irNumber: true },
  });
  const byLine = new Map<string, typeof rfis>();
  for (const r of rfis) {
    if (!r.qapLineId) continue;
    const list = byLine.get(r.qapLineId) || [];
    list.push(r);
    byLine.set(r.qapLineId, list);
  }

  const weeks = new Map<string, { start: Date; end: Date; ended: boolean; qty: Awaited<ReturnType<typeof dprQuantities>> | null }>();
  async function qtyFor(label: string, section: string | null | undefined) {
    const range = weekRange(label, project?.startDate || null);
    const key = `${label}|${section || ""}`;
    if (!weeks.has(key)) {
      weeks.set(key, { ...range, qty: await dprQuantities(projectId, range.start, range.end, section) });
    }
    return weeks.get(key)!;
  }

  const summaries: Record<string, unknown>[] = [];
  for (const row of activities) {
    const line = row.qapLineId ? lineById.get(row.qapLineId) : undefined;
    const header = !!(line?.isHeader || row.isHeader);
    const all = (row.qapLineId && byLine.get(row.qapLineId)) || [];
    const range = await qtyFor(row.weekLabel, row.section);
    const inWeek = all.filter((r) => r.createdAt >= range.start && r.createdAt <= range.end);
    const use = inWeek.length ? inWeek : all.filter((r) => {
      const root = all.find((x) => x.id === r.previousIrId);
      return root ? root.createdAt >= range.start && root.createdAt <= range.end : false;
    });
    const relevant = inWeek.length ? all.filter((r) => use.some((u) => u.id === r.id || u.previousIrId === r.id || r.previousIrId === u.id)) : inWeek;
    const pool = relevant.length ? relevant : inWeek;
    const snaps = pool.map((r) => snapOf(r, isFinalStatus(r.status, formOf(r.formDataJson))));
    const freq = parseQapFrequency(line?.frequency || row.frequency);
    let openSources: number | null = null;
    if (freq.kind === "perSource" || freq.kind === "dueDate") {
      const approved = new Set(
        snaps.filter((s) => s.final && s.source).map((s) => String(s.source).trim().toLowerCase())
      );
      const known = new Set(snaps.map((s) => String(s.source || "").trim().toLowerCase()).filter(Boolean));
      openSources = known.size === 0 ? 1 : [...known].filter((s) => !approved.has(s)).length;
    }
    const quantity = freq.kind === "perQuantity" ? (freq.unit === "sqm" ? range.qty?.sqm : freq.unit === "nos" ? range.qty?.nos : range.qty?.cum) : 0;
    const due = header ? null : expectedIrCount(freq, { quantity: quantity || 0, pours: range.qty?.pours || 0, openSources });
    const chains = irChains(snaps);
    const status = header
      ? "Header"
      : qapLineStatus({ isHeader: false, due, weekEnded: range.ended, irs: snaps }) || "Not started";
    const latest = [...pool].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    const latestForm = formOf(latest?.formDataJson);
    const flags = signoffFlags(
      latest
        ? {
            verified: !!String(latestForm.verifiedBy || "").trim(),
            result: latestForm.result ? String(latestForm.result) : null,
            clientSigned: !!String(latestForm.witnessedBy || "").trim(),
          }
        : null
    );
    const result = latestForm.result ? String(latestForm.result).charAt(0).toUpperCase() : "";
    if (row.status !== status || row.contractorOk !== flags.contractorOk || row.pmcOk !== flags.pmcOk || row.clientOk !== flags.clientOk) {
      await prisma.qapActivity.update({
        where: { id: row.id },
        data: {
          status,
          contractorOk: flags.contractorOk,
          pmcOk: flags.pmcOk,
          clientOk: flags.clientOk,
          completedAt: status === "Completed" ? row.completedAt || new Date() : null,
        },
      });
    }
    const approved = chains.filter((c) => c[c.length - 1]?.final).length;
    summaries.push({
      activityId: row.id,
      qapLineId: row.qapLineId,
      isHeader: header,
      status,
      due,
      dueLabel: header ? "" : due == null ? frequencyLabel(freq) : String(due),
      raised: chains.length,
      approved,
      latestResult: result || "Pending",
      frequencyKind: freq.kind,
      irCount: pool.length,
      ...flags,
    });
  }
  return summaries;
}

export async function qpiForRange(projectId: string, start: Date, end: Date, weekLabel: string) {
  const [obs, ncrs] = await Promise.all([
    prisma.qualitySiteRecord.findMany({
      where: { projectId, occurredAt: { gte: start, lte: end } },
      select: { recordType: true, status: true, closedAt: true },
    }),
    prisma.qualityNcr.findMany({
      where: { projectId, issueDate: { gte: start, lte: end } },
      select: { status: true, actualClosure: true },
    }),
  ]);
  const rate = (rows: { closed: boolean }[]) => {
    if (!rows.length) return null;
    return Math.round((rows.filter((r) => r.closed).length / rows.length) * 1000) / 10;
  };
  const observationRate = rate(
    obs.filter((r) => /observation/i.test(r.recordType)).map((r) => ({ closed: !!(r.closedAt || /clos/i.test(r.status)) }))
  );
  const instructionRate = rate(
    obs.filter((r) => /instruction/i.test(r.recordType)).map((r) => ({ closed: !!(r.closedAt || /clos/i.test(r.status)) }))
  );
  const ncrRate = rate(ncrs.map((r) => ({ closed: !!(r.actualClosure || /clos/i.test(r.status)) })));
  const parts = [observationRate, instructionRate, ncrRate].filter((n): n is number => n != null);
  const qpi = parts.length ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 10) / 10 : null;
  const weekEnding = end.toISOString().slice(0, 10);
  if (end.getTime() < Date.now() || new Date().getDay() === 5) {
    await prisma.qualityQpiWeek.upsert({
      where: { projectId_weekEnding: { projectId, weekEnding } },
      create: { projectId, weekLabel, weekEnding, observationRate, instructionRate, ncrRate, qpi },
      update: { weekLabel, observationRate, instructionRate, ncrRate, qpi },
    });
  }
  return { weekLabel, weekEnding, observationRate, instructionRate, ncrRate, qpi };
}

export async function listQapLines(projectId: string, workPackage?: string | null) {
  await ensureQapLines(projectId);
  return prisma.qapLine.findMany({
    where: {
      projectId,
      ...(workPackage === undefined ? {} : { workPackage: workPackage || null }),
    },
    orderBy: { sortOrder: "asc" },
  });
}

export function prefillFromLine(line: {
  srNo?: string | null;
  section?: string | null;
  description?: string | null;
  codeOfConformance?: string | null;
  discipline?: string | null;
  pmcRole?: string | null;
  records?: string | null;
  isHeader?: boolean;
}) {
  return {
    activityDescription: [line.section, line.description].filter(Boolean).join(" - "),
    itpRef: line.srNo ? `QAP ${line.srNo}` : line.codeOfConformance || "",
    discipline: line.discipline || line.section || "",
    specClause: line.codeOfConformance || "",
    irType: irTypeForPmcRole(line.pmcRole),
    records: line.records || "",
    enclosuresRequired: requiredEnclosures(line.records),
  };
}
