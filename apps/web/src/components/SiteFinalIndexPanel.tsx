/**
 * Site / Final Drawing Index master — global list of planned drawings the PMC
 * picks from when building the project drawing index.  Seeds ~20 typical
 * civil / MEP / PEB / as-built drawings; supports XLSX upload + branded
 * download (HTML print + XLSX).
 */
import { FormEvent, useEffect, useState } from "react";
import { api, apiBase } from "../api";
import { Badge, Button, Card, Input, Select } from "./ui";

type IndexRow = {
  id: string;
  srNo: number;
  drawingNo: string;
  title: string;
  discipline: string;
  stage: string;
  status: string;
  packageHint?: string | null;
  notes?: string | null;
};

const DISCIPLINES = ["Architectural", "Structural", "Landscape", "Electrical", "Plumbing", "Fire", "HVAC", "MEP", "PEB", "Other"];
const STAGES = ["Concept", "Design", "GFC", "Issued", "As-built"];
const STATUSES = ["Planned", "Issued", "GFC", "As-built", "Pending"];

type Props = { token?: string | null };

export function SiteFinalIndexPanel({ token }: Props) {
  const [rows, setRows] = useState<IndexRow[]>([]);
  const [form, setForm] = useState({ drawingNo: "", title: "", discipline: "Architectural", stage: "Design", status: "Planned", packageHint: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () =>
    api<IndexRow[]>("/api/master/site-index", { token })
      .then(setRows)
      .catch(() => setRows([]));

  useEffect(() => {
    void load();
  }, [token]);

  async function addRow(e: FormEvent) {
    e.preventDefault();
    if (!form.drawingNo.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      await api("/api/master/site-index", {
        method: "POST",
        token,
        body: JSON.stringify(form),
      });
      setForm({ drawingNo: "", title: "", discipline: form.discipline, stage: form.stage, status: "Planned", packageHint: form.packageHint });
      setMsg(`Added ${form.drawingNo.toUpperCase()}`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function seedDefaults() {
    if (!window.confirm("Seed the starter ~20 planned drawings (civil / MEP / PEB / as-built)? Existing rows are preserved.")) return;
    setBusy(true);
    setMsg("");
    try {
      const out = await api<{ created: number; skipped: number; total: number }>(
        "/api/master/site-index/seed-defaults",
        { method: "POST", token }
      );
      setMsg(`Master ready: ${out.created} added · ${out.skipped} already existed · ${out.total} in starter pack.`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Seed failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadXlsx(file: File) {
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${apiBase()}/api/master/site-index/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out?.error || "Upload failed");
      setMsg(`Imported: ${out.created} new · ${out.updated} updated · ${out.skipped} skipped.`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function openInfoSheet() {
    window.open(`${apiBase()}/api/master/site-index/download.html?token=${encodeURIComponent(token || "")}`, "_blank", "noopener");
  }

  async function downloadXlsx() {
    try {
      const res = await fetch(`${apiBase()}/api/master/site-index/download.xlsx`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Sharnam-Site-Final-Index.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Download failed");
    }
  }

  async function removeRow(id: string) {
    if (!window.confirm("Remove this drawing from the master?")) return;
    await api(`/api/master/site-index/${id}`, { method: "DELETE", token });
    await load();
  }

  return (
    <Card className="sm:col-span-2 xl:col-span-3 !p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">Site / Final drawing index master</h2>
          <p className="text-sm text-steel-muted mt-1">
            Global drawing register — the list of planned drawings the PMC works from. Each project picks the
            relevant subset so nothing gets missed. Seeded with a starter civil / MEP / PEB / as-built pack.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void seedDefaults()}>
            {rows.length ? "Refresh starter pack" : "Seed starter pack"}
          </Button>
          <Button type="button" variant="secondary" disabled={!rows.length} onClick={openInfoSheet}>
            Print info sheet
          </Button>
          <Button type="button" variant="secondary" disabled={!rows.length} onClick={() => void downloadXlsx()}>
            Download .xlsx
          </Button>
          <label className="inline-flex items-center gap-2 text-xs text-steel-muted border border-line rounded-sm px-2 py-1 cursor-pointer">
            Upload .xlsx
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadXlsx(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {msg && <p className="text-sm text-brand bg-brand-soft px-3 py-2 rounded-sm">{msg}</p>}

      <form className="grid sm:grid-cols-2 lg:grid-cols-6 gap-2 items-end" onSubmit={addRow}>
        <Input
          required
          placeholder="Drawing No (STR-101)"
          value={form.drawingNo}
          onChange={(e) => setForm({ ...form, drawingNo: e.target.value.toUpperCase() })}
        />
        <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="lg:col-span-2" />
        <Select value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })}>
          {DISCIPLINES.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </Select>
        <Select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
          {STAGES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
        <Button type="submit" disabled={busy}>Add drawing</Button>
      </form>

      <div className="border border-line rounded-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase text-steel-muted">
            <tr>
              <th className="px-2 py-2">Sr</th>
              <th className="px-2 py-2">Drawing No</th>
              <th className="px-2 py-2">Title</th>
              <th className="px-2 py-2">Discipline</th>
              <th className="px-2 py-2">Stage</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Package</th>
              <th className="px-2 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-2 py-1.5 text-steel-muted">{r.srNo || "—"}</td>
                <td className="px-2 py-1.5 font-mono font-semibold">{r.drawingNo}</td>
                <td className="px-2 py-1.5">{r.title}</td>
                <td className="px-2 py-1.5">{r.discipline}</td>
                <td className="px-2 py-1.5">{r.stage}</td>
                <td className="px-2 py-1.5">
                  <Badge tone={r.status === "GFC" ? "ok" : r.status === "As-built" ? "brand" : "warn"}>{r.status}</Badge>
                </td>
                <td className="px-2 py-1.5 text-steel-muted text-xs">{r.packageHint || "—"}</td>
                <td className="px-2 py-1.5 text-right">
                  <Button type="button" variant="ghost" className="!text-xs" onClick={() => void removeRow(r.id)}>
                    Del
                  </Button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={8} className="px-2 py-6 text-center text-steel-muted">
                  Empty index — click <strong>Seed starter pack</strong> for the standard civil / MEP / PEB /
                  as-built list, or drop your own XLSX above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
