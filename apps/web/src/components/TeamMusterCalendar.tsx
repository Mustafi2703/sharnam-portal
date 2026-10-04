import { useCallback, useEffect, useMemo, useState } from "react";
import { formatIstDateKey, istStartOfDay } from "@sharnam/shared";
import { api } from "../api";
import { useAuth } from "../auth";
import { Button, Card, Input } from "./ui";
import { StatusNote } from "./StatusNote";

/**
 * Team muster roll — every SPDC staff member × every day of the month.
 * P present · L approved leave · L? pending leave · H holiday · WO weekend · A absent (past working day).
 */

type Staff = { id: string; fullName: string; role?: string; profile?: { empCode?: string; department?: string } | null };
type AttRow = { userId: string; date: string; checkIn?: string | null; checkOut?: string | null };
type LeaveRow = {
  id: string;
  userId: string;
  fromDate: string;
  toDate: string;
  halfDay?: boolean;
  status: string;
  leaveType?: { name?: string; code?: string } | null;
};
type Holiday = { date: string; name: string; isOptional?: boolean };

export type MusterCode = "P" | "L" | "LP" | "H" | "WO" | "A" | "HD" | "";

const CODE_LABEL: Record<Exclude<MusterCode, "">, string> = {
  P: "Present",
  L: "Leave (approved)",
  LP: "Leave (pending)",
  H: "Holiday",
  WO: "Week off",
  A: "Absent",
  HD: "Half day leave",
};

const CODE_SHORT: Record<Exclude<MusterCode, "">, string> = {
  P: "P",
  L: "L",
  LP: "L?",
  H: "H",
  WO: "WO",
  A: "A",
  HD: "½",
};

function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function istKey(raw: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? raw.slice(0, 10) : formatIstDateKey(d);
}

/** Expand a leave request into the day keys it covers. */
function leaveDayKeys(l: LeaveRow): string[] {
  const from = istKey(l.fromDate);
  const to = istKey(l.toDate);
  const out: string[] = [];
  const [fy, fm, fd] = from.split("-").map(Number);
  const cur = new Date(fy, fm - 1, fd);
  const [ty, tm, td] = to.split("-").map(Number);
  const end = new Date(ty, tm - 1, td);
  let guard = 0;
  while (cur <= end && guard < 400) {
    out.push(ymd(cur.getFullYear(), cur.getMonth() + 1, cur.getDate()));
    cur.setDate(cur.getDate() + 1);
    guard += 1;
  }
  return out;
}

