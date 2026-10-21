import { useEffect, useState } from "react";
import { projectWeekNumber } from "@sharnam/shared";
import { api } from "../api";
import { Button } from "./ui";

/** Monday (yyyy-mm-dd) of the week holding `d`. */
export function mondayKey(d = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

export function addDaysKey(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The project's start date (Week 1 anchor) — loaded once per project. */
export function useProjectStart(projectId?: string, token?: string | null) {
  const [start, setStart] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!projectId) return;
    let live = true;
    void api<{ startDate?: string | null }>(`/api/projects/${projectId}`, { token })
      .then((p) => live && setStart(p?.startDate || null))
      .catch(() => undefined)
      .finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, [projectId, token]);
  return { start, loaded, setStart };
}

export type DrawingsWeekStart = {
  drawingsStartDate: string | null;
  projectStartDate: string | null;
  effectiveStart: string | null;
};

/** Drawings Week 1 anchor: the Drawing Settings start date, else the project start date. */
export function useDrawingsStart(projectId?: string, token?: string | null) {
  const [value, setValue] = useState<DrawingsWeekStart>({ drawingsStartDate: null, projectStartDate: null, effectiveStart: null });
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!projectId) return;
    let live = true;
    void api<DrawingsWeekStart>(`/api/drawings/project/${projectId}/settings`, { token })
      .then((out) => {
        if (!live || !out) return;
        setValue({
          drawingsStartDate: out.drawingsStartDate || null,
          projectStartDate: out.projectStartDate || null,
          effectiveStart: out.effectiveStart || null,
        });
      })
      .catch(() => undefined)
      .finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, [projectId, token, tick]);
  return { ...value, loaded, reload: () => setTick((t) => t + 1), setValue };
}

const fmt = (key: string, year = false) =>
  new Date(`${key}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", ...(year ? { year: "numeric" } : {}) });

/**
 * One week picker for every project dashboard: ← Previous · Week N (dd Mon - dd Mon yyyy) · date · Next → · This week.
 * Week numbers count from the project start (Week 1 = the week holding it, earlier = Week 0, "-" until it is set).
 * With minWeekStart, nothing before that week can be picked (Previous is disabled there and the date input is clamped).
 */
export function ProjectWeekPicker({
  weekStart,
  onChange,
  projectStart,
  allowFuture = false,
  minWeekStart,
  extra,
}: {
  weekStart: string;
  onChange: (mondayKey: string) => void;
  projectStart?: string | null;
  allowFuture?: boolean;
  /** Earliest selectable week (any date in it); only the drawings dashboard passes this. */
  minWeekStart?: string | null;
  extra?: React.ReactNode;
}) {
  const n = projectWeekNumber(weekStart, projectStart);
  const thisWeek = mondayKey();
  const atLatest = !allowFuture && weekStart >= thisWeek;
  const minWeek = minWeekStart ? mondayKey(new Date(`${minWeekStart.slice(0, 10)}T00:00:00`)) : null;
  const atEarliest = minWeek != null && weekStart <= minWeek;
  const go = (key: string) => onChange(minWeek && key < minWeek ? minWeek : key);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Button type="button" variant="secondary" className="!text-xs !py-1.5" disabled={atEarliest} onClick={() => go(addDaysKey(weekStart, -7))}>
        ← Previous week
      </Button>
      <div className="rounded-lg border border-line bg-white px-3 py-1 text-center min-w-[11rem]">
        <div className="text-sm font-semibold text-ink">Week {n ?? "-"}</div>
        <div className="text-[11px] text-steel-muted">
          {fmt(weekStart)} – {fmt(addDaysKey(weekStart, 6), true)}
        </div>
      </div>
      <label className="text-xs text-steel-muted">
        Week of
        <input
          type="date"
          className="mt-1 block rounded-lg border border-line bg-white px-2 py-1 text-sm text-ink"
          value={weekStart}
          min={minWeek ?? undefined}
          onChange={(e) => e.target.value && go(mondayKey(new Date(`${e.target.value}T00:00:00`)))}
        />
      </label>
      <Button type="button" variant="secondary" className="!text-xs !py-1.5" disabled={atLatest} onClick={() => go(addDaysKey(weekStart, 7))}>
        Next week →
      </Button>
      {weekStart !== thisWeek ? (
        <Button type="button" variant="ghost" className="!text-xs !py-1.5" onClick={() => go(thisWeek)}>
          This week
        </Button>
      ) : null}
      {extra}
    </div>
  );
}
