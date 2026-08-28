/**
 * Global BBS bend shape code library — maintained in Master → Global masters.
 */
import { FormEvent, useEffect, useState } from "react";
import { api, apiBase } from "../api";
import { Badge, Button, Card, Input, Select } from "./ui";

type ShapeMaster = {
  id: string;
  shapeCode: string;
  name?: string | null;
  description?: string | null;
  bendInfo?: string | null;
  packageHint?: string | null;
  parameters?: string | null;
  cutFormula?: string | null;
  standardRef?: string | null;
  diagramPath?: string | null;
  diagramUrl?: string | null;
};

const PACKAGE_HINTS = [
  "",
  "Dormitory BBS",
  "Compound Wall BBS",
  "Septic Tank BBS",
  "Road BBS",
  "UGWT BBS",
];

type Props = {
  token?: string | null;
};

function diagramHref(row: ShapeMaster) {
  const u = row.diagramUrl || row.diagramPath;
  if (!u) return "";
  if (u.startsWith("http")) return u;
  if (u.startsWith("/")) return `${apiBase()}${u}`;
  return `${apiBase()}/uploads/onedrive/${u}`;
}

export function BbsShapeMasterPanel({ token }: Props) {
  const [rows, setRows] = useState<ShapeMaster[]>([]);
  const [form, setForm] = useState({
    shapeCode: "",
    name: "",
    description: "",
    bendInfo: "",
    packageHint: "",
    parameters: "",
    cutFormula: "",
    standardRef: "",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [uploadId, setUploadId] = useState<string | null>(null);

  const load = () =>
    api<ShapeMaster[]>("/api/cost/shape-masters", { token })
      .then(setRows)
      .catch(() => setRows([]));

  useEffect(() => {
    void load();
  }, [token]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!form.shapeCode.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      await api("/api/cost/shape-masters", {
        method: "POST",
        token,
        body: JSON.stringify({
          shapeCode: form.shapeCode.trim().toUpperCase(),
          name: form.name || null,
          description: form.description || null,
          bendInfo: form.bendInfo || null,
          packageHint: form.packageHint || null,
          parameters: form.parameters || null,
          cutFormula: form.cutFormula || null,
          standardRef: form.standardRef || null,
        }),
      });
      setForm({ shapeCode: "", name: "", description: "", bendInfo: "", packageHint: "", parameters: "", cutFormula: "", standardRef: "" });
      setMsg("Shape code added");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function seedDefaults() {
    if (!window.confirm("Seed / refresh the 15 IS-2502 standard shapes? Existing diagrams stay intact — only names, parameters and formulas are refreshed.")) return;
    setBusy(true);
    setMsg("");
    try {
      const out = await api<{ created: number; updated: number; total: number }>("/api/cost/shape-masters/seed-defaults", {
        method: "POST",
        token,
      });
      setMsg(`Master ready: ${out.created} new · ${out.updated} refreshed · ${out.total} standard shapes in library.`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Seed failed");
    } finally {
      setBusy(false);
    }
  }

  function openInfoSheet() {
    window.open(`${apiBase()}/api/cost/shape-masters/download.html?token=${encodeURIComponent(token || "")}`, "_blank", "noopener");
  }

  async function downloadInfoXlsx() {
    try {
      const res = await fetch(`${apiBase()}/api/cost/shape-masters/download.xlsx`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Sharnam-BBS-Shape-Master.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Download failed");
    }
  }

  async function uploadDiagram(id: string, file: File) {
    setUploadId(id);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api(`/api/cost/shape-masters/${id}/diagram`, { method: "POST", token, body: fd });
      await load();
      setMsg("Diagram uploaded");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadId(null);
    }
  }

  async function removeRow(id: string) {
    if (!window.confirm("Delete this shape code from master?")) return;
    await api(`/api/cost/shape-masters/${id}`, { method: "DELETE", token });
    await load();
  }

  return (
    <Card className="sm:col-span-2 xl:col-span-3 !p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">BBS shape code master</h2>
          <p className="text-sm text-steel-muted mt-1">
            Master reference sheet for bar-bending shapes — code, parameters (A/B/C…), cutting-length formula and bend
            diagram. BBS rows pick a code and the portal auto-computes cutting length using the parameter values.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void seedDefaults()}>
            {rows.length ? "Refresh IS-2502 defaults" : "Seed 15 IS-2502 shapes"}
          </Button>
          <Button type="button" variant="secondary" onClick={openInfoSheet} disabled={!rows.length}>
            Print info sheet
          </Button>
          <Button type="button" variant="secondary" onClick={() => void downloadInfoXlsx()} disabled={!rows.length}>
            Download .xlsx
          </Button>
        </div>
      </div>

      {msg && <p className="text-sm text-brand bg-brand-soft px-3 py-2 rounded-sm">{msg}</p>}

      <form className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end" onSubmit={onAdd}>
        <Input
          required
          placeholder="Shape code (e.g. A, 01, L1)"
          value={form.shapeCode}
          onChange={(e) => setForm({ ...form, shapeCode: e.target.value })}
        />
        <Input placeholder="Shape name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Select value={form.packageHint} onChange={(e) => setForm({ ...form, packageHint: e.target.value })}>
          {PACKAGE_HINTS.map((p) => (
            <option key={p || "all"} value={p}>
              {p || "All packages"}
            </option>
          ))}
        </Select>
        <Input
          placeholder="Standard ref (IS-2502 · Type 12)"
          value={form.standardRef}
          onChange={(e) => setForm({ ...form, standardRef: e.target.value })}
        />
        <Input
          placeholder="Parameters (A,B,C — comma sep)"
          value={form.parameters}
          onChange={(e) => setForm({ ...form, parameters: e.target.value.toUpperCase() })}
        />
        <Input
          placeholder="Cutting length formula (A+B-d)"
          value={form.cutFormula}
          onChange={(e) => setForm({ ...form, cutFormula: e.target.value })}
        />
        <Input
          placeholder="Bend info (2 × 90° bends)"
          value={form.bendInfo}
          onChange={(e) => setForm({ ...form, bendInfo: e.target.value })}
        />
        <Button type="submit" disabled={busy}>
          Add shape
        </Button>
        <Input
          className="sm:col-span-2 lg:col-span-4"
          placeholder="Description / usage notes"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </form>

      <div className="border border-line rounded-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase text-steel-muted">
            <tr>
              <th className="px-3 py-2">Diagram</th>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Name · reference</th>
              <th className="px-3 py-2">Parameters</th>
              <th className="px-3 py-2">Cutting length formula</th>
              <th className="px-3 py-2">Bend info</th>
              <th className="px-3 py-2">Package</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const href = diagramHref(r);
              return (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="px-3 py-2">
                    <div className="w-16 h-12 rounded border border-line bg-paper flex items-center justify-center overflow-hidden">
                      {href ? (
                        <a href={href} target="_blank" rel="noreferrer">
                          <img src={href} alt={r.shapeCode} className="max-w-full max-h-full object-contain" />
                        </a>
                      ) : (
                        <span className="text-[9px] text-steel-muted text-center leading-tight px-1">
                          upload diagram
                        </span>
                      )}
                    </div>
                    <label className="block mt-1">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="text-[10px] w-16"
                        disabled={uploadId === r.id}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void uploadDiagram(r.id, f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </td>
                  <td className="px-3 py-2 font-mono font-semibold">{r.shapeCode}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.name || "—"}</div>
                    <div className="text-[10px] text-steel-muted italic">{r.standardRef || ""}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.parameters || "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.cutFormula || "—"}</td>
                  <td className="px-3 py-2 text-xs">{r.bendInfo || "—"}</td>
                  <td className="px-3 py-2 text-steel-muted text-xs">
                    {r.packageHint ? <Badge tone="neutral">{r.packageHint}</Badge> : <span className="text-[10px]">All</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button type="button" variant="ghost" className="!text-xs" onClick={() => void removeRow(r.id)}>
                      Del
                    </Button>
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-steel-muted">
                  Shape master is empty — click <strong>Seed 15 IS-2502 shapes</strong> to load the standard catalogue,
                  then upload your own bend diagrams per shape.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
