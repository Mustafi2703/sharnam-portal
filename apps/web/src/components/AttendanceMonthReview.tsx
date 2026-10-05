import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { downloadAuthFile } from "../lib/downloadReport";
import { Badge, Button, Card, Input, Select } from "./ui";

type Line = {
  id: string;
  userId: string;
  employee: string;
  empCode: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  hours: number | null;
  site: string;
  inDistanceM: number | null;
  outDistanceM: number | null;
  inMap: string | null;
  outMap: string | null;
  reviewStatus: string;
  reviewNote: string | null;
  hasSelfie: boolean;
};
type Total = { userId: string; employee: string; empCode: string; days: number; hours: number; needsReview: number; rejected: number };

const tone = (s: string) => (s === "Auto-verified" || s === "Verified" ? "ok" : s === "Rejected" ? "danger" : "warn");

/**
 * HR / office: every punch of the month with time, site, distance from the site pin and verification.
 * Verify or reject the location any time, delete wrong clock-ins / clock-outs; hours roll up for payslips.
 */
export function AttendanceMonthReview() {
  const { token } = useAuth();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [lines, setLines] = useState<Line[]>([]);
  const [totals, setTotals] = useState<Total[]>([]);
  const [filter, setFilter] = useState<"all" | "review" | "rejected">("review");
  const [person, setPerson] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const out = await api<{ lines: Line[]; totals: Total[] }>(`/api/hrm/attendance/month-log?month=${month}`, { token });
      setLines(out.lines);
      setTotals(out.totals);
    } catch (err) {
      setMsg({ tone: "err", text: err instanceof Error ? err.message : "Could not load the month log" });
    } finally {
      setLoading(false);
    }
  }, [month, token]);
  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(
    () =>
      lines
        .filter((l) => (filter === "review" ? l.reviewStatus === "Needs review" : filter === "rejected" ? l.reviewStatus === "Rejected" : true))
        .filter((l) => !person || l.userId === person)
        .sort((a, b) => (a.date === b.date ? a.employee.localeCompare(b.employee) : b.date.localeCompare(a.date))),
    [lines, filter, person],
  );

  async function run(id: string, key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(`${id}:${key}`);
    setMsg(null);
    try {
      await fn();
      setMsg({ tone: "ok", text: ok });
      await load();
    } catch (err) {
      setMsg({ tone: "err", text: err instanceof Error ? err.message : "Action failed" });
    } finally {
      setBusy("");
    }
  }
  const review = (l: Line, status: string) =>
    run(l.id, status, () => api(`/api/hrm/attendance/${l.id}/review`, { method: "PATCH", token, body: JSON.stringify({ status }) }), `${l.employee} · ${l.date} marked ${status}.`);
  const remove = (l: Line, part: "out" | "all") => {
    const what = part === "out" ? "the clock-out" : "the clock-in and clock-out";
    if (!window.confirm(`Delete ${what} of ${l.employee} on ${l.date}? This cannot be undone.`)) return;
    void run(l.id, `del-${part}`, () => api(`/api/hrm/attendance/${l.id}?part=${part}`, { method: "DELETE", token }), `Deleted ${what} of ${l.employee} on ${l.date}.`);
  };

  const needsReview = lines.filter((l) => l.reviewStatus === "Needs review").length;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-semibold">Review And Hours</h3>
            <p className="text-[11px] text-steel-muted max-w-2xl">
              Punches inside the site radius are auto-verified. Sites without a map pin, or punches outside the radius, wait here for HR to check the map and verify or reject. Rejected days are left out of the hours used for payslips. Selfies are kept for one day only.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Input label="Month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            <Button
              type="button"
              variant="secondary"
              onClick={() => void downloadAuthFile(`/api/hrm/attendance/month-log.xlsx?month=${month}`, token, `SPDC-Attendance-${month}.xlsx`).catch((e) => setMsg({ tone: "err", text: e.message }))}
            >
              Month log (Excel)
            </Button>
          </div>
        </div>
        {msg ? (
          <p role={msg.tone === "err" ? "alert" : "status"} className={`mt-3 text-xs rounded-md px-3 py-2 ${msg.tone === "err" ? "bg-red-50 text-red-800 border border-red-200" : "bg-sand/50 border border-line"}`}>
            {msg.text}
          </p>
        ) : null}
      </Card>

      <Card padding={false}>
        <div className="px-4 py-3 border-b border-line bg-sand/40 font-semibold text-sm">Hours For Payslips · {month}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[640px]">
            <thead className="text-left text-steel-muted">
              <tr>
                <th className="p-2">Employee</th>
                <th>Emp code</th>
                <th className="text-right">Days present</th>
                <th className="text-right">Hours</th>
                <th className="text-right">Needs review</th>
                <th className="text-right pr-3">Rejected</th>
              </tr>
            </thead>
            <tbody>
              {totals.map((t) => (
                <tr key={t.userId} className="border-t border-line">
                  <td className="p-2">
                    <button type="button" className="text-brand font-semibold cursor-pointer" onClick={() => { setPerson(t.userId); setFilter("all"); }}>
                      {t.employee}
                    </button>
                  </td>
                  <td>{t.empCode || "—"}</td>
                  <td className="text-right">{t.days}</td>
                  <td className="text-right font-semibold">{t.hours.toFixed(2)}</td>
                  <td className="text-right">{t.needsReview ? <Badge tone="warn">{t.needsReview}</Badge> : "0"}</td>
                  <td className="text-right pr-3">{t.rejected}</td>
                </tr>
              ))}
              {!totals.length && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-steel-muted">
                    {loading ? "Loading…" : "No punches this month."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card padding={false}>
        <div className="px-4 py-3 border-b border-line bg-sand/40 flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-sm">Daily Punches</span>
          <span className="flex flex-wrap items-center gap-2 text-xs">
            <Select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="!py-1 !w-auto">
              <option value="review">Needs review ({needsReview})</option>
              <option value="rejected">Rejected</option>
              <option value="all">All punches</option>
            </Select>
            <Select value={person} onChange={(e) => setPerson(e.target.value)} className="!py-1 !w-auto">
              <option value="">Everyone</option>
              {totals.map((t) => (
                <option key={t.userId} value={t.userId}>
                  {t.employee}
                </option>
              ))}
            </Select>
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[1100px]">
            <thead className="text-left text-steel-muted">
              <tr>
                <th className="p-2">Date</th>
                <th>Employee</th>
                <th>Site</th>
                <th>In</th>
                <th>Out</th>
                <th className="text-right">Hours</th>
                <th>Location</th>
                <th>Verification</th>
                <th className="pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((l) => {
                const b = (k: string) => busy === `${l.id}:${k}`;
                return (
                  <tr key={l.id} className="border-t border-line align-top">
                    <td className="p-2 whitespace-nowrap">{l.date}</td>
                    <td>
                      {l.employee}
                      <div className="text-[10px] text-steel-muted">{l.empCode}</div>
                    </td>
                    <td>{l.site}</td>
                    <td>{l.checkIn || "—"}</td>
                    <td>{l.checkOut || "—"}</td>
                    <td className="text-right">{l.hours != null ? l.hours.toFixed(2) : "—"}</td>
                    <td className="whitespace-nowrap">
                      {l.inMap ? (
                        <a className="text-brand" href={l.inMap} target="_blank" rel="noreferrer">
                          In map{l.inDistanceM != null ? ` · ${l.inDistanceM} m` : ""}
                        </a>
                      ) : (
                        "No GPS"
                      )}
                      {l.outMap ? (
                        <a className="text-brand block" href={l.outMap} target="_blank" rel="noreferrer">
                          Out map{l.outDistanceM != null ? ` · ${l.outDistanceM} m` : ""}
                        </a>
                      ) : null}
                      {l.hasSelfie ? (
                        <a className="text-brand block" href={`/api/hrm/attendance/${l.id}/photo/in?token=${encodeURIComponent(token || "")}`} target="_blank" rel="noreferrer">
                          Selfie (24 h)
                        </a>
                      ) : null}
                    </td>
                    <td>
                      <Badge tone={tone(l.reviewStatus)}>{l.reviewStatus}</Badge>
                      {l.reviewNote ? <div className="text-[10px] text-steel-muted mt-0.5 max-w-[220px]">{l.reviewNote}</div> : null}
                    </td>
                    <td className="pr-3">
                      <div className="flex flex-wrap gap-1">
                        {l.reviewStatus !== "Verified" && l.reviewStatus !== "Auto-verified" && (
                          <Button type="button" className="!text-[11px] !py-1 !px-2" disabled={b("Verified")} onClick={() => void review(l, "Verified")}>
                            Verify
                          </Button>
                        )}
                        {l.reviewStatus !== "Rejected" && (
                          <Button type="button" variant="secondary" className="!text-[11px] !py-1 !px-2" disabled={b("Rejected")} onClick={() => void review(l, "Rejected")}>
                            Reject
                          </Button>
                        )}
                        {l.checkOut && (
                          <Button type="button" variant="secondary" className="!text-[11px] !py-1 !px-2" disabled={b("del-out")} onClick={() => remove(l, "out")}>
                            Delete clock-out
                          </Button>
                        )}
                        <Button type="button" variant="danger" className="!text-[11px] !py-1 !px-2" disabled={b("del-all")} onClick={() => remove(l, "all")}>
                          Delete day
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!shown.length && (
                <tr>
                  <td colSpan={9} className="p-4 text-center text-steel-muted">
                    {loading ? "Loading…" : filter === "review" ? "Nothing waiting for review." : "No punches."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
