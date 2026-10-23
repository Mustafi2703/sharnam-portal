/** Shown under the physical progress figure on Progress, Cost, DPR and WPR. */
export const PHYSICAL_PROGRESS_METHOD =
  "Cost-weighted achieved vs GFC, from BOQ monitoring";

/** Confirm with SPDC. Severity is probability x consequence, 1 to 25. */
export const RISK_RATING_BANDS = { highMin: 15, mediumMin: 8 } as const;

/** 1-5 scale, stored as a fraction so the register can show percent. */
const PROBABILITY_PCT = [0, 0.1, 0.3, 0.5, 0.7, 0.9];

export type MilestoneStatus =
  | "Not Started"
  | "Late Start"
  | "In Progress"
  | "Delayed"
  | "Completed"
  | "Completed Late";

export type MilestoneInput = {
  plannedStart: Date | null;
  plannedEnd: Date | null;
  actualStart: Date | null;
  actualEnd: Date | null;
  /** Fraction 0-1, or a percent above 1. */
  pctComplete?: number | null;
  daysPerWeek?: number;
  today?: Date;
  projectStart?: Date | null;
};

export type MilestoneDerived = {
  plannedDays: number;
  actualDays: number;
  varianceDays: number;
  aheadDays: number;
  status: MilestoneStatus;
  pctComplete: number;
};

function dayUtc(d: Date): number {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

function asDate(v: Date | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Dates before 1990 (the 1900 template) are not usable durations. */
export function usableProjectDate(v: Date | null | undefined): Date | null {
  const d = asDate(v);
  if (!d || d.getFullYear() < 1990) return null;
  return d;
}

export function asFraction(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n > 1) return Math.min(1, n / 100);
  return n;
}

/** Inclusive working days. 6-day week skips Sunday. 5-day week skips Saturday and Sunday. */
export function workingDaysBetween(start: Date, end: Date, daysPerWeek = 6): number {
  const a = dayUtc(start);
  const b = dayUtc(end);
  if (b < a) return 0;
  const off = new Set<number>();
  if (daysPerWeek <= 5) {
    off.add(0);
    off.add(6);
  } else if (daysPerWeek < 7) {
    off.add(0);
  }
  let count = 0;
  for (let t = a; t <= b; t += 86400000) {
    if (!off.has(new Date(t).getUTCDay())) count += 1;
  }
  return count;
}

function calendarDays(from: Date, to: Date): number {
  return Math.round((dayUtc(to) - dayUtc(from)) / 86400000);
}

export function milestoneDateError(input: MilestoneInput): string | null {
  const plannedStart = asDate(input.plannedStart);
  const plannedEnd = asDate(input.plannedEnd);
  const actualStart = asDate(input.actualStart);
  const actualEnd = asDate(input.actualEnd);
  const projectStart = asDate(input.projectStart);
  const cutoff = projectStart
    ? new Date(projectStart.getFullYear() - 1, projectStart.getMonth(), projectStart.getDate())
    : new Date(1990, 0, 1);
  for (const d of [plannedStart, plannedEnd, actualStart, actualEnd]) {
    if (d && d < cutoff) return "Date is before the project start minus 1 year.";
  }
  if (plannedStart && plannedEnd && dayUtc(plannedEnd) < dayUtc(plannedStart)) {
    return "Planned end is before planned start.";
  }
  if (actualStart && actualEnd && dayUtc(actualEnd) < dayUtc(actualStart)) {
    return "Actual end is before actual start.";
  }
  return null;
}

export function deriveMilestone(input: MilestoneInput): MilestoneDerived {
  const week = input.daysPerWeek && input.daysPerWeek >= 5 && input.daysPerWeek <= 7 ? input.daysPerWeek : 6;
  const today = usableProjectDate(input.today) || new Date();
  const plannedStart = usableProjectDate(input.plannedStart);
  const plannedEnd = usableProjectDate(input.plannedEnd);
  const actualStart = usableProjectDate(input.actualStart);
  const actualEnd = usableProjectDate(input.actualEnd);

  const plannedDays = plannedStart && plannedEnd ? workingDaysBetween(plannedStart, plannedEnd, week) : 0;
  const actualDays = actualStart
    ? workingDaysBetween(actualStart, actualEnd || today, week)
    : 0;

  const endMark = actualEnd || (actualStart ? today : null);
  let varianceDays = 0;
  let aheadDays = 0;
  if (plannedEnd && endMark) {
    const diff = calendarDays(plannedEnd, endMark);
    if (diff > 0) varianceDays = diff;
    else if (diff < 0) aheadDays = -diff;
  }

  let status: MilestoneStatus = "Not Started";
  if (actualEnd) {
    status = plannedEnd && dayUtc(actualEnd) > dayUtc(plannedEnd) ? "Completed Late" : "Completed";
  } else if (actualStart) {
    status = plannedEnd && dayUtc(today) > dayUtc(plannedEnd) ? "Delayed" : "In Progress";
  } else if (plannedStart && dayUtc(plannedStart) < dayUtc(today)) {
    status = "Late Start";
  }

  const completed = status === "Completed" || status === "Completed Late";
  const pctComplete = completed ? 1 : Math.min(0.99, asFraction(input.pctComplete));

  return { plannedDays, actualDays, varianceDays, aheadDays, status, pctComplete };
}

export function riskSeverity(probability: number, consequence: number): number {
  const p = Math.min(5, Math.max(1, Math.round(Number(probability) || 1)));
  const c = Math.min(5, Math.max(1, Math.round(Number(consequence) || 1)));
  return p * c;
}

export function riskRating(severity: number): "High" | "Medium" | "Low" {
  if (severity >= RISK_RATING_BANDS.highMin) return "High";
  if (severity >= RISK_RATING_BANDS.mediumMin) return "Medium";
  return "Low";
}

export function defaultProbabilityPct(probability: number): number {
  const i = Math.min(5, Math.max(1, Math.round(Number(probability) || 1)));
  return PROBABILITY_PCT[i] ?? 0.1;
}

export function calendarSpanDays(from: Date | null, to: Date | null, today = new Date()): number {
  const start = usableProjectDate(from);
  if (!start) return 0;
  const end = usableProjectDate(to) || today;
  return Math.max(0, calendarDays(start, end));
}

export function hindranceStatus(resolvedAt: Date | null): "Open" | "Closed" {
  return usableProjectDate(resolvedAt) ? "Closed" : "Open";
}

export function correspondenceWarning(correspondence: string | null | undefined, occurredAt: Date | null): string | null {
  const occurred = usableProjectDate(occurredAt);
  if (!occurred || !correspondence) return null;
  const match = String(correspondence).match(/\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/);
  if (!match) return null;
  const parsed = new Date(match[0]);
  if (Number.isNaN(parsed.getTime())) return null;
  if (dayUtc(parsed) < dayUtc(occurred)) return "Correspondence date is before the occurrence date.";
  return null;
}

export function legalDelayDays(requiredBy: Date | null, received: Date | null, today = new Date()): number {
  const due = usableProjectDate(requiredBy);
  if (!due) return 0;
  const end = usableProjectDate(received) || today;
  return Math.max(0, calendarDays(due, end));
}

export function legalStatus(received: Date | null, current?: string | null): string {
  if (usableProjectDate(received)) return "Approved";
  if (!current || /approved/i.test(current)) return "Submitted";
  return current;
}
