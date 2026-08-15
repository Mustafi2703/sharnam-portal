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
  const [form, setForm] = useState({ shapeCode: "", name: "", description: "", bendInfo: "", packageHint: "" });
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
        }),
      });
      setForm({ shapeCode: "", name: "", description: "", bendInfo: "", packageHint: "" });
      setMsg("Shape code added");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
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
      <div>
        <h2 className="font-display text-xl">BBS shape code master</h2>
        <p className="text-sm text-steel-muted mt-1">
          Information table: shape code + bend diagram. Project BBS rows pick by code — diagrams attach automatically on import or sync.
        </p>
      </div>

      {msg && <p className="text-sm text-brand bg-brand-soft px-3 py-2 rounded-sm">{msg}</p>}

      <form className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end" onSubmit={onAdd}>
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
          placeholder="Bend info (A×B×C notes)"
          value={form.bendInfo}
          onChange={(e) => setForm({ ...form, bendInfo: e.target.value })}
        />
        <Button type="submit" disabled={busy}>
          Add code
        </Button>
        <Input
          className="sm:col-span-2 lg:col-span-5"
          placeholder="Description / usage notes"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </form>

      <div className="border border-line rounded-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase text-steel-muted">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Package</th>
              <th className="px-3 py-2">Bend info</th>
              <th className="px-3 py-2">Diagram</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const href = diagramHref(r);
              return (
                <tr key={r.id} className="border-t border-line">
                  <td className="px-3 py-2 font-mono font-semibold">{r.shapeCode}</td>
                  <td className="px-3 py-2">{r.name || "—"}</td>
                  <td className="px-3 py-2 text-steel-muted text-xs">{r.packageHint || "All"}</td>
                  <td className="px-3 py-2 text-xs">{r.bendInfo || "—"}</td>
                  <td className="px-3 py-2">
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand text-xs font-medium">
                        View diagram
                      </a>
                    ) : (
                      <Badge tone="warn">No diagram</Badge>
                    )}
                    <label className="block mt-1">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="text-xs"
                        disabled={uploadId === r.id}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void uploadDiagram(r.id, f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </td>
                  <td className="px-3 py-2">
                    <Button type="button" variant="ghost" className="!text-xs" onClick={() => void removeRow(r.id)}>
                      Del
                    </Button>
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-steel-muted">
                  No shape codes yet — add codes your team uses on BBS sheets (A, 1, L-bar, etc.) and upload bend diagrams.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