export function TeamMusterCalendar({ onOpenMember }: { onOpenMember?: (userId: string) => void }) {
  const { token } = useAuth();
  const todayKey = formatIstDateKey(istStartOfDay());
  const [cursor, setCursor] = useState(() => {
    const t = istStartOfDay();
    return { year: t.getFullYear(), month: t.getMonth() + 1 };
  });
  const [staff, setStaff] = useState<Staff[]>([]);
  const [att, setAtt] = useState<AttRow[]>([]);
  const [leave, setLeave] = useState<LeaveRow[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const daysInMonth = new Date(cursor.year, cursor.month, 0).getDate();
  const from = ymd(cursor.year, cursor.month, 1);
  const to = ymd(cursor.year, cursor.month, daysInMonth);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr("");
    try {
      const [emps, range, lv, hol] = await Promise.all([
        api<Staff[]>("/api/hrm/employees", { token }),
        api<{ rows: AttRow[] }>(`/api/hrm/attendance/range?${new URLSearchParams({ from, to })}`, { token }),
        api<LeaveRow[]>("/api/hrm/leave?all=1", { token }),
        api<Holiday[]>(`/api/hrm/holidays?year=${cursor.year}`, { token }),
      ]);
      setStaff(emps);
      setAtt(range.rows || []);
      setLeave(lv);
      setHolidays(hol);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load the team calendar");
    } finally {
      setLoading(false);
    }
  }, [token, from, to, cursor.year]);

  useEffect(() => {
    void load();
  }, [load]);

  const holidayByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const h of holidays) if (!h.isOptional) m.set(istKey(h.date), h.name);
    return m;
  }, [holidays]);

  const presentKeys = useMemo(() => {
    const s = new Set<string>();
    for (const r of att) if (r.checkIn) s.add(`${r.userId}|${istKey(r.date)}`);
    return s;
  }, [att]);

  const leaveByKey = useMemo(() => {
    const m = new Map<string, LeaveRow>();
    for (const l of leave) {
      if (l.status !== "Approved" && l.status !== "Pending") continue;
      for (const k of leaveDayKeys(l)) {
        if (k < from || k > to) continue;
        const prev = m.get(`${l.userId}|${k}`);
        if (!prev || prev.status !== "Approved") m.set(`${l.userId}|${k}`, l);
      }
    }
    return m;
  }, [leave, from, to]);

  const days = useMemo(
    () =>
      Array.from({ length: daysInMonth }, (_, i) => {
        const d = i + 1;
        const key = ymd(cursor.year, cursor.month, d);
        const dow = new Date(cursor.year, cursor.month - 1, d).getDay();
        return { d, key, dow, weekend: dow === 0 || dow === 6, holiday: holidayByKey.get(key) };
      }),
    [daysInMonth, cursor, holidayByKey],
  );

  function codeFor(userId: string, day: (typeof days)[number]): { code: MusterCode; title: string } {
    const k = `${userId}|${day.key}`;
    if (presentKeys.has(k)) return { code: "P", title: "Present" };
    const lv = leaveByKey.get(k);
    if (lv && !day.weekend && !day.holiday) {
      const type = lv.leaveType?.name || lv.leaveType?.code || "Leave";
      if (lv.status === "Pending") return { code: "LP", title: `${type} — pending approval` };
      return { code: lv.halfDay ? "HD" : "L", title: `${type}${lv.halfDay ? " (half day)" : ""}` };
    }
    if (day.holiday) return { code: "H", title: day.holiday };
    if (day.weekend) return { code: "WO", title: "Week off" };
    if (day.key < todayKey) return { code: "A", title: "No check-in and no leave" };
    return { code: "", title: "" };
  }

  const visibleStaff = useMemo(() => {
    const q = query.trim().toLowerCase();
    return staff.filter((s) =>
      !q ? true : `${s.fullName} ${s.profile?.empCode || ""} ${s.profile?.department || ""}`.toLowerCase().includes(q),
    );
  }, [staff, query]);

  const rows = visibleStaff.map((s) => {
    const cells = days.map((day) => codeFor(s.id, day));
    const count = (c: MusterCode) => cells.filter((x) => x.code === c).length;
    return {
      s,
      cells,
      totals: {
        P: count("P"),
        L: count("L") + count("HD") * 0.5,
        LP: count("LP"),
        A: count("A"),
      },
    };
  });

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(c.year, c.month - 1 + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });
  }

  const monthTitle = new Date(cursor.year, cursor.month - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return (
    <Card className="muster" padding={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-line">
        <div>
          <h2 className="font-semibold text-ink">Team attendance &amp; leave calendar</h2>
          <p className="text-xs text-steel-muted mt-0.5">
            Every SPDC team member for the month. Select a name to open their personal calendar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, emp code, department"
            className="!w-60"
            aria-label="Search team member"
          />
          <Button type="button" variant="secondary" onClick={() => shiftMonth(-1)} aria-label="Previous month">
            ←
          </Button>
          <span className="text-sm font-semibold min-w-[9rem] text-center">{monthTitle}</span>
          <Button type="button" variant="secondary" onClick={() => shiftMonth(1)} aria-label="Next month">
            →
          </Button>
        </div>
      </div>

      <div className="px-4 sm:px-5 py-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-steel-muted border-b border-line bg-sand/40">
        {(["P", "L", "LP", "HD", "H", "WO", "A"] as const).map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5">
            <span className={`muster__chip muster__chip--${c}`}>{CODE_SHORT[c]}</span>
            {CODE_LABEL[c]}
          </span>
        ))}
      </div>

      {err ? <StatusNote msg={err} tone="danger" className="m-4" /> : null}

      <div className="muster__scroll">
        <table className="muster__table">
          <thead>
            <tr>
              <th className="muster__name-col">Team member</th>
              {days.map((day) => (
                <th
                  key={day.key}
                  className={`muster__day-head${day.weekend ? " is-weekend" : ""}${day.holiday ? " is-holiday" : ""}${
                    day.key === todayKey ? " is-today" : ""
                  }`}
                  title={day.holiday || undefined}
                >
                  <span className="block text-[10px] font-normal opacity-70">
                    {"SMTWTFS"[day.dow]}
                  </span>
                  {day.d}
                </th>
              ))}
              <th className="muster__total-head" title="Present days">P</th>
              <th className="muster__total-head" title="Leave days (approved)">L</th>
              <th className="muster__total-head" title="Absent working days">A</th>
            </tr>
          </thead>
          <tbody>
            {loading && !rows.length ? (
              <tr>
                <td colSpan={days.length + 4} className="px-4 py-8 text-center text-sm text-steel-muted">
                  Loading team calendar…
                </td>
              </tr>
            ) : null}
            {!loading && !rows.length ? (
              <tr>
                <td colSpan={days.length + 4} className="px-4 py-8 text-center text-sm text-steel-muted">
                  No team members match.
                </td>
              </tr>
            ) : null}
            {rows.map(({ s, cells, totals }) => (
              <tr key={s.id}>
                <th scope="row" className="muster__name-col">
                  {onOpenMember ? (
                    <button type="button" className="muster__name-btn" onClick={() => onOpenMember(s.id)}>
                      {s.fullName}
                    </button>
                  ) : (
                    <span className="muster__name-btn">{s.fullName}</span>
                  )}
                  <span className="muster__name-sub">
                    {[s.profile?.empCode, s.profile?.department].filter(Boolean).join(" · ") || s.role?.replace("_", " ")}
                  </span>
                </th>
                {cells.map((c, i) => (
                  <td
                    key={days[i].key}
                    className={`muster__cell${days[i].key === todayKey ? " is-today" : ""}`}
                    title={`${s.fullName} · ${days[i].key}${c.title ? ` — ${c.title}` : ""}`}
                  >
                    {c.code ? <span className={`muster__chip muster__chip--${c.code}`}>{CODE_SHORT[c.code]}</span> : null}
                  </td>
                ))}
                <td className="muster__total">{totals.P}</td>
                <td className="muster__total">
                  {totals.L}
                  {totals.LP ? <span className="muster__pending" title="Pending leave days">+{totals.LP}?</span> : null}
                </td>
                <td className={`muster__total${totals.A ? " is-absent" : ""}`}>{totals.A}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
