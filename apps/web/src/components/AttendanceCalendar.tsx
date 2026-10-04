import { useCallback, useEffect, useMemo, useState } from "react";
import {
  attendanceSiteMinutes,
  formatAttendanceDuration,
  formatIstDateKey,
  formatIstPunchTime,
  istStartOfDay,
} from "@sharnam/shared";
import { api, apiBase } from "../api";
import { useAuth } from "../auth";
import { canManageHrms } from "../lib/portalAccounts";
import { formatPunchLine, mapsUrl } from "../lib/attendanceDisplay";
import { Badge, Button, Card, Input, Select } from "./ui";

type AttendanceRow = {
  id: string;
  userId: string;
  date: string;
  status: string;
  checkIn?: string | null;
  checkOut?: string | null;
  inLat?: number | null;
  inLng?: number | null;
  outLat?: number | null;
  outLng?: number | null;
  inAccuracy?: number | null;
  outAccuracy?: number | null;
  inSiteName?: string | null;
  outSiteName?: string | null;
  inGeofenceOk?: boolean;
  outGeofenceOk?: boolean;
  inPhotoUrl?: string | null;
  outPhotoUrl?: string | null;
  notes?: string | null;
  user?: { id: string; fullName: string; email?: string };
  project?: { code?: string; name?: string; location?: string | null } | null;
};

type StaffOpt = { id: string; fullName: string; role?: string };
type LeaveOverlay = {
  id: string;
  userId: string;
  fromDate: string;
  toDate: string;
  halfDay?: boolean;
  status: string;
  leaveType?: { name?: string; code?: string } | null;
};
type HolidayOverlay = { date: string; name: string; isOptional?: boolean };

function dayKeyOf(raw: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? raw.slice(0, 10) : formatIstDateKey(d);
}

/** Short "09:30" for the calendar cell — handles HH:MM strings and ISO timestamps. */
function cellTime(t?: string | null) {
  return t ? formatIstPunchTime(t).replace(/ IST$/, "") : "";
}

function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function photoSrc(url?: string | null, token?: string | null) {
  if (!url || url.startsWith("http")) return null;
  const full = url.startsWith("/") ? `${apiBase()}${url}` : url;
  if (url.includes("/attendance/") && url.includes("/photo/") && token) {
    return `${full}?token=${encodeURIComponent(token)}`;
  }
  return full;
}

function DetailBlock({ row, token }: { row: AttendanceRow; token?: string | null }) {
  const mins = attendanceSiteMinutes(row.checkIn, row.checkOut);
  const lineIn = formatPunchLine("in", row);
  const lineOut = formatPunchLine("out", row);

  return (
    <div className="attendance-cal__detail space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-ink">{row.user?.fullName || "Employee"}</span>
        <Badge tone={row.inGeofenceOk ? "ok" : "warn"}>{row.status}</Badge>
        {row.project?.code ? <span className="text-xs text-steel-muted">{row.project.code}</span> : null}
      </div>
      <div className="grid sm:grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg border border-line bg-sand/40 px-3 py-2">
          <div className="text-[10px] uppercase text-steel-muted">Time on site</div>
          <div className="font-semibold text-brand-dark text-base">{formatAttendanceDuration(mins)}</div>
        </div>
        <div className="rounded-lg border border-line bg-paper px-3 py-2">
          <div className="text-[10px] uppercase text-steel-muted">Check-in</div>
          <div className="font-mono">{formatIstPunchTime(row.checkIn)}</div>
        </div>
        <div className="rounded-lg border border-line bg-paper px-3 py-2">
          <div className="text-[10px] uppercase text-steel-muted">Check-out</div>
          <div className="font-mono">{formatIstPunchTime(row.checkOut)}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        {row.inPhotoUrl ? (
          <div>
            <p className="text-[10px] uppercase text-steel-muted mb-1">Check-in photo</p>
            <img src={photoSrc(row.inPhotoUrl, token) || ""} alt="Check-in" className="h-28 w-28 object-cover rounded-lg border border-line" />
          </div>
        ) : null}
        {row.outPhotoUrl ? (
          <div>
            <p className="text-[10px] uppercase text-steel-muted mb-1">Check-out photo</p>
            <img src={photoSrc(row.outPhotoUrl, token) || ""} alt="Check-out" className="h-28 w-28 object-cover rounded-lg border border-line" />
          </div>
        ) : null}
      </div>
      {[lineIn, lineOut].map(
        (line) =>
          line && (
            <div key={line.label} className="attendance-punch__log-row">
              <div className="attendance-punch__log-head">
                <span className="attendance-punch__log-label">{line.label}</span>
                <span className="attendance-punch__log-time">{line.time}</span>
              </div>
              <div className="attendance-punch__log-place">{line.place}</div>
              {line.lat != null && line.lng != null && (
                <div className="attendance-punch__log-geo">
                  <span className="font-mono">
                    {line.lat.toFixed(5)}, {line.lng.toFixed(5)}
                    {line.acc != null ? ` · ±${Math.round(line.acc)}m` : ""}
                  </span>
                  <a href={mapsUrl(line.lat, line.lng)} target="_blank" rel="noreferrer" className="attendance-punch__map-link">
                    Open map
                  </a>
                </div>
              )}
            </div>
          ),
      )}
      {row.notes ? <p className="text-xs text-steel-muted">{row.notes}</p> : null}
    </div>
  );
}

