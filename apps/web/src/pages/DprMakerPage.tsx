import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useParams } from "react-router-dom";
import { api, apiBase } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, Select } from "../components/ui";

async function downloadWithAuth(url: string, token: string | null | undefined, filename: string) {
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

/**
 * DPR Maker — SPDC 8-block format:
 *   1. Project header
 *   2. Quantity progress (BOQ items)
 *   3. Manpower deployed today
 *   4. Equipment deployed today
 *   5. Material at site
 *   6. Safety snapshot
 *   7. Delay / idle time log today
 *   8. Site photos (uploaded from phone camera / gallery)
 *
 * Publishes an XLSX (INPUT + DASHBOARD) into the SharePoint DPR folder for
 * the picked discipline.
 */

const DISCIPLINES = [
  { key: "CIVIL", label: "Civil & Structural" },
  { key: "ELECTRICAL", label: "Electrical" },
  { key: "FIRE", label: "Fire Protection" },
  { key: "MECHANICAL", label: "Mechanical" },
  { key: "PEB_ERECTION", label: "PEB Erection" },
  { key: "PEB_SUPPLY", label: "PEB Supply" },
  { key: "PLUMBING", label: "Plumbing" },
];

type Header = {
  projectName?: string;
  projectManager?: string;
  contractor?: string;
  location?: string;
  contractRef?: string;
  contractCompletion?: string | null;
  calendarHours?: string;
  shiftHours?: number;
  weather?: string;
  reportDate?: string | null;
  dataDate?: string | null;
  reportNumber?: string;
  acCertifiedToDate?: number;
  cumManDaysPrev?: number;
  cumSafeManHoursPrev?: number;
  dateOfLastLti?: string | null;
  preparedBy?: string;
};

type Line = {
  srNo?: number;
  group?: string;
  description: string;
  unit?: string;
  scopeQty?: number;
  rate?: number;
  start?: string | null;
  finish?: string | null;
  cumQtyPrev?: number;
  qtyToday?: number;
  remarks?: string;
};

type Manpower = { trade: string; planned?: number; actual?: number; hoursWorked?: number };
type Equipment = { name: string; qty?: number; workedHrs?: number; idleHrs?: number };
type Material = { name: string; unit?: string; opening?: number; received?: number; consumed?: number };
type Safety = {
  safeManHoursToday?: number;
  safeManDaysToday?: number;
  toolboxTalks?: number;
  ppeCompliancePct?: number;
  nearMiss?: number;
  firstAid?: number;
  ltis?: number;
  incidents?: number;
};
type Delay = { cause: string; from?: string; to?: string; hoursLost?: number; eot?: "Yes" | "No" };
type Photo = { path: string; caption?: string; takenAt?: string | null };

type Snap = {
  projectId: string;
  projectCode: string;
  logDate: string;
  discipline: string;
  header: Header;
  lines: Line[];
  manpower: Manpower[];
  equipment: Equipment[];
  materials: Material[];
  safety: Safety;
  delays: Delay[];
  photos: Photo[];
  status: string;
  publishedPath?: string | null;
  publishedAt?: string | null;
};

function toDateInput(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function planPct(dataDate: string | null | undefined, start: string | null | undefined, finish: string | null | undefined): number {
  const d = dataDate ? new Date(dataDate) : null;
  const s = start ? new Date(start) : null;
  const f = finish ? new Date(finish) : null;
  if (!d || !s || !f) return 0;
  if (d >= f) return 1;
  if (d < s) return 0;
  const total = f.getTime() - s.getTime();
  if (total <= 0) return 1;
  return Math.max(0, Math.min(1, (d.getTime() - s.getTime()) / total));
}

export default function DprMakerPage() {
  const { id: projectId = "" } = useParams();
  const { token } = useAuth();
  const [logDate, setLogDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [discipline, setDiscipline] = useState<string>("CIVIL");
  const [snap, setSnap] = useState<Snap | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [recent, setRecent] = useState<any[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoCaption, setPhotoCaption] = useState("");

  const load = useCallback(async () => {
    if (!projectId) return;
    setBusy(true);
    setMsg("");
    try {
      const s = await api<Snap>(`/api/dpr-maker/${projectId}?date=${logDate}&discipline=${discipline}`, { token });
      setSnap(s);
      const r = await api<any[]>(`/api/dpr-maker/${projectId}/recent`, { token }).catch(() => []);
      setRecent(r);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Load failed");
    } finally {
      setBusy(false);
    }
  }, [projectId, logDate, discipline, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const computed = useMemo(() => {
    if (!snap) return null;
    const totalValue = snap.lines.reduce((s, l) => s + num(l.scopeQty) * num(l.rate), 0) || 1;
    const rows = snap.lines.map((l) => {
      const weight = (num(l.scopeQty) * num(l.rate)) / totalValue;
      const cumPrev = num(l.cumQtyPrev);
      const today = num(l.qtyToday);
      const scope = num(l.scopeQty);
      const cum = Math.min(scope, cumPrev + today);
      const pctComplete = scope > 0 ? Math.min(1, cum / scope) : 0;
      const planned = planPct(snap.header.dataDate, l.start ?? null, l.finish ?? null);
      const earnedToday = today * num(l.rate);
      return { weight, cum, pctComplete, planned, earnedToday, balance: Math.max(0, scope - cum) };
    });
    const plannedPct = rows.reduce((s, r) => s + r.weight * r.planned, 0);
    const actualPct = rows.reduce((s, r) => s + r.weight * r.pctComplete, 0);
    const shiftHrs = num(snap.header.shiftHours) || 8;
    const manDaysToday = snap.manpower.reduce(
      (s, m) => s + (num(m.actual) * num(m.hoursWorked || shiftHrs)) / shiftHrs,
      0
    );
    const hoursLostToday = snap.delays.reduce((s, d) => s + num(d.hoursLost), 0);
    return {
      rows,
      plannedPct,
      actualPct,
      variance: actualPct - plannedPct,
      spi: plannedPct > 0 ? actualPct / plannedPct : 0,
      earnedValueLakh: (rows.reduce((s, r) => s + r.weight * r.pctComplete, 0) * totalValue) / 100000,
      valueDoneTodayInr: rows.reduce((s, r) => s + r.earnedToday, 0),
      itemsDelayed: rows.filter((r) => r.pctComplete < r.planned && r.pctComplete < 1).length,
      contractValueLakh: totalValue / 100000,
      manDaysToday,
      hoursLostToday,
    };
  }, [snap]);

  function updateHeader<K extends keyof Header>(k: K, v: Header[K]) {
    if (!snap) return;
    setSnap({ ...snap, header: { ...snap.header, [k]: v } });
  }
  function updateLine(idx: number, patch: Partial<Line>) {
    if (!snap) return;
    const lines = snap.lines.slice();
    lines[idx] = { ...lines[idx], ...patch };
    setSnap({ ...snap, lines });
  }
  function addLine() {
    if (!snap) return;
    setSnap({
      ...snap,
      lines: [
        ...snap.lines,
        { description: "", unit: "CUM", scopeQty: 0, rate: 0, cumQtyPrev: 0, qtyToday: 0 },
      ],
    });
  }
  function removeLine(idx: number) {
    if (!snap) return;
    setSnap({ ...snap, lines: snap.lines.filter((_, i) => i !== idx) });
  }

  function updateManpower(i: number, patch: Partial<Manpower>) {
    if (!snap) return;
    const arr = snap.manpower.slice();
    arr[i] = { ...arr[i], ...patch };
    setSnap({ ...snap, manpower: arr });
  }
  function addManpower() {
    if (!snap) return;
    setSnap({ ...snap, manpower: [...snap.manpower, { trade: "", planned: 0, actual: 0, hoursWorked: 8 }] });
  }
  function removeManpower(i: number) {
    if (!snap) return;
    setSnap({ ...snap, manpower: snap.manpower.filter((_, k) => k !== i) });
  }

  function updateEquip(i: number, patch: Partial<Equipment>) {
    if (!snap) return;
    const arr = snap.equipment.slice();
    arr[i] = { ...arr[i], ...patch };
    setSnap({ ...snap, equipment: arr });
  }
  function addEquip() {
    if (!snap) return;
    setSnap({ ...snap, equipment: [...snap.equipment, { name: "", qty: 0, workedHrs: 0, idleHrs: 0 }] });
  }
  function removeEquip(i: number) {
    if (!snap) return;
    setSnap({ ...snap, equipment: snap.equipment.filter((_, k) => k !== i) });
  }

  function updateMat(i: number, patch: Partial<Material>) {
    if (!snap) return;
    const arr = snap.materials.slice();
    arr[i] = { ...arr[i], ...patch };
    setSnap({ ...snap, materials: arr });
  }
  function addMat() {
    if (!snap) return;
    setSnap({ ...snap, materials: [...snap.materials, { name: "", unit: "BAGS", opening: 0, received: 0, consumed: 0 }] });
  }
  function removeMat(i: number) {
    if (!snap) return;
    setSnap({ ...snap, materials: snap.materials.filter((_, k) => k !== i) });
  }

  function updateSafety<K extends keyof Safety>(k: K, v: number) {
    if (!snap) return;
    setSnap({ ...snap, safety: { ...snap.safety, [k]: v } });
  }

  function updateDelay(i: number, patch: Partial<Delay>) {
    if (!snap) return;
    const arr = snap.delays.slice();
    arr[i] = { ...arr[i], ...patch };
    setSnap({ ...snap, delays: arr });
  }
  function addDelay() {
    if (!snap) return;
    setSnap({ ...snap, delays: [...snap.delays, { cause: "", from: "", to: "", hoursLost: 0, eot: "No" }] });
  }
  function removeDelay(i: number) {
    if (!snap) return;
    setSnap({ ...snap, delays: snap.delays.filter((_, k) => k !== i) });
  }

  function removePhoto(i: number) {
    if (!snap) return;
    setSnap({ ...snap, photos: snap.photos.filter((_, k) => k !== i) });
  }

  async function uploadPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !snap) return;
    setUploadingPhoto(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("photo", file);
      fd.append("caption", photoCaption);
      fd.append("logDate", logDate);
      fd.append("discipline", discipline);
      const out = await api<{ photo: Photo }>(`/api/dpr-maker/${projectId}/photo`, {
        method: "POST",
        token,
        body: fd,
      });
      setSnap((prev) => (prev ? { ...prev, photos: [...prev.photos, out.photo] } : prev));
      setPhotoCaption("");
      setMsg(`Photo uploaded → ${out.photo.path}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      setUploadingPhoto(false);
      e.target.value = "";
    }
  }

  async function save() {
    if (!snap) return;
    setBusy(true);
    setMsg("");
    try {
      await api(`/api/dpr-maker/${projectId}/save`, {
        method: "POST",
        token,
        body: JSON.stringify({
          logDate, discipline,
          header: snap.header, lines: snap.lines,
          manpower: snap.manpower, equipment: snap.equipment,
          materials: snap.materials, safety: snap.safety,
          delays: snap.delays, photos: snap.photos,
        }),
      });
      setMsg("Saved draft.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!snap) return;
    setBusy(true);
    setMsg("");
    try {
      await api(`/api/dpr-maker/${projectId}/save`, {
        method: "POST",
        token,
        body: JSON.stringify({
          logDate, discipline,
          header: snap.header, lines: snap.lines,
          manpower: snap.manpower, equipment: snap.equipment,
          materials: snap.materials, safety: snap.safety,
          delays: snap.delays, photos: snap.photos,
        }),
      });
      const out = await api<any>(`/api/dpr-maker/${projectId}/publish`, {
        method: "POST",
        token,
        body: JSON.stringify({ logDate, discipline }),
      });
      setMsg(`Published → ${out.publishedPath || out.url || "OneDrive/SharePoint"}${out.provider ? ` · ${out.provider}` : ""}`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  async function downloadXlsx() {
    if (!snap) return;
    const url = `${apiBase()}/api/dpr-maker/${projectId}/download.xlsx?date=${logDate}&discipline=${discipline}`;
    const fname = `DPR-${snap.projectCode}-${discipline}-${logDate}.xlsx`;
    setBusy(true);
    try {
      await downloadWithAuth(url, token, fname);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusy(false);
    }
  }

  if (!snap) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="DPR Maker" title="Daily Progress Report" subtitle="Loading…" />
      </div>
    );
  }

  const h = snap.header;
  const s = snap.safety;
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="DPR Maker · SPDC 8-block format"
        title={`Daily Progress Report — ${DISCIPLINES.find((d) => d.key === discipline)?.label || discipline}`}
        subtitle="Header · BOQ items · manpower · equipment · material · safety · delay/idle · photos. Publishes an XLSX (INPUT + DASHBOARD) to the SharePoint DPR folder for this discipline."
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <Badge tone={snap.status === "Published" ? "ok" : "warn"}>{snap.status}</Badge>
            <button className="text-sm font-semibold text-brand underline" onClick={downloadXlsx} disabled={busy}>Download XLSX</button>
          </div>
        }
      />

      <Card className="space-y-3">
        <div className="grid md:grid-cols-4 gap-2">
          <label className="text-xs text-steel-muted">
            Log date
            <Input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
          </label>
          <label className="text-xs text-steel-muted">
            Discipline
            <Select value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
              {DISCIPLINES.map((d) => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
            </Select>
          </label>
          <div className="md:col-span-2 flex items-end justify-end gap-2">
            <Button onClick={save} disabled={busy}>Save draft</Button>
            <Button onClick={publish} disabled={busy} variant="secondary">Publish to SharePoint</Button>
          </div>
        </div>
        {msg && <p className="text-xs text-ok">{msg}</p>}
      </Card>

      {/* 1. Header */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-steel-muted">1. Project header</h3>
          <div className="grid sm:grid-cols-2 gap-2">
            <Input placeholder="Project name" value={h.projectName || ""} onChange={(e) => updateHeader("projectName", e.target.value)} />
            <Input placeholder="Project manager" value={h.projectManager || ""} onChange={(e) => updateHeader("projectManager", e.target.value)} />
            <Input placeholder="Contractor / vendor" value={h.contractor || ""} onChange={(e) => updateHeader("contractor", e.target.value)} />
            <Input placeholder="Location" value={h.location || ""} onChange={(e) => updateHeader("location", e.target.value)} />
            <Input placeholder="Contract / PO ref" value={h.contractRef || ""} onChange={(e) => updateHeader("contractRef", e.target.value)} />
            <label className="text-xs text-steel-muted">
              Contract completion
              <Input type="date" value={toDateInput(h.contractCompletion)} onChange={(e) => updateHeader("contractCompletion", e.target.value)} />
            </label>
            <Input placeholder="Calendar hours" value={h.calendarHours || ""} onChange={(e) => updateHeader("calendarHours", e.target.value)} />
            <Input placeholder="Shift hours" type="number" value={h.shiftHours ?? 8} onChange={(e) => updateHeader("shiftHours", Number(e.target.value))} />
            <Input placeholder="Weather" value={h.weather || ""} onChange={(e) => updateHeader("weather", e.target.value)} />
            <Input placeholder="Report number" value={h.reportNumber || ""} onChange={(e) => updateHeader("reportNumber", e.target.value)} />
          </div>
        </Card>
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-steel-muted">Report cut-off + safety history</h3>
          <div className="grid sm:grid-cols-2 gap-2">
            <label className="text-xs text-steel-muted">Report date
              <Input type="date" value={toDateInput(h.reportDate)} onChange={(e) => updateHeader("reportDate", e.target.value)} />
            </label>
            <label className="text-xs text-steel-muted">Data date (cut-off)
              <Input type="date" value={toDateInput(h.dataDate)} onChange={(e) => updateHeader("dataDate", e.target.value)} />
            </label>
            <Input placeholder="AC certified to date (₹ Lakh)" type="number" value={h.acCertifiedToDate ?? 0} onChange={(e) => updateHeader("acCertifiedToDate", Number(e.target.value))} />
            <Input placeholder="Cum man-days upto prev." type="number" value={h.cumManDaysPrev ?? 0} onChange={(e) => updateHeader("cumManDaysPrev", Number(e.target.value))} />
            <Input placeholder="Cum safe man-hours upto prev." type="number" value={h.cumSafeManHoursPrev ?? 0} onChange={(e) => updateHeader("cumSafeManHoursPrev", Number(e.target.value))} />
            <label className="text-xs text-steel-muted">Date of last LTI
              <Input type="date" value={toDateInput(h.dateOfLastLti)} onChange={(e) => updateHeader("dateOfLastLti", e.target.value)} />
            </label>
            <Input placeholder="Prepared by" value={h.preparedBy || ""} onChange={(e) => updateHeader("preparedBy", e.target.value)} className="sm:col-span-2" />
          </div>
        </Card>
      </div>

      {/* KPI band */}
      {computed && (
        <Card>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-steel-muted mb-2">Live KPIs</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 text-sm">
            <KPI label="Planned %" value={(computed.plannedPct * 100).toFixed(1) + "%"} />
            <KPI label="Actual %" value={(computed.actualPct * 100).toFixed(1) + "%"} />
            <KPI label="Variance" value={(computed.variance * 100).toFixed(1) + "%"} tone={computed.variance >= 0 ? "ok" : "warn"} />
            <KPI label="SPI" value={computed.spi.toFixed(2)} tone={computed.spi >= 1 ? "ok" : "warn"} />
            <KPI label="Earned value ₹ L" value={computed.earnedValueLakh.toFixed(2)} />
            <KPI label="Man-days today" value={computed.manDaysToday.toFixed(1)} />
            <KPI label="Hrs lost today" value={computed.hoursLostToday.toFixed(1)} tone={computed.hoursLostToday > 0 ? "warn" : "ok"} />
          </div>
          <p className="text-xs text-steel-muted mt-2">Contract value ~ ₹ {computed.contractValueLakh.toFixed(2)} Lakh · Overall {computed.actualPct >= computed.plannedPct ? "ON PROGRAMME" : "BEHIND PROGRAMME"}.</p>
        </Card>
      )}

      {/* 2. Quantity */}
      <Card padding={false}>
        <div className="flex items-center justify-between p-3 border-b border-line bg-sand/40">
          <h3 className="text-sm font-semibold uppercase tracking-widest">2. Quantity progress · BOQ item-wise</h3>
          <Button variant="secondary" onClick={addLine}>+ Add item</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sand/40 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="p-2 w-8">Sr</th>
                <th className="p-2">Group</th>
                <th className="p-2">Description</th>
                <th className="p-2">Unit</th>
                <th className="p-2">Scope</th>
                <th className="p-2">Rate</th>
                <th className="p-2">Start</th>
                <th className="p-2">Finish</th>
                <th className="p-2">Cum prev</th>
                <th className="p-2">Qty today</th>
                <th className="p-2">Cum</th>
                <th className="p-2">%</th>
                <th className="p-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {snap.lines.map((l, i) => {
                const c = computed?.rows[i];
                return (
                  <tr key={i} className="border-t border-line">
                    <td className="p-1.5 text-xs">{i + 1}</td>
                    <td className="p-1"><Input value={l.group || ""} onChange={(e) => updateLine(i, { group: e.target.value })} className="max-w-[80px]" /></td>
                    <td className="p-1"><Input value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} /></td>
                    <td className="p-1"><Input value={l.unit || ""} onChange={(e) => updateLine(i, { unit: e.target.value })} className="max-w-[80px]" /></td>
                    <td className="p-1"><Input type="number" value={l.scopeQty ?? 0} onChange={(e) => updateLine(i, { scopeQty: Number(e.target.value) })} className="max-w-[110px]" /></td>
                    <td className="p-1"><Input type="number" value={l.rate ?? 0} onChange={(e) => updateLine(i, { rate: Number(e.target.value) })} className="max-w-[110px]" /></td>
                    <td className="p-1"><Input type="date" value={toDateInput(l.start)} onChange={(e) => updateLine(i, { start: e.target.value })} /></td>
                    <td className="p-1"><Input type="date" value={toDateInput(l.finish)} onChange={(e) => updateLine(i, { finish: e.target.value })} /></td>
                    <td className="p-1"><Input type="number" value={l.cumQtyPrev ?? 0} onChange={(e) => updateLine(i, { cumQtyPrev: Number(e.target.value) })} className="max-w-[110px]" /></td>
                    <td className="p-1"><Input type="number" value={l.qtyToday ?? 0} onChange={(e) => updateLine(i, { qtyToday: Number(e.target.value) })} className="max-w-[100px]" /></td>
                    <td className="p-1.5 text-xs tabular-nums">{(c?.cum ?? 0).toFixed(2)}</td>
                    <td className="p-1.5 text-xs tabular-nums">{c ? (c.pctComplete * 100).toFixed(1) + "%" : "—"}</td>
                    <td className="p-1.5 text-danger cursor-pointer text-xs" onClick={() => removeLine(i)}>✕</td>
                  </tr>
                );
              })}
              {!snap.lines.length && (
                <tr>
                  <td colSpan={13} className="p-6 text-center text-steel-muted text-sm">
                    No BOQ items yet. Click <b>+ Add item</b>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 3. Manpower */}
      <Card padding={false}>
        <div className="flex items-center justify-between p-3 border-b border-line bg-sand/40">
          <h3 className="text-sm font-semibold uppercase tracking-widest">3. Manpower deployed today</h3>
          <Button variant="secondary" onClick={addManpower}>+ Trade</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sand/40 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="p-2 w-8">Sr</th>
                <th className="p-2 text-left">Trade / category</th>
                <th className="p-2">Planned nos</th>
                <th className="p-2">Actual nos</th>
                <th className="p-2">Hours</th>
                <th className="p-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {snap.manpower.map((m, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="p-1.5 text-xs">{i + 1}</td>
                  <td className="p-1"><Input value={m.trade} onChange={(e) => updateManpower(i, { trade: e.target.value })} /></td>
                  <td className="p-1"><Input type="number" value={m.planned ?? 0} onChange={(e) => updateManpower(i, { planned: Number(e.target.value) })} className="max-w-[110px]" /></td>
                  <td className="p-1"><Input type="number" value={m.actual ?? 0} onChange={(e) => updateManpower(i, { actual: Number(e.target.value) })} className="max-w-[110px]" /></td>
                  <td className="p-1"><Input type="number" step="0.25" value={m.hoursWorked ?? 8} onChange={(e) => updateManpower(i, { hoursWorked: Number(e.target.value) })} className="max-w-[90px]" /></td>
                  <td className="p-1.5 text-danger cursor-pointer text-xs" onClick={() => removeManpower(i)}>✕</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 4. Equipment */}
      <Card padding={false}>
        <div className="flex items-center justify-between p-3 border-b border-line bg-sand/40">
          <h3 className="text-sm font-semibold uppercase tracking-widest">4. Equipment deployed today</h3>
          <Button variant="secondary" onClick={addEquip}>+ Equipment</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sand/40 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="p-2 w-8">Sr</th>
                <th className="p-2 text-left">Equipment</th>
                <th className="p-2">Qty</th>
                <th className="p-2">Worked hrs</th>
                <th className="p-2">Idle hrs</th>
                <th className="p-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {snap.equipment.map((e, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="p-1.5 text-xs">{i + 1}</td>
                  <td className="p-1"><Input value={e.name} onChange={(ev) => updateEquip(i, { name: ev.target.value })} /></td>
                  <td className="p-1"><Input type="number" value={e.qty ?? 0} onChange={(ev) => updateEquip(i, { qty: Number(ev.target.value) })} className="max-w-[100px]" /></td>
                  <td className="p-1"><Input type="number" step="0.25" value={e.workedHrs ?? 0} onChange={(ev) => updateEquip(i, { workedHrs: Number(ev.target.value) })} className="max-w-[110px]" /></td>
                  <td className="p-1"><Input type="number" step="0.25" value={e.idleHrs ?? 0} onChange={(ev) => updateEquip(i, { idleHrs: Number(ev.target.value) })} className="max-w-[110px]" /></td>
                  <td className="p-1.5 text-danger cursor-pointer text-xs" onClick={() => removeEquip(i)}>✕</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 5. Material */}
      <Card padding={false}>
        <div className="flex items-center justify-between p-3 border-b border-line bg-sand/40">
          <h3 className="text-sm font-semibold uppercase tracking-widest">5. Material at site</h3>
          <Button variant="secondary" onClick={addMat}>+ Material</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sand/40 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="p-2 w-8">Sr</th>
                <th className="p-2 text-left">Material</th>
                <th className="p-2">Unit</th>
                <th className="p-2">Opening</th>
                <th className="p-2">Received</th>
                <th className="p-2">Consumed</th>
                <th className="p-2">Closing</th>
                <th className="p-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {snap.materials.map((m, i) => {
                const closing = num(m.opening) + num(m.received) - num(m.consumed);
                return (
                  <tr key={i} className="border-t border-line">
                    <td className="p-1.5 text-xs">{i + 1}</td>
                    <td className="p-1"><Input value={m.name} onChange={(e) => updateMat(i, { name: e.target.value })} /></td>
                    <td className="p-1"><Input value={m.unit || ""} onChange={(e) => updateMat(i, { unit: e.target.value })} className="max-w-[80px]" /></td>
                    <td className="p-1"><Input type="number" value={m.opening ?? 0} onChange={(e) => updateMat(i, { opening: Number(e.target.value) })} className="max-w-[110px]" /></td>
                    <td className="p-1"><Input type="number" value={m.received ?? 0} onChange={(e) => updateMat(i, { received: Number(e.target.value) })} className="max-w-[110px]" /></td>
                    <td className="p-1"><Input type="number" value={m.consumed ?? 0} onChange={(e) => updateMat(i, { consumed: Number(e.target.value) })} className="max-w-[110px]" /></td>
                    <td className="p-1.5 text-xs tabular-nums">{closing.toFixed(2)}</td>
                    <td className="p-1.5 text-danger cursor-pointer text-xs" onClick={() => removeMat(i)}>✕</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 6. Safety */}
      <Card>
        <h3 className="text-sm font-semibold uppercase tracking-widest text-steel-muted mb-2">6. Safety snapshot today</h3>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-2">
          <SafetyField label="Safe man-hours today" value={s.safeManHoursToday || 0} onChange={(v) => updateSafety("safeManHoursToday", v)} />
          <SafetyField label="Safe man-days today" value={s.safeManDaysToday || 0} onChange={(v) => updateSafety("safeManDaysToday", v)} />
          <SafetyField label="Toolbox talks" value={s.toolboxTalks || 0} onChange={(v) => updateSafety("toolboxTalks", v)} />
          <SafetyField label="PPE compliance %" value={s.ppeCompliancePct || 0} onChange={(v) => updateSafety("ppeCompliancePct", v)} />
          <SafetyField label="Near-miss" value={s.nearMiss || 0} onChange={(v) => updateSafety("nearMiss", v)} />
          <SafetyField label="First-aid" value={s.firstAid || 0} onChange={(v) => updateSafety("firstAid", v)} />
          <SafetyField label="LTIs" value={s.ltis || 0} onChange={(v) => updateSafety("ltis", v)} />
          <SafetyField label="Other incidents" value={s.incidents || 0} onChange={(v) => updateSafety("incidents", v)} />
        </div>
      </Card>

      {/* 7. Delay */}
      <Card padding={false}>
        <div className="flex items-center justify-between p-3 border-b border-line bg-sand/40">
          <h3 className="text-sm font-semibold uppercase tracking-widest">7. Delay / idle time log today</h3>
          <Button variant="secondary" onClick={addDelay}>+ Delay</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sand/40 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="p-2 w-8">Sr</th>
                <th className="p-2 text-left">Cause / category</th>
                <th className="p-2">From</th>
                <th className="p-2">To</th>
                <th className="p-2">Hrs lost</th>
                <th className="p-2">EOT</th>
                <th className="p-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {snap.delays.map((d, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="p-1.5 text-xs">{i + 1}</td>
                  <td className="p-1"><Input value={d.cause} onChange={(e) => updateDelay(i, { cause: e.target.value })} /></td>
                  <td className="p-1"><Input type="time" value={d.from || ""} onChange={(e) => updateDelay(i, { from: e.target.value })} className="max-w-[110px]" /></td>
                  <td className="p-1"><Input type="time" value={d.to || ""} onChange={(e) => updateDelay(i, { to: e.target.value })} className="max-w-[110px]" /></td>
                  <td className="p-1"><Input type="number" step="0.25" value={d.hoursLost ?? 0} onChange={(e) => updateDelay(i, { hoursLost: Number(e.target.value) })} className="max-w-[100px]" /></td>
                  <td className="p-1">
                    <Select value={d.eot || "No"} onChange={(e) => updateDelay(i, { eot: (e.target.value as "Yes" | "No") })} className="max-w-[80px]">
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </Select>
                  </td>
                  <td className="p-1.5 text-danger cursor-pointer text-xs" onClick={() => removeDelay(i)}>✕</td>
                </tr>
              ))}
              {!snap.delays.length && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-xs text-steel-muted">
                    No delays logged today. Click <b>+ Delay</b> when there is idle time to record.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 8. Photos */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-steel-muted">8. Site photos</h3>
          <span className="text-xs text-steel-muted">Saved to SharePoint → <span className="font-mono">07.02_Daily_Site_Records/{discipline}/photos/</span></span>
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          <Input placeholder="Caption (optional)" value={photoCaption} onChange={(e) => setPhotoCaption(e.target.value)} className="sm:col-span-2" />
          <label className="text-xs text-steel-muted">
            {uploadingPhoto ? "Uploading…" : "Take / choose photo"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={uploadPhoto}
              className="block mt-1 text-xs"
              disabled={uploadingPhoto}
            />
          </label>
        </div>
        {snap.photos.length > 0 && (
          <ul className="mt-2 text-xs divide-y">
            {snap.photos.map((p, i) => (
              <li key={i} className="py-2 flex justify-between gap-2 items-center">
                <div className="min-w-0">
                  <div className="font-mono truncate">{p.path}</div>
                  {p.caption && <div className="text-steel-muted">{p.caption}</div>}
                  {p.takenAt && <div className="text-steel-muted text-[10px]">{new Date(p.takenAt).toLocaleString("en-IN")}</div>}
                </div>
                <button className="text-danger text-sm" onClick={() => removePhoto(i)} title="Remove">✕</button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {recent.length > 0 && (
        <Card>
          <h3 className="font-semibold mb-2">Recent DPRs</h3>
          <ul className="text-sm divide-y">
            {recent.map((r) => (
              <li key={r.id} className="py-1.5 flex justify-between items-center">
                <span className="font-mono text-xs">{new Date(r.logDate).toISOString().slice(0, 10)} · {r.discipline}</span>
                <span>
                  <Badge tone={r.status === "Published" ? "ok" : "warn"}>{r.status}</Badge>
                  {r.publishedPath && (
                    <span className="text-xs text-steel-muted ml-2 truncate max-w-[280px] inline-block align-middle">
                      {r.publishedPath}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function KPI({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className={`rounded-lg border ${tone === "warn" ? "border-warn/40 bg-warn/5" : tone === "ok" ? "border-ok/40 bg-ok/5" : "border-line bg-white"} p-2`}>
      <div className="text-[10px] uppercase tracking-widest text-steel-muted">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function SafetyField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="text-xs text-steel-muted block">
      {label}
      <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
