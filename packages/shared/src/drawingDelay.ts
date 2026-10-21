/**
 * Drawing register date rules shared by web and api: submission delay, IST calendar days,
 * drawings week numbering and the dd Mon yyyy label.
 * All day maths runs on IST (Asia/Kolkata, UTC+05:30, no DST) calendar dates so client and server agree.
 */

const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;
const DAY_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type DayInput = Date | string | null | undefined;

/** Calendar date (yyyy-mm-dd) in IST. A plain yyyy-mm-dd string is taken as already being that day. */
export function istDayKey(value: DayInput): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    const s = value.trim();
    if (DAY_KEY_RE.test(s)) return s;
    value = new Date(s);
  }
  const t = value.getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Today's IST calendar date (yyyy-mm-dd). */
export function istTodayKey(now: Date = new Date()): string {
  return istDayKey(now) as string;
}

function dayIndex(key: string): number {
  const m = DAY_KEY_RE.exec(key);
  if (!m) return Number.NaN;
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS);
}

/** Whole calendar days from `from` to `to` in IST (negative when `to` is earlier). Null if either is missing. */
export function istDaysBetween(from: DayInput, to: DayInput): number | null {
  const a = istDayKey(from);
  const b = istDayKey(to);
  if (!a || !b) return null;
  const n = dayIndex(b) - dayIndex(a);
  return Number.isFinite(n) ? n : null;
}

/** Add days to a yyyy-mm-dd key. */
export function addDayKey(key: string, days: number): string {
  const i = dayIndex(key);
  if (!Number.isFinite(i)) return key;
  return new Date((i + days) * DAY_MS).toISOString().slice(0, 10);
}

/** Monday (yyyy-mm-dd) of the IST week holding the date. */
export function mondayDayKey(value: DayInput): string | null {
  const key = istDayKey(value);
  if (!key) return null;
  const dow = new Date(dayIndex(key) * DAY_MS).getUTCDay() || 7;
  return addDayKey(key, 1 - dow);
}

/**
 * Submission delay in days.
 * - planned missing: null
 * - actual present: max(0, actual - planned); early submissions count as 0
 * - actual missing and today is after planned: today - planned (running)
 * - otherwise: 0
 */
export function delayDays(planned: DayInput, actual: DayInput, today: DayInput = new Date()): number | null {
  if (!istDayKey(planned)) return null;
  if (istDayKey(actual)) return Math.max(0, istDaysBetween(planned, actual) ?? 0);
  const running = istDaysBetween(planned, today) ?? 0;
  return running > 0 ? running : 0;
}

/** True when the drawing is not submitted yet and the planned date has passed (the delay keeps counting). */
export function delayIsRunning(planned: DayInput, actual: DayInput, today: DayInput = new Date()): boolean {
  if (!istDayKey(planned) || istDayKey(actual)) return false;
  return (istDaysBetween(planned, today) ?? 0) > 0;
}

/** "01 Oct 2026" (en-GB order, fixed English month names). Empty string when the date is missing. */
export function formatDayMonYear(value: DayInput): string {
  const key = istDayKey(value);
  if (!key) return "";
  const [y, m, d] = key.split("-");
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

/** "01 Oct" without the year. */
export function formatDayMon(value: DayInput): string {
  const key = istDayKey(value);
  if (!key) return "";
  const [, m, d] = key.split("-");
  return `${d} ${MONTHS[Number(m) - 1]}`;
}

/** Drawings week start: the Drawing Settings date when set, else the project start date, else null. */
export function effectiveDrawingsStart(drawingsStartDate: DayInput, projectStartDate: DayInput): string | null {
  return istDayKey(drawingsStartDate) || istDayKey(projectStartDate);
}

/**
 * Drawings week number: Week 1 is the Monday to Sunday week holding the start date.
 * Null when there is no start or the date falls before Week 1 (there is no Week 0 on the drawings register).
 */
export function drawingsWeekNumber(date: DayInput, start: DayInput): number | null {
  const d = mondayDayKey(date);
  const s = mondayDayKey(start);
  if (!d || !s) return null;
  const diff = Math.round((dayIndex(d) - dayIndex(s)) / 7);
  return diff < 0 ? null : diff + 1;
}
