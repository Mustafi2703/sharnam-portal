import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, Select } from "../components/ui";

/**
 * Custom Sheet Maker — upload any Excel/CSV, we parse it and let you edit it in-portal.
 * Optional project-scoped storage so the raw file is also kept in SharePoint (12.08 audit trail).
 */
export default function CustomSheetsPage() {
  const { token, user } = useAuth();
  const canWrite = ["admin", "office"].includes(user?.role || "");
  const [search] = useSearchParams();
  const nav = useNavigate();
  const projectId = search.get("projectId") || undefined;

  const [sheets, setSheets] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("General");
  const [file, setFile] = useState<File | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [pickedProject, setPickedProject] = useState(projectId || "");

  const load = async () => {
    const rows = await api<any[]>(`/api/custom-sheets${pickedProject ? `?projectId=${pickedProject}` : ""}`, { token });
    setSheets(rows);
  };
  useEffect(() => {
    void load();
    api<any[]>("/api/projects", { token }).then(setProjects).catch(() => setProjects([]));
  }, [token, pickedProject]);

  async function upload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", name || file.name);
    fd.append("category", category);
    if (pickedProject) fd.append("projectId", pickedProject);
    try {
      const r = await api<{ id: string; name: string; rowCount: number }>("/api/custom-sheets/upload", { method: "POST", token, body: fd });
      setMsg(`Uploaded — ${r.rowCount} rows imported.`);
      setName("");
      setFile(null);
      await load();
      nav(`/custom-sheets/${r.id}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Custom Sheet Maker"
        title="Upload · edit · export any Excel or CSV"
        subtitle="Bring any format (Payment Summary, Comparative Statement, ISO checklist, monthly progress…) into the portal. Edit in-place. Export back to Excel. Audit-trailed."
      />
      {msg && <p className="text-sm text-brand-dark">{msg}</p>}

      {canWrite && (
        <Card>
          <h3 className="font-semibold text-sm mb-2">Upload a sheet</h3>
          <form onSubmit={upload} className="grid md:grid-cols-4 gap-2">
            <Input placeholder="Sheet name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
            <Select value={pickedProject} onChange={(e) => setPickedProject(e.target.value)}>
              <option value="">Global (no project)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </Select>
            <label className="text-xs text-steel-muted">
              File (.xlsx / .xls / .csv)
              <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block mt-1 text-xs" />
            </label>
            <Button type="submit" className="md:col-span-4" disabled={!file}>Upload & parse</Button>
          </form>
        </Card>
      )}

      <Card padding={false}>
        <div className="px-4 py-3 border-b border-line bg-sand/40 flex justify-between">
          <span className="font-semibold text-sm">Sheets{pickedProject ? " · project scope" : " · global"}</span>
          <span className="text-[11px] text-steel-muted">{sheets.length} sheet(s)</span>
        </div>
        <ul className="divide-y">
          {sheets.map((s) => (
            <li key={s.id} className="px-4 py-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">{s.name}</div>
                <div className="text-xs text-steel-muted">
                  {s.category || "General"} · {s.headers?.length || 0} columns · {new Date(s.updatedAt).toLocaleString("en-IN")}
                  {s.sourceFile && <> · <span className="font-mono">{s.sourceFile}</span></>}
                </div>
              </div>
              <div className="flex gap-2">
                <Link to={`/custom-sheets/${s.id}`}>
                  <Button type="button" variant="secondary">Open</Button>
                </Link>
              </div>
            </li>
          ))}
          {!sheets.length && <li className="px-4 py-6 text-center text-sm text-steel-muted">No custom sheets yet.</li>}
        </ul>
      </Card>
    </div>
  );
}

/* ─── The editor page ─── */

export function CustomSheetEditorPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const canWrite = ["admin", "office"].includes(user?.role || "");
  const [sheet, setSheet] = useState<any | null>(null);
  const [msg, setMsg] = useState("");

  const load = async () => {
    if (!id) return;
    const s = await api<any>(`/api/custom-sheets/${id}`, { token });
    setSheet(s);
  };
  useEffect(() => {
    void load();
  }, [id, token]);

  function setCell(rowIdx: number, colIdx: number, value: string) {
    setSheet((prev: any) => {
      if (!prev) return prev;
      const rows = prev.rows.map((r: any[]) => [...r]);
      rows[rowIdx][colIdx] = value;
      return { ...prev, rows };
    });
  }
  function addRow() {
    setSheet((prev: any) => (prev ? { ...prev, rows: [...prev.rows, prev.headers.map(() => "")] } : prev));
  }
  function delRow(idx: number) {
    setSheet((prev: any) => {
      if (!prev) return prev;
      const rows = prev.rows.slice();
      rows.splice(idx, 1);
      return { ...prev, rows };
    });
  }

  async function save() {
    if (!id || !sheet) return;
    await api(`/api/custom-sheets/${id}`, {
      method: "PUT",
      token,
      body: JSON.stringify({ headers: sheet.headers, rows: sheet.rows, name: sheet.name }),
    });
    setMsg("Saved.");
  }
  async function download() {
    if (!id) return;
    const res = await fetch(`/api/custom-sheets/${id}/export`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setMsg("Export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sheet.name || "sheet"}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const hasRows = sheet?.rows?.length > 0;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Custom sheet"
        title={sheet?.name || "Loading…"}
        subtitle={
          sheet
            ? `${sheet.headers.length} columns · ${sheet.rows.length} rows · category ${sheet.category || "General"}`
            : ""
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/custom-sheets"><Button type="button" variant="secondary">Back</Button></Link>
            {canWrite && sheet && <Button type="button" variant="secondary" onClick={addRow}>+ Row</Button>}
            {canWrite && <Button type="button" onClick={() => void save()}>Save</Button>}
            <Button type="button" variant="secondary" onClick={() => void download()}>Export .xlsx</Button>
          </div>
        }
      />
      {msg && <p className="text-sm text-ok">{msg}</p>}
      {!sheet ? (
        <Card>Loading…</Card>
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr className="bg-sand/50 text-left">
                  <th className="px-2 py-1 w-6">#</th>
                  {sheet.headers.map((h: string, i: number) => (
                    <th key={i} className="px-2 py-1 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                  {canWrite && <th></th>}
                </tr>
              </thead>
              <tbody>
                {sheet.rows.map((row: any[], ri: number) => (
                  <tr key={ri} className="border-t border-line">
                    <td className="px-2 py-0.5 text-steel-muted">{ri + 1}</td>
                    {sheet.headers.map((_h: string, ci: number) => (
                      <td key={ci} className="px-1 py-0.5">
                        <input
                          className="w-full bg-transparent focus:bg-white focus:ring-1 focus:ring-brand/40 rounded px-1"
                          value={row[ci] ?? ""}
                          onChange={(e) => setCell(ri, ci, e.target.value)}
                          disabled={!canWrite}
                        />
                      </td>
                    ))}
                    {canWrite && (
                      <td className="px-1 py-0.5">
                        <button type="button" className="text-danger text-[10px]" onClick={() => delRow(ri)}>×</button>
                      </td>
                    )}
                  </tr>
                ))}
                {!hasRows && (
                  <tr>
                    <td colSpan={sheet.headers.length + 2} className="text-center text-steel-muted py-6">
                      No rows.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
