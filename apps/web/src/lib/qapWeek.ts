/** Normalize QAP week labels — W50, Week 50, week 50 → canonical "Week 50". */
export function normalizeWeekLabel(label?: string | null): string {
  const raw = String(label || "").trim();
  if (!raw) return "";
  const m = raw.match(/(?:week\s*)?w?\s*(\d+)/i);
  if (m) return `Week ${parseInt(m[1], 10)}`;
  return raw;
}

export function weekMatchesFilter(rowWeek?: string | null, filter?: string | null): boolean {
  if (!filter) {
    const n = normalizeWeekLabel(rowWeek);
    return n === "Week 50" || /^w50$/i.test(String(rowWeek || "").trim());
  }
  if (rowWeek === filter) return true;
  return normalizeWeekLabel(rowWeek) === normalizeWeekLabel(filter);
}

export function preferWeekLabel(labels: string[]): string {
  const normalized = labels.map((l) => ({ raw: l, norm: normalizeWeekLabel(l) }));
  const w50 = normalized.find((x) => x.norm === "Week 50");
  if (w50) return w50.raw;
  return labels[0] || "Week 50";
}

type QapRowProbe = {
  weekLabel?: string | null;
  frequency?: string | null;
  description?: string | null;
  contractorPerformer?: string | null;
  codeOfConformance?: string | null;
  activity?: string | null;
  section?: string | null;
};

/** Detect partial/legacy QAP rows (activity-only lines without Week 50 detail columns). */
export function qapNeedsFullResync(rows: QapRowProbe[]): boolean {
  if (!rows.length) return true;
  const pool = rows.filter((r) => normalizeWeekLabel(r.weekLabel) === "Week 50");
  const set = pool.length ? pool : rows;
  if (set.length < 250) return true;
  const rich = set.filter((r) => r.frequency || r.contractorPerformer || r.codeOfConformance).length;
  if (rich / set.length < 0.35) return true;
  const legacy = set.filter((r) => !r.section && / — /.test(String(r.activity || ""))).length;
  return legacy / set.length > 0.25;
}
