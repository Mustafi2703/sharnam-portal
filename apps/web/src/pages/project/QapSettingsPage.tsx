import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { StatusNote } from "../../components/StatusNote";
import { QapPickerLists } from "../../components/QapPickerLists";
import { Badge, Button, Card, PageHeader } from "../../components/ui";
import { downloadAuthFile } from "../../lib/downloadReport";
import {
  QAP_PICKER_META,
  invalidateQapSettings,
  standardPickers,
  useQapSettings,
  type QapLibraryActivity,
  type QapLibraryItem,
} from "../../lib/qapSettings";

const blankItem = (): QapLibraryItem => ({ description: "", frequency: "", codeOfConformance: "", testAgency: "" });
const inputCls = "w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm";

/** QAP master — upload the QAP master Excel, this project's QAP library (activity → checks) and the pick-lists used when adding QAP lines. */
export default function QapSettingsPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const { data, error, reload } = useQapSettings(id, token);
  const canManage = user?.role === "admin" || user?.role === "office";
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");

  const [lib, setLib] = useState<QapLibraryActivity[]>([]);
  const [sel, setSel] = useState(0);
  const [newActivity, setNewActivity] = useState("");
  const [pick, setPick] = useState<Record<string, string[]>>({});
  const [adding, setAdding] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement | null>(null);
  const masterRef = useRef<HTMLInputElement | null>(null);

  const uploadMaster = (f: File) =>
    run("master", `Uploading ${f.name}`, async () => {
      const parts: string[] = [];
      const fd = new FormData();
      fd.append("file", f);
      try {
        const out = await api<{ imported: number; weekLabel: string }>(`/api/checklist/project/${id}/qap/import`, { method: "POST", token, body: fd, timeoutMs: 180_000 });
        parts.push(`${out.imported} QAP lines loaded for ${out.weekLabel}`);
      } catch (err) {
        parts.push(`QAP lines not loaded (${err instanceof Error ? err.message : "error"})`);
      }
      const fd2 = new FormData();
      fd2.append("file", f);
      try {
        const lib = await api<{ library: QapLibraryActivity[] }>(`/api/checklist/project/${id}/qap/settings/library/import?strict=1`, { method: "POST", token, body: fd2, timeoutMs: 120_000 });
        parts.push(`library set from the workbook: ${lib.library.length} activities`);
      } catch {
        parts.push("no library sheet in this file — library unchanged");
      }
      return `${f.name}: ${parts.join("; ")}.`;
    });

  useEffect(() => {
    if (!data) return;
    setLib(data.library.map((a) => ({ activity: a.activity, items: a.items.map((i) => ({ ...i })) })));
    setPick(Object.fromEntries(Object.entries(data.pickers).map(([k, v]) => [k, [...v]])));
    setSel((s) => Math.min(s, Math.max(0, data.library.length - 1)));
  }, [data]);

  const libChanged = useMemo(() => !!data && JSON.stringify(lib) !== JSON.stringify(data.library), [lib, data]);
  const pickChanged = useMemo(
    () => !!data && QAP_PICKER_META.some((m) => JSON.stringify(pick[m.key] || []) !== JSON.stringify(data.pickers[m.key] || [])),
    [pick, data]
  );
  const current = lib[sel];
  const std = standardPickers();

  function patchActivity(i: number, next: Partial<QapLibraryActivity>) {
    setLib(lib.map((a, k) => (k === i ? { ...a, ...next } : a)));
  }
  function patchItem(j: number, next: Partial<QapLibraryItem>) {
    if (!current) return;
    patchActivity(sel, { items: current.items.map((it, k) => (k === j ? { ...it, ...next } : it)) });
  }
  function moveActivity(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= lib.length) return;
    const next = [...lib];
    [next[i], next[j]] = [next[j], next[i]];
    setLib(next);
    setSel(j);
  }
  function addActivity() {
    const name = newActivity.replace(/\s+/g, " ").trim();
    if (!name) return;
    if (lib.some((a) => a.activity.toLowerCase() === name.toLowerCase())) {
      setMsg(`"${name}" is already in the library.`);
      return;
    }
    setLib([...lib, { activity: name, items: [blankItem()] }]);
    setSel(lib.length);
    setNewActivity("");
  }
  function removeActivity(i: number) {
    if (!window.confirm(`Remove "${lib[i].activity}" and its ${lib[i].items.length} check(s) from this project's library?`)) return;
    setLib(lib.filter((_, k) => k !== i));
    setSel(Math.max(0, Math.min(sel, lib.length - 2)));
  }

  async function run(key: string, label: string, fn: () => Promise<string>) {
    setBusy(key);
    setMsg(`${label}…`);
    try {
      setMsg(await fn());
      if (id) invalidateQapSettings(id);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : `${label} failed`);
    } finally {
      setBusy("");
    }
  }

  const saveLibrary = () =>
    run("lib", "Saving the QAP library", async () => {
      const cleaned = lib
        .map((a) => ({ ...a, items: a.items.filter((i) => i.description.trim()) }))
        .filter((a) => a.activity.trim());
      const empty = cleaned.find((a) => !a.items.length);
      if (empty) throw new Error(`"${empty.activity}" has no checks — add one or remove the activity.`);
      const out = await api<{ library: QapLibraryActivity[] }>(`/api/checklist/project/${id}/qap/settings/library`, {
        method: "PUT",
        token,
        body: JSON.stringify({ library: cleaned }),
        headers: { "Content-Type": "application/json" },
      });
      return `Library saved — ${out.library.length} activities. "Add from QAP library" on the QAP sheet now offers these.`;
    });

  const importLibrary = (f: File) =>
    run("import", `Reading ${f.name}`, async () => {
      const fd = new FormData();
      fd.append("file", f);
      const out = await api<{ library: QapLibraryActivity[] }>(`/api/checklist/project/${id}/qap/settings/library/import`, {
        method: "POST",
        token,
        body: fd,
        timeoutMs: 120_000,
      });
      const checks = out.library.reduce((n, a) => n + a.items.length, 0);
      return `Library loaded from ${f.name}: ${out.library.length} activities, ${checks} checks.`;
    });

  const resetLibrary = () => {
    if (!window.confirm("Go back to the client's standard QAP library (Quality Assurance Plan Week 50 · Sheet2)?")) return;
    void run("reset-lib", "Resetting the library", async () => {
      await api(`/api/checklist/project/${id}/qap/settings?what=library`, { method: "DELETE", token });
      return "Library reset to the client's standard.";
    });
  };

  const savePickers = () =>
    run("pick", "Saving the pick-lists", async () => {
      const empty = QAP_PICKER_META.find((m) => !(pick[m.key] || []).length);
      if (empty) throw new Error(`"${empty.title}" needs at least one option.`);
      await api(`/api/checklist/project/${id}/qap/settings/pickers`, {
        method: "PUT",
        token,
        body: JSON.stringify({ pickers: pick }),
        headers: { "Content-Type": "application/json" },
      });
      return "Pick-lists saved. The QAP sheet, Add QAP line and the library window now offer these.";
    });

  const resetPickers = () => {
    if (!window.confirm("Reset every QAP pick-list on this project to the SPDC standard?")) return;
    void run("reset-pick", "Resetting the pick-lists", async () => {
      await api(`/api/checklist/project/${id}/qap/settings?what=pickers`, { method: "DELETE", token });
      return "Pick-lists back to the SPDC standard.";
    });
  };

  function addPick(key: string) {
    const v = (adding[key] || "").replace(/\s+/g, " ").trim();
    if (!v) return;
    const list = pick[key] || [];
    if (list.some((x) => x.toLowerCase() === v.toLowerCase())) return setMsg(`"${v}" is already in that list.`);
    setPick({ ...pick, [key]: [...list, v] });
    setAdding({ ...adding, [key]: "" });
  }
  function movePick(key: string, i: number, dir: -1 | 1) {
    const list = [...(pick[key] || [])];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setPick({ ...pick, [key]: list });
  }

  if (!id) return null;
  return (
    <div className="space-y-4 min-w-0 pb-8">
      <PageHeader
        eyebrow="Quality module · QAP master"
        title="QAP master"
        subtitle="This project's QAP activity master — Week 50 activities and pick-lists you can edit, extend, and use when adding lines on the QAP sheet (same pattern as quality / safety checklist masters)."
      />
      <QapPickerLists />
      <StatusNote msg={msg || error} />
      {!canManage ? (
        <Card><p className="text-sm text-steel-muted">You can view the QAP master. Only admin and office can change it.</p></Card>
      ) : null}

      <section className="space-y-2">
        <h3 className="font-semibold">1. Load QAP activity master</h3>
        <Card className="space-y-3">
          <p className="text-sm text-steel-muted">
            Same idea as quality / safety checklist masters: each project gets its own copy of the Week 50 activities
            (Sheet1 — Site Survey, Excavation, Concreting…) plus materials checks (Sheet2), and the pick-lists used when
            adding lines. Edit activities here, add more, then use them on the QAP sheet via “Add from QAP library”.
          </p>
          {canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                disabled={Boolean(busy)}
                onClick={() =>
                  void run("sync", "Loading Week 50 activity master", async () => {
                    const out = await api<{
                      libraryActivities: number;
                      libraryChecks: number;
                      pickersCustom: string[];
                      fromSheet1: number;
                      fromSheet2: number;
                      skipped?: boolean;
                    }>(`/api/checklist/project/${id}/qap/settings/sync-master?force=1`, { method: "POST", token, timeoutMs: 120_000 });
                    return out.skipped
                      ? `Already on file — ${out.libraryActivities} activities / ${out.libraryChecks} checks.`
                      : `Loaded ${out.libraryActivities} activities / ${out.libraryChecks} checks from Week 50 (Sheet1 ${out.fromSheet1} · Sheet2 ${out.fromSheet2}) · ${out.pickersCustom?.length ?? 0} pick-lists.`;
                  })
                }
              >
                {busy === "sync" ? "Loading…" : "Load Week 50 master activities"}
              </Button>
              <input
                ref={masterRef}
                type="file"
                accept=".xlsx,.xls"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void uploadMaster(f);
                }}
              />
              <Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => masterRef.current?.click()}>
                {busy === "master" ? "Uploading…" : "Upload QAP master Excel"}
              </Button>
              <Link to={`/projects/${id}/qap`} className="text-sm font-semibold text-brand">
                Open the QAP sheet →
              </Link>
            </div>
          ) : null}
        </Card>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">2. QAP library</h3>
          {data ? data.libraryCustom ? <Badge tone="brand">project library</Badge> : <Badge tone="neutral">client standard</Badge> : null}
          <span className="text-xs text-steel-muted">{lib.length} activities · {lib.reduce((n, a) => n + a.items.length, 0)} checks</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="!text-sm"
              disabled={Boolean(busy)}
              onClick={() =>
                void run("dl", "Preparing the library Excel", async () => {
                  await downloadAuthFile(`/api/checklist/project/${id}/qap/settings/library/download.xlsx`, token, "QAP_Library.xlsx");
                  return "Library Excel downloaded.";
                })
              }
            >
              Download library (Excel)
            </Button>
            {canManage ? (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void importLibrary(f);
                  }}
                />
                <Button type="button" variant="secondary" className="!text-sm" disabled={Boolean(busy)} onClick={() => fileRef.current?.click()}>
                  {busy === "import" ? "Loading…" : "Load library Excel"}
                </Button>
                {data?.libraryCustom ? (
                  <Button type="button" variant="ghost" className="!text-sm" disabled={Boolean(busy)} onClick={resetLibrary}>
                    Reset to client standard
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
        <p className="text-xs text-steel-muted">
          Master source: <span className="font-mono">Quality Assurance Plan Week 50.xlsx</span> Sheet1 (full activities) + Sheet2 (materials).
          Export layout: Activity · Description · Frequency · Code of Conformance · Test agency. Add new activities below; Save applies them to this project only.
        </p>

        <div className="grid lg:grid-cols-[minmax(220px,300px)_1fr] gap-3 items-start">
          <Card className="!p-2 space-y-1 max-h-[60vh] overflow-y-auto">
            {lib.map((a, i) => (
              <div
                key={`${a.activity}-${i}`}
                className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm cursor-pointer ${i === sel ? "bg-brand-soft text-ink font-semibold" : "hover:bg-paper"}`}
                onClick={() => setSel(i)}
              >
                <span className="flex-1 truncate" title={a.activity}>{a.activity}</span>
                <span className="text-[11px] text-steel-muted">{a.items.length}</span>
                {canManage && i === sel ? (
                  <>
                    <button type="button" className="px-1 text-steel-muted disabled:opacity-30" disabled={i === 0} onClick={(e) => (e.stopPropagation(), moveActivity(i, -1))} aria-label="Move up">↑</button>
                    <button type="button" className="px-1 text-steel-muted disabled:opacity-30" disabled={i === lib.length - 1} onClick={(e) => (e.stopPropagation(), moveActivity(i, 1))} aria-label="Move down">↓</button>
                    <button type="button" className="px-1 text-danger" onClick={(e) => (e.stopPropagation(), removeActivity(i))} aria-label={`Remove ${a.activity}`}>×</button>
                  </>
                ) : null}
              </div>
            ))}
            {!lib.length ? <p className="text-xs text-steel-muted p-2">{data ? "No activities yet." : "Loading…"}</p> : null}
            {canManage ? (
              <div className="flex gap-1 pt-2 border-t border-line">
                <input
                  className={inputCls}
                  placeholder="New activity (e.g. Waterproofing)"
                  value={newActivity}
                  list="qap-pick-section"
                  onChange={(e) => setNewActivity(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addActivity())}
                />
                <Button type="button" variant="secondary" className="!py-1.5" onClick={addActivity}>Add</Button>
              </div>
            ) : null}
          </Card>

          <Card className="!p-3 space-y-3 min-w-0">
            {current ? (
              <>
                <label className="block text-xs font-semibold text-steel-muted">
                  Activity name
                  <input
                    className={`${inputCls} mt-1 font-semibold`}
                    value={current.activity}
                    disabled={!canManage}
                    onChange={(e) => patchActivity(sel, { activity: e.target.value })}
                  />
                </label>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse min-w-[760px]">
                    <thead>
                      <tr className="bg-[#0B2545] text-white text-left">
                        <th className="px-2 py-2 w-8">#</th>
                        <th className="px-2 py-2">Description of the check</th>
                        <th className="px-2 py-2 w-40">Frequency</th>
                        <th className="px-2 py-2 w-48">Code of conformance</th>
                        <th className="px-2 py-2 w-40">Test agency</th>
                        {canManage ? <th className="px-2 py-2 w-8" /> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {current.items.map((it, j) => (
                        <tr key={j} className="border-b border-line align-top odd:bg-white even:bg-[#F3F6FA]">
                          <td className="px-2 py-1.5 text-steel-muted">{j + 1}</td>
                          <td className="px-1 py-1">
                            <textarea className={`${inputCls} min-h-[38px]`} rows={2} value={it.description} disabled={!canManage} onChange={(e) => patchItem(j, { description: e.target.value })} />
                          </td>
                          <td className="px-1 py-1"><input className={inputCls} list="qap-pick-frequency" value={it.frequency} disabled={!canManage} onChange={(e) => patchItem(j, { frequency: e.target.value })} /></td>
                          <td className="px-1 py-1"><input className={inputCls} list="qap-pick-codeOfConformance" value={it.codeOfConformance} disabled={!canManage} onChange={(e) => patchItem(j, { codeOfConformance: e.target.value })} /></td>
                          <td className="px-1 py-1"><input className={inputCls} list="qap-pick-testAgency" value={it.testAgency} disabled={!canManage} onChange={(e) => patchItem(j, { testAgency: e.target.value })} /></td>
                          {canManage ? (
                            <td className="px-1 py-1.5">
                              <button type="button" className="text-danger px-1" onClick={() => patchActivity(sel, { items: current.items.filter((_, k) => k !== j) })} aria-label="Remove check">×</button>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {canManage ? (
                  <Button type="button" variant="secondary" className="!text-sm" onClick={() => patchActivity(sel, { items: [...current.items, blankItem()] })}>
                    + Add a check
                  </Button>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-steel-muted">Pick an activity on the left, or add one.</p>
            )}
          </Card>
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2 sticky bottom-0 bg-paper/90 backdrop-blur py-2 z-10">
            <Button type="button" disabled={Boolean(busy) || !libChanged} onClick={() => void saveLibrary()}>{busy === "lib" ? "Saving…" : "Save library"}</Button>
            <Button type="button" variant="secondary" disabled={Boolean(busy) || !libChanged} onClick={() => data && setLib(data.library.map((a) => ({ ...a, items: a.items.map((i) => ({ ...i })) })))}>
              Discard changes
            </Button>
            {libChanged ? <span className="text-xs text-amber-700">Unsaved library changes</span> : null}
          </div>
        ) : null}
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">3. Pick-lists</h3>
          <span className="text-xs text-steel-muted">Offered on the QAP sheet, Add QAP line and Add from QAP library. Rows already using an older value keep it.</span>
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {QAP_PICKER_META.map((m) => {
            const list = pick[m.key] || [];
            const isStd = JSON.stringify(list) === JSON.stringify(std[m.key] || []);
            return (
              <Card key={m.key} className="!p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{m.title}</span>
                  {isStd ? <Badge tone="neutral">standard</Badge> : <Badge tone="brand">customised</Badge>}
                  <span className="ml-auto text-[11px] text-steel-muted">{list.length}</span>
                </div>
                <p className="text-[11px] text-steel-muted">{m.hint}</p>
                <ul className="space-y-1 max-h-56 overflow-y-auto">
                  {list.map((v, i) => (
                    <li key={`${v}-${i}`} className="flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1 text-sm">
                      <span className="flex-1 truncate" title={v}>{v}</span>
                      {canManage ? (
                        <>
                          <button type="button" className="px-1 text-steel-muted disabled:opacity-30" disabled={i === 0} onClick={() => movePick(m.key, i, -1)} aria-label="Move up">↑</button>
                          <button type="button" className="px-1 text-steel-muted disabled:opacity-30" disabled={i === list.length - 1} onClick={() => movePick(m.key, i, 1)} aria-label="Move down">↓</button>
                          <button type="button" className="px-1 text-danger" onClick={() => setPick({ ...pick, [m.key]: list.filter((_, k) => k !== i) })} aria-label={`Remove ${v}`}>×</button>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {canManage ? (
                  <>
                    <div className="flex gap-2">
                      <input
                        className={inputCls}
                        placeholder="Add an option"
                        value={adding[m.key] || ""}
                        onChange={(e) => setAdding({ ...adding, [m.key]: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPick(m.key))}
                      />
                      <Button type="button" variant="secondary" className="!py-1.5" onClick={() => addPick(m.key)}>Add</Button>
                    </div>
                    {!isStd ? (
                      <button type="button" className="text-xs font-semibold text-brand" onClick={() => setPick({ ...pick, [m.key]: [...(std[m.key] || [])] })}>
                        Use the standard list
                      </button>
                    ) : null}
                  </>
                ) : null}
              </Card>
            );
          })}
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2 sticky bottom-0 bg-paper/90 backdrop-blur py-2 z-10">
            <Button type="button" disabled={Boolean(busy) || !pickChanged} onClick={() => void savePickers()}>{busy === "pick" ? "Saving…" : "Save pick-lists"}</Button>
            <Button type="button" variant="secondary" disabled={Boolean(busy) || !pickChanged} onClick={() => data && setPick(Object.fromEntries(Object.entries(data.pickers).map(([k, v]) => [k, [...v]])))}>
              Discard changes
            </Button>
            <Button type="button" variant="ghost" disabled={Boolean(busy)} onClick={resetPickers}>Reset all to standard</Button>
            {pickChanged ? <span className="text-xs text-amber-700">Unsaved pick-list changes</span> : null}
          </div>
        ) : null}
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">4. Use it and generate the sheets</h3>
        <Card className="space-y-3">
          <p className="text-sm text-steel-muted">
            On the QAP sheet, <strong>+ Add from QAP library</strong> lists these activities: pick one, tick its checks, and frequency, code and test agency fill in. Downloads come out in Sharnam branding — logo, navy headers, wrapped text and grid lines.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to={`/projects/${id}/qap`} className="text-sm font-semibold text-brand">Open the QAP sheet →</Link>
            <Button
              type="button"
              variant="secondary"
              className="!text-sm"
              disabled={Boolean(busy)}
              onClick={() =>
                void run("qap-dl", "Preparing the QAP Excel", async () => {
                  await downloadAuthFile(`/api/checklist/project/${id}/qap/download.xlsx`, token, "QAP.xlsx");
                  return "QAP Excel downloaded.";
                })
              }
            >
              Download QAP (Excel)
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="!text-sm"
              disabled={Boolean(busy)}
              onClick={() =>
                void run("qd-dl", "Preparing the Quality Dashboard Excel", async () => {
                  await downloadAuthFile(`/api/checklist/project/${id}/quality-dashboard/download.xlsx`, token, "Quality_Dashboard.xlsx");
                  return "Quality Dashboard Excel downloaded.";
                })
              }
            >
              Download Quality Dashboard (Excel)
            </Button>
            <Button type="button" variant="ghost" className="!text-sm" onClick={reload}>Refresh</Button>
          </div>
        </Card>
      </section>
    </div>
  );
}
