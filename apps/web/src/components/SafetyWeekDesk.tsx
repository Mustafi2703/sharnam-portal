import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { downloadAuthFile } from "../lib/downloadReport";
import { useAuth } from "../auth";
import { CHART_COLORS, ColumnChart } from "./ColumnChart";
import { PieChart } from "./PieChart";
import { Button, Card } from "./ui";

type Day = {
  date: string;
  manpower: number;
  hoursPerHead: number;
  safeManHours: number;
  toolboxTalks: number;
  tbtTopics: string | null;
  inductions: number;
  permitsIssued: number;
  ppeCompliancePct: number | null;
  lostTimeInjury: boolean;
  majorIncident: string | null;
  remarks: string | null;
  logged: boolean;
};

const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const mondayKey = (d = new Date()) => keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)));
const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + n);
  return keyOf(d);
};
const isoWeek = (key: string) => {
  const d = new Date(`${key}T00:00:00`);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
};
const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");

/**
 * Safety Dashboard — Week N: the One Pager KPIs, the daily safety log (manpower, hours, TBT,
 * inductions, permits, PPE, LTI) and column charts. The daily log feeds the DPR and WPR safety blocks.
 */
export function SafetyWeekDesk({ projectId, showLog = true }: { projectId: string; showLog?: boolean }) {
  const { token, user } = useAuth();
  const canLog = ["admin", "office", "employee", "site_employee", "vendor"].includes(user?.role || "");
  const canDelete = user?.role === "admin" || user?.role === "office";
  const [weekStart, setWeekStart] = useState(mondayKey());
  const [rep, setRep] = useState<any>(null);
  const [edits, setEdits] = useState<Record<string, Partial<Day>>>({});
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const today = keyOf(new Date());
  const weekEnd = addDays(weekStart, 6);

  const load = useCallback(async () => {
    try {
      setRep(await api(`/api/safety/project/${projectId}/weekly?from=${weekStart}&to=${weekEnd}`, { token }));
      setEdits({});
    } catch (err) {
      setMsg({ tone: "err", text: err instanceof Error ? err.message : "Could not load the safety week" });
    }
  }, [projectId, weekStart, weekEnd, token]);
  useEffect(() => {
    void load();
  }, [load]);

  const row = (d: Day): Day => ({ ...d, ...(edits[d.date] || {}) } as Day);
  const set = (date: string, patch: Partial<Day>) => setEdits((e) => ({ ...e, [date]: { ...(e[date] || {}), ...patch } }));

  async function save(d: Day) {
    const r = row(d);
    setBusy(d.date);
    setMsg(null);
    try {
      await api(`/api/safety/project/${projectId}/daily/${d.date}`, {
        method: "PUT",
        token,
        body: JSON.stringify({
          manpower: r.manpower,
          hoursPerHead: r.hoursPerHead,
          toolboxTalks: r.toolboxTalks,
          tbtTopics: r.tbtTopics,
          inductions: r.inductions,
          permitsIssued: r.permitsIssued,
          ppeCompliancePct: r.ppeCompliancePct,
          lostTimeInjury: r.lostTimeInjury,
          majorIncident: r.majorIncident,
          remarks: r.remarks,
        }),
      });
      setMsg({ tone: "ok", text: `${d.date} saved — feeds the Safety dashboard, DPR and WPR.` });
      await load();
    } catch (err) {
      setMsg({ tone: "err", text: err instanceof Error ? err.message : "Could not save" });
    } finally {
      setBusy("");
    }
  }

  async function clear(d: Day) {
    if (!window.confirm(`Clear the safety log for ${d.date}?`)) return;
    setBusy(d.date);
    try {
      await api(`/api/safety/project/${projectId}/daily/${d.date}`, { method: "DELETE", token });
      await load();
    } catch (err) {
      setMsg({ tone: "err", text: err instanceof Error ? err.message : "Could not clear" });
    } finally {
      setBusy("");
    }
  }

  const k = rep?.kpis || {};
  const input = "w-full rounded border border-line bg-white px-1.5 py-1 text-xs tabular-nums";

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-line bg-gradient-to-br from-[#F7F8FA] to-white p-4 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel-muted">Safety Dashboard.xlsx · One Pager</p>
            <h3 className="font-display text-lg text-ink">
              Safety Dashboard — Week {isoWeek(weekStart)}
              <span className="text-sm text-steel-muted font-sans">
                {" "}· {new Date(`${weekStart}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} to{" "}
                {new Date(`${weekEnd}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
            </h3>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Button type="button" variant="secondary" className="!text-xs !py-1.5" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              ← Previous week
            </Button>
            <label className="text-xs text-steel-muted">
              Week starting
              <input
                type="date"
                className="mt-1 block rounded-lg border border-line bg-white px-2 py-1 text-sm text-ink"
                value={weekStart}
                onChange={(e) => e.target.value && setWeekStart(mondayKey(new Date(`${e.target.value}T00:00:00`)))}
              />
            </label>
            <Button type="button" variant="secondary" className="!text-xs !py-1.5" disabled={weekStart >= mondayKey()} onClick={() => setWeekStart(addDays(weekStart, 7))}>
              Next week →
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="!text-xs !py-1.5"
              onClick={() =>
                void downloadAuthFile(`/api/safety/project/${projectId}/weekly.xlsx?from=${weekStart}&to=${weekEnd}`, token, `Safety-Dashboard-${weekStart}.xlsx`).catch((e) =>
                  setMsg({ tone: "err", text: e.message }),
                )
              }
            >
              Week Excel
            </Button>
            {canLog && user?.role !== "vendor" && (
              <Button
                type="button"
                className="!text-xs !py-1.5"
                disabled={busy === "publish"}
                onClick={async () => {
                  setBusy("publish");
                  try {
                    const out = await api<{ path: string }>(`/api/safety/project/${projectId}/weekly/publish`, { method: "POST", token, body: JSON.stringify({ from: weekStart, to: weekEnd }) });
                    setMsg({ tone: "ok", text: `Week filed on SharePoint: ${out.path}` });
                  } catch (err) {
                    setMsg({ tone: "err", text: err instanceof Error ? err.message : "Could not file the week" });
                  } finally {
                    setBusy("");
                  }
                }}
              >
                {busy === "publish" ? "Filing…" : "File week to SharePoint"}
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {[
            ["Total incidents", k.totalIncidents ?? 0, "Project to date"],
            ["Total unsafe acts", k.totalUnsafeActs ?? 0, "Project to date"],
            ["Total NCR", k.totalNcrs ?? 0, "Project to date"],
            ["Weekly safe man-hours", fmt(k.weeklySafeHours ?? 0), `${k.daysLogged ?? 0} of 7 days logged`],
            ["Cumulative safe man-hours", fmt(k.cumulativeSafeHours ?? 0), "Project to date"],
            ["Toolbox talks", k.toolboxTalksWeek ?? 0, "This week"],
            ["HSE inductions", k.inductionsWeek ?? 0, "This week"],
            ["Permits to work", k.permitsWeek ?? 0, "This week"],
            ["Days without LTI", k.daysWithoutLti ?? 0, "Up to week end"],
            ["Open safety items", k.openItems ?? 0, "All open records"],
          ].map(([l, v, h]) => (
            <Card key={l as string} className="!p-3">
              <div className="text-[10px] uppercase text-steel-muted font-mono">{l}</div>
              <div className="text-xl font-display mt-1">{v as string | number}</div>
              <div className="text-[10px] text-steel-muted">{h}</div>
            </Card>
          ))}
        </div>
        <div className={`rounded-lg border px-3 py-2 text-sm ${k.majorIncident ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          <span className="font-semibold">Major safety incident — this week: </span>
          {k.majorIncident || "None reported"}
        </div>

        <div className="grid md:grid-cols-2 gap-4 items-start">
          <ColumnChart
            title="This week — open vs closed"
            subtitle="Unsafe acts, near miss, first aid, incidents, NCR, site instructions"
            items={rep?.charts?.byTypeOpenClosed || []}
            series={[
              { key: "open", label: "Open", color: CHART_COLORS.red },
              { key: "closed", label: "Closed", color: CHART_COLORS.green },
            ]}
            yLabel="Count"
            emptyText="No safety records raised this week."
          />
          <ColumnChart
            title="Safe man-hours by day"
            items={rep?.charts?.dailySafeHours || []}
            series={[{ key: "value", label: "Safe man-hours", color: CHART_COLORS.teal }]}
            yLabel="Hours"
            emptyText="Log the daily manpower below to see safe man-hours."
          />
          <ColumnChart
            title="Manpower on site by day"
            items={rep?.charts?.dailyManpower || []}
            series={[{ key: "value", label: "Workers", color: CHART_COLORS.navy }]}
            yLabel="Workers"
            emptyText="No manpower logged this week."
          />
          <ColumnChart
            title="Unsafe acts by category"
            items={rep?.charts?.unsafeActsByCategory || []}
            series={[{ key: "value", label: "Unsafe acts", color: CHART_COLORS.orange }]}
            yLabel="Count"
            emptyText="No unsafe acts recorded this week."
          />
          <PieChart title="This week by severity" items={rep?.charts?.bySeverity || []} />
        </div>
      </div>

      {showLog && (
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-line bg-sand/40 flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-semibold text-sm">Daily Safety Log</span>
            <span className="text-[11px] text-steel-muted">
              Manpower × hours = safe man-hours (0 on a day with a lost-time injury). Saved days feed the DPR safety block and the WPR HSE indicators.
            </span>
          </div>
          {msg ? (
            <p role={msg.tone === "err" ? "alert" : "status"} className={`mx-4 mt-3 text-xs rounded-md px-3 py-2 ${msg.tone === "err" ? "bg-red-50 text-red-800 border border-red-200" : "bg-sand/50 border border-line"}`}>
              {msg.text}
            </p>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[1150px]">
              <thead className="text-left text-steel-muted">
                <tr>
                  <th className="p-2">Day</th>
                  <th>Manpower</th>
                  <th>Hours / head</th>
                  <th className="text-right pr-2">Safe man-hours</th>
                  <th>Toolbox talks</th>
                  <th>TBT topics</th>
                  <th>Inductions</th>
                  <th>Permits</th>
                  <th>PPE %</th>
                  <th>LTI</th>
                  <th>Major incident / remarks</th>
                  <th className="pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {(rep?.days || []).map((d0: Day) => {
                  const d = row(d0);
                  const future = d.date > today;
                  const dirty = !!edits[d.date];
                  const calc = d.lostTimeInjury ? 0 : Math.round((Number(d.manpower) || 0) * (Number(d.hoursPerHead) || 0) * 10) / 10;
                  const ro = !canLog || future;
                  return (
                    <tr key={d.date} className={`border-t border-line align-top ${d0.logged ? "" : "bg-amber-50/40"}`}>
                      <td className="p-2 whitespace-nowrap">
                        <div className="font-semibold">{new Date(`${d.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })}</div>
                        <div className="text-[10px] text-steel-muted">{future ? "Not yet" : d0.logged ? "Logged" : "Not logged"}</div>
                      </td>
                      <td className="w-20"><input className={input} type="number" min={0} disabled={ro} value={d.manpower} onChange={(e) => set(d.date, { manpower: Number(e.target.value) })} /></td>
                      <td className="w-20"><input className={input} type="number" min={0} max={24} step={0.5} disabled={ro} value={d.hoursPerHead} onChange={(e) => set(d.date, { hoursPerHead: Number(e.target.value) })} /></td>
                      <td className="text-right pr-2 font-semibold tabular-nums">{fmt(dirty ? calc : d.safeManHours)}</td>
                      <td className="w-16"><input className={input} type="number" min={0} disabled={ro} value={d.toolboxTalks} onChange={(e) => set(d.date, { toolboxTalks: Number(e.target.value) })} /></td>
                      <td className="min-w-[160px]"><input className={input} disabled={ro} value={d.tbtTopics || ""} placeholder="Work at height, PPE…" onChange={(e) => set(d.date, { tbtTopics: e.target.value })} /></td>
                      <td className="w-16"><input className={input} type="number" min={0} disabled={ro} value={d.inductions} onChange={(e) => set(d.date, { inductions: Number(e.target.value) })} /></td>
                      <td className="w-16"><input className={input} type="number" min={0} disabled={ro} value={d.permitsIssued} onChange={(e) => set(d.date, { permitsIssued: Number(e.target.value) })} /></td>
                      <td className="w-16"><input className={input} type="number" min={0} max={100} disabled={ro} value={d.ppeCompliancePct ?? ""} onChange={(e) => set(d.date, { ppeCompliancePct: e.target.value === "" ? null : Number(e.target.value) })} /></td>
                      <td className="text-center"><input type="checkbox" disabled={ro} checked={!!d.lostTimeInjury} onChange={(e) => set(d.date, { lostTimeInjury: e.target.checked })} /></td>
                      <td className="min-w-[200px] space-y-1">
                        <input className={input} disabled={ro} value={d.majorIncident || ""} placeholder="Major incident (if any)" onChange={(e) => set(d.date, { majorIncident: e.target.value })} />
                        <input className={input} disabled={ro} value={d.remarks || ""} placeholder="Remarks" onChange={(e) => set(d.date, { remarks: e.target.value })} />
                      </td>
                      <td className="pr-3 whitespace-nowrap">
                        {!ro && (
                          <Button type="button" className="!text-[11px] !py-1 !px-2" disabled={busy === d.date || (!dirty && d0.logged)} onClick={() => void save(d0)}>
                            {busy === d.date ? "Saving…" : d0.logged ? "Update" : "Save day"}
                          </Button>
                        )}
                        {canDelete && d0.logged && (
                          <button type="button" className="ml-2 text-[11px] text-danger font-semibold cursor-pointer" onClick={() => void clear(d0)}>
                            Clear
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {rep && (
                <tfoot>
                  <tr className="border-t-2 border-line font-semibold">
                    <td className="p-2">Week total</td>
                    <td>{(rep.days as Day[]).reduce((n, d) => n + d.manpower, 0)}</td>
                    <td></td>
                    <td className="text-right pr-2">{fmt(k.weeklySafeHours ?? 0)}</td>
                    <td>{(rep.days as Day[]).reduce((n, d) => n + d.toolboxTalks, 0)}</td>
                    <td></td>
                    <td>{k.inductionsWeek ?? 0}</td>
                    <td>{k.permitsWeek ?? 0}</td>
                    <td colSpan={4} className="text-[11px] text-steel-muted font-normal">
                      Previous week: {fmt(rep.previousWeek?.safeHours ?? 0)} safe man-hours · {rep.previousWeek?.toolboxTalks ?? 0} TBT · {rep.previousWeek?.inductions ?? 0} inductions
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      )}
      <SafetyOpeningBalanceCard projectId={projectId} canEdit={canDelete} />
    </div>
  );
}

/**
 * Safe man-hours / man-days before the portal (the client's HSE Statistic "Up to previous week").
 * Added to the daily log totals from the as-of date, so cumulative figures in the DPR, WPR and
 * Safety Dashboard carry on from the client's numbers.
 */
function SafetyOpeningBalanceCard({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const { token } = useAuth();
  const [form, setForm] = useState({ asOf: "", safeManHours: "", safeManDays: "" });
  const [saved, setSaved] = useState<string>("");
  useEffect(() => {
    api<{ asOf: string; safeManHours: number; safeManDays: number } | null>(`/api/safety/project/${projectId}/opening-balance`, { token })
      .then((row) => {
        if (row) setForm({ asOf: String(row.asOf).slice(0, 10), safeManHours: String(row.safeManHours), safeManDays: String(row.safeManDays) });
      })
      .catch(() => undefined);
  }, [projectId, token]);
  const save = async () => {
    try {
      await api(`/api/safety/project/${projectId}/opening-balance`, { method: "PUT", token, body: JSON.stringify(form) });
      setSaved("Saved — cumulative figures now include this balance.");
    } catch (err) {
      setSaved(err instanceof Error ? err.message : "Could not save");
    }
  };
  const input = "w-full rounded border border-line bg-white px-2 py-1 text-sm tabular-nums";
  return (
    <Card>
      <div className="space-y-2 p-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel-muted">Opening balance · before the portal</p>
        <p className="text-xs text-steel-muted">
          Safe man-hours and safe man-days up to a date (client HSE Statistic, "Up to previous week"). Daily logs after that date add on.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-end">
          <label className="text-xs text-steel-muted">
            Up to (date)
            <input type="date" className={input} disabled={!canEdit} value={form.asOf} onChange={(e) => setForm({ ...form, asOf: e.target.value })} />
          </label>
          <label className="text-xs text-steel-muted">
            Safe man-hours
            <input type="number" min={0} className={input} disabled={!canEdit} value={form.safeManHours} onChange={(e) => setForm({ ...form, safeManHours: e.target.value })} />
          </label>
          <label className="text-xs text-steel-muted">
            Safe man-days
            <input type="number" min={0} className={input} disabled={!canEdit} value={form.safeManDays} onChange={(e) => setForm({ ...form, safeManDays: e.target.value })} />
          </label>
          {canEdit && (
            <Button type="button" className="!text-xs !py-1.5" disabled={!form.asOf} onClick={() => void save()}>
              Save opening balance
            </Button>
          )}
        </div>
        {saved && <p className="text-xs text-steel-muted">{saved}</p>}
      </div>
    </Card>
  );
}