/** Month calendar of attendance — in/out times, duration, checkout GPS. */
export function AttendanceCalendar({
  compact = false,
  initialUserId = "",
}: {
  compact?: boolean;
  /** HR: open this team member's calendar directly. */
  initialUserId?: string;
}) {
  const { token, user } = useAuth();
  const canViewTeam = canManageHrms(user);
  const todayKey = formatIstDateKey(istStartOfDay());
  const [cursor, setCursor] = useState(() => {
    const t = istStartOfDay();
    return { year: t.getFullYear(), month: t.getMonth() + 1 };
  });
  const [userId, setUserId] = useState(initialUserId);
  const [leaves, setLeaves] = useState<LeaveOverlay[]>([]);
  const [holidays, setHolidays] = useState<HolidayOverlay[]>([]);

  useEffect(() => {
    setUserId(initialUserId);
  }, [initialUserId]);
  const [staff, setStaff] = useState<StaffOpt[]>([]);
  const [staffQuery, setStaffQuery] = useState("");
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(todayKey);
  const [loadErr, setLoadErr] = useState("");

  const range = useMemo(() => {
    const from = new Date(cursor.year, cursor.month - 1, 1);
    const to = new Date(cursor.year, cursor.month, 0);
    return { from: ymdLocal(from), to: ymdLocal(to) };
  }, [cursor]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoadErr("");
    try {
      const q = new URLSearchParams({ from: range.from, to: range.to });
      if (canViewTeam && userId) q.set("userId", userId);
      const res = await api<{ rows: AttendanceRow[] }>(`/api/hrm/attendance/range?${q}`, { token });
      setRows(res.rows || []);
    } catch (err) {
      setLoadErr(err instanceof Error ? err.message : "Could not load calendar");
      setRows([]);
    }
  }, [token, range.from, range.to, userId, canViewTeam]);

  useEffect(() => {
    void load();
  }, [load]);

  // Leave + holiday overlay: own calendar, or the selected team member for HR.
  useEffect(() => {
    if (!token) return;
    const leaveUrl = canViewTeam
      ? userId
        ? `/api/hrm/leave?all=1&userId=${encodeURIComponent(userId)}`
        : null
      : "/api/hrm/leave";
    if (leaveUrl) {
      void api<LeaveOverlay[]>(leaveUrl, { token })
        .then(setLeaves)
        .catch(() => setLeaves([]));
    } else {
      setLeaves([]);
    }
    void api<HolidayOverlay[]>(`/api/hrm/holidays?year=${cursor.year}`, { token })
      .then(setHolidays)
      .catch(() => setHolidays([]));
  }, [token, canViewTeam, userId, cursor.year]);

  const holidayByDate = useMemo(() => {
    const m = new Map<string, HolidayOverlay>();
    for (const h of holidays) m.set(dayKeyOf(h.date), h);
    return m;
  }, [holidays]);

  const leaveByDate = useMemo(() => {
    const m = new Map<string, LeaveOverlay>();
    for (const l of leaves) {
      if (l.status !== "Approved" && l.status !== "Pending") continue;
      const [fy, fm, fd] = dayKeyOf(l.fromDate).split("-").map(Number);
      const [ty, tm, td] = dayKeyOf(l.toDate).split("-").map(Number);
      const cur = new Date(fy, fm - 1, fd);
      const end = new Date(ty, tm - 1, td);
      for (let guard = 0; cur <= end && guard < 400; guard++) {
        const k = ymdLocal(cur);
        const prev = m.get(k);
        if (!prev || prev.status !== "Approved") m.set(k, l);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return m;
  }, [leaves]);

  useEffect(() => {
    if (!canViewTeam || !token) return;
    void api<StaffOpt[]>("/api/hrm/employees", { token })
      .then((list) => setStaff(list.map((e) => ({ id: e.id, fullName: e.fullName, role: e.role }))))
      .catch(() => setStaff([]));
  }, [token, canViewTeam]);

  const byDate = useMemo(() => {
    const map = new Map<string, AttendanceRow[]>();
    for (const r of rows) {
      const key = r.date.slice(0, 10);
      const list = map.get(key) || [];
      list.push(r);
      map.set(key, list);
    }
    return map;
  }, [rows]);

  const calendarCells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month - 1, 1);
    const last = new Date(cursor.year, cursor.month, 0);
    const startPad = (first.getDay() + 6) % 7;
    const cells: { date: string | null; day: number | null }[] = [];
    for (let i = 0; i < startPad; i++) cells.push({ date: null, day: null });
    for (let d = 1; d <= last.getDate(); d++) {
      const dt = new Date(cursor.year, cursor.month - 1, d);
      cells.push({ date: ymdLocal(dt), day: d });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, day: null });
    return cells;
  }, [cursor]);

  const selectedRows = selectedDate ? byDate.get(selectedDate) || [] : [];

  function shiftMonth(delta: number) {
    setCursor((c) => {
      let m = c.month + delta;
      let y = c.year;
      while (m < 1) {
        m += 12;
        y -= 1;
      }
      while (m > 12) {
        m -= 12;
        y += 1;
      }
      return { year: y, month: m };
    });
  }

  async function downloadRegister() {
    if (!token) return;
    const q = new URLSearchParams({ from: range.from, to: range.to });
    if (canViewTeam && userId) q.set("userId", userId);
    const res = await fetch(`${apiBase()}/api/hrm/attendance/register.xlsx?${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SPDC-Attendance-${range.from}-${range.to}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className={`attendance-cal ${compact ? "attendance-cal--compact" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-sm text-ink">Attendance calendar</h2>
          <p className="text-xs text-steel-muted mt-0.5">
            Clock-in/out, selfie, and GPS for each day. Download Excel for the blue monthly calendar and daily geo log (HR / office).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => shiftMonth(-1)} aria-label="Previous month">
            ←
          </Button>
          <span className="text-sm font-semibold min-w-[10rem] text-center">{monthLabel(cursor.year, cursor.month)}</span>
          <Button type="button" variant="secondary" onClick={() => shiftMonth(1)} aria-label="Next month">
            →
          </Button>
          <Button type="button" variant="secondary" onClick={() => void downloadRegister()}>
            Download month Excel
          </Button>
        </div>
      </div>

      {canViewTeam ? (
        <div className="flex flex-wrap gap-2 mb-3 max-w-xl">
          <Input value={staffQuery} onChange={(e) => setStaffQuery(e.target.value)} placeholder="Search employee" className="max-w-xs" />
          <label className="block text-xs font-semibold text-steel-muted min-w-[12rem] flex-1">
            Employee
            <Select className="mt-1" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">All staff (this month)</option>
              {staff.filter((s) => {
                const q = staffQuery.trim().toLowerCase();
                if (!q) return true;
                return `${s.fullName} ${s.role || ""}`.toLowerCase().includes(q);
              }).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}{s.role === "site_employee" ? " · Site" : ""}
                </option>
              ))}
            </Select>
          </label>
        </div>
      ) : null}

      {loadErr ? <p className="text-sm text-danger mb-3">{loadErr}</p> : null}

      <div className="attendance-cal__weekdays">
        {WEEKDAYS.map((w) => (
          <div key={w} className="attendance-cal__weekday">
            {w}
          </div>
        ))}
      </div>
      <div className="attendance-cal__grid">
        {calendarCells.map((cell, i) => {
          if (!cell.date) return <div key={`e-${i}`} className="attendance-cal__cell attendance-cal__cell--empty" />;
          const dayRows = byDate.get(cell.date) || [];
          const primary = dayRows[0];
          const mins = primary ? attendanceSiteMinutes(primary.checkIn, primary.checkOut) : null;
          const isToday = cell.date === todayKey;
          const isSelected = cell.date === selectedDate;
          const dow = new Date(cell.date + "T12:00:00").getDay();
          const weekend = dow === 0 || dow === 6;
          const holiday = holidayByDate.get(cell.date);
          const leave = !weekend && !(holiday && !holiday.isOptional) ? leaveByDate.get(cell.date) : undefined;
          return (
            <button
              key={cell.date}
              type="button"
              className={`attendance-cal__cell${dayRows.length ? " attendance-cal__cell--present" : ""}${isToday ? " attendance-cal__cell--today" : ""}${isSelected ? " attendance-cal__cell--selected" : ""}${weekend ? " attendance-cal__cell--weekend" : ""}${holiday ? " attendance-cal__cell--holiday" : ""}${leave ? (leave.status === "Approved" ? " attendance-cal__cell--leave" : " attendance-cal__cell--leave-pending") : ""}`}
              onClick={() => setSelectedDate(cell.date)}
            >
              <span className="attendance-cal__day-num">{cell.day}</span>
              {holiday ? <span className="attendance-cal__tag attendance-cal__tag--holiday">{holiday.name}</span> : null}
              {leave ? (
                <span className="attendance-cal__tag attendance-cal__tag--leave">
                  {leave.leaveType?.code || leave.leaveType?.name || "Leave"}
                  {leave.halfDay ? " ½" : ""}
                  {leave.status === "Pending" ? " · Pending" : ""}
                </span>
              ) : null}
              {primary?.checkIn ? (
                <span className="attendance-cal__times">
                  {cellTime(primary.checkIn)}
                  {primary.checkOut ? ` – ${cellTime(primary.checkOut)}` : ""}
                </span>
              ) : null}
              {mins != null ? <span className="attendance-cal__duration">{formatAttendanceDuration(mins)}</span> : null}
              {dayRows.length > 1 ? <span className="attendance-cal__multi">+{dayRows.length - 1}</span> : null}
            </button>
          );
        })}
      </div>

      {selectedDate ? (
        <div className="mt-4 pt-4 border-t border-line">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-steel-muted mb-2">
            {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </h3>
          {holidayByDate.get(selectedDate) ? (
            <p className="text-sm mb-2">
              <span className="attendance-cal__tag attendance-cal__tag--holiday">Holiday</span>{" "}
              {holidayByDate.get(selectedDate)!.name}
              {holidayByDate.get(selectedDate)!.isOptional ? " (Optional)" : ""}
            </p>
          ) : null}
          {leaveByDate.get(selectedDate) ? (
            <p className="text-sm mb-2">
              <span className="attendance-cal__tag attendance-cal__tag--leave">Leave</span>{" "}
              {leaveByDate.get(selectedDate)!.leaveType?.name || "Leave"} — {leaveByDate.get(selectedDate)!.status}
              {leaveByDate.get(selectedDate)!.halfDay ? " (Half Day)" : ""}
            </p>
          ) : null}
          {!selectedRows.length ? (
            <p className="text-sm text-steel-muted">No attendance record for this day.</p>
          ) : (
            selectedRows.map((r) => (
              <div key={r.id} className="mb-4 last:mb-0">
                <DetailBlock row={r} token={token} />
              </div>
            ))
          )}
        </div>
      ) : null}
    </Card>
  );
}
