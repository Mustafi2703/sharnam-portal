import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  type SheetCell,
  colLetter,
  isFormula,
  cellEditValue,
  cellPreview,
  evaluateAllRows,
  normalizeCell,
} from "@sharnam/shared";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Input, PageHeader, Select } from "../components/ui";
import { FilePickButton } from "../components/FilePickButton";

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

  async function createBlank() {
    try {
      const r = await api<{ id: string; name: string }>("/api/custom-sheets/blank", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: name || `Untitled sheet — ${new Date().toISOString().slice(0, 10)}`,
          category,
          projectId: pickedProject || undefined,
        }),
      });
      setMsg(`Blank sheet created — ${r.name}`);
      setName("");
      await load();
      nav(`/custom-sheets/${r.id}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Create failed");
    }
  }

  return (
    <div className="maker-shell space-y-6">
      <PageHeader
        eyebrow="Sheet Maker"
        title="Upload · edit · export any Excel or CSV"
        subtitle="Payment summaries, comparative statements, ISO checklists, progress sheets — edit in-portal with Excel formulas, export back to .xlsx."
      />
      {msg && <p className="maker-flash maker-flash--ok">{msg}</p>}

      {canWrite && (
        <div className="maker-upload-grid">
          <div className="maker-section">
            <div className="maker-section__head">Upload Excel / CSV</div>
            <form onSubmit={upload} className="maker-section__body space-y-3">
              <Input placeholder="Sheet name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
              <Select value={pickedProject} onChange={(e) => setPickedProject(e.target.value)}>
                <option value="">Global (no project)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </Select>
              <FilePickButton
                accept=".xlsx,.xls,.csv"
                onPick={(files) => setFile(files[0] || null)}
              >
                {file ? file.name : "Choose file (.xlsx / .csv)"}
              </FilePickButton>
              <Button type="submit" disabled={!file} className="w-full sm:w-auto">Upload & parse</Button>
            </form>
          </div>
          <div className="maker-section">
            <div className="maker-section__head">Blank sheet</div>
            <div className="maker-section__body space-y-3">
              <p className="text-sm text-steel-muted leading-relaxed">
                Start with 3 columns — add rows, type values or formulas (e.g. <code className="maker-code">=A2+B2</code>, <code className="maker-code">=SUM(C2:C10)</code>).
              </p>
              <Input placeholder="Sheet name" value={name} onChange={(e) => setName(e.target.value)} />
              <Button type="button" variant="secondary" onClick={createBlank}>Create blank sheet</Button>
            </div>
          </div>
        </div>
      )}

      <div className="maker-section maker-section--flush">
        <div className="maker-section__head maker-section__head--row">
          <span>Your sheets{pickedProject ? " · project scope" : ""}</span>
          <span className="maker-section__meta">{sheets.length} sheet(s)</span>
        </div>
        <ul className="maker-list">
          {sheets.map((s) => (
            <li key={s.id} className="maker-list__row">
              <div className="min-w-0">
                <div className="maker-list__title">{s.name}</div>
                <div className="maker-list__sub">
                  {s.category || "General"} · {s.headers?.length || 0} cols · {new Date(s.updatedAt).toLocaleString("en-IN")}
                </div>
              </div>
              <Link to={`/custom-sheets/${s.id}`}>
                <Button type="button">Open editor</Button>
              </Link>
            </li>
          ))}
          {!sheets.length && <li className="maker-list__empty">No custom sheets yet — upload or create one above.</li>}
        </ul>
      </div>
    </div>
  );
}

/* ─── The editor page ─── */

export function CustomSheetEditorPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const canWrite = ["admin", "office"].includes(user?.role || "");
  const [sheet, setSheet] = useState<{ name: string; headers: string[]; rows: SheetCell[][]; category?: string } | null>(null);
  const [msg, setMsg] = useState("");

  const load = async () => {
    if (!id) return;
    const s = await api<any>(`/api/custom-sheets/${id}`, { token });
    const rows = evaluateAllRows(
      (s.rows || []).map((row: unknown[]) => row.map((cell) => normalizeCell(cell)))
    );
    setSheet({ name: s.name, headers: s.headers, rows, category: s.category });
  };
  useEffect(() => {
    void load();
  }, [id, token]);

  function setCell(rowIdx: number, colIdx: number, value: string) {
    setSheet((prev) => {
      if (!prev) return prev;
      const rows = prev.rows.map((r) => r.map((c) => ({ ...c })));
      rows[rowIdx][colIdx] = { raw: value };
      return { ...prev, rows: evaluateAllRows(rows) };
    });
  }
  function addRow() {
    setSheet((prev) =>
      prev ? { ...prev, rows: [...prev.rows, prev.headers.map(() => ({ raw: "" }))] } : prev
    );
  }
  function delRow(idx: number) {
    setSheet((prev) => {
      if (!prev) return prev;
      const rows = prev.rows.slice();
      rows.splice(idx, 1);
      return { ...prev, rows: evaluateAllRows(rows) };
    });
  }
  function addColumn() {
    setSheet((prev) => {
      if (!prev) return prev;
      const nextHeaderName = `Column ${prev.headers.length + 1}`;
      const headers = [...prev.headers, nextHeaderName];
      const rows = prev.rows.map((r) => [...r, { raw: "" }]);
      return { ...prev, headers, rows: evaluateAllRows(rows) };
    });
  }
  function renameColumn(idx: number, name: string) {
    setSheet((prev) => {
      if (!prev) return prev;
      const headers = prev.headers.slice();
      headers[idx] = name;
      return { ...prev, headers };
    });
  }
  function delColumn(idx: number) {
    setSheet((prev) => {
      if (!prev) return prev;
      const headers = prev.headers.filter((_h, i) => i !== idx);
      const rows = prev.rows.map((r) => r.filter((_c, i) => i !== idx));
      return { ...prev, headers, rows: evaluateAllRows(rows) };
    });
  }

  const formulaCount = useMemo(
    () => sheet?.rows.flat().filter((c) => isFormula(c.raw)).length ?? 0,
    [sheet]
  );

  async function save() {
    if (!id || !sheet) return;
    const rows = evaluateAllRows(sheet.rows);
    await api(`/api/custom-sheets/${id}`, {
      method: "PUT",
      token,
      body: JSON.stringify({ headers: sheet.headers, rows, name: sheet.name }),
    });
    setSheet((prev) => (prev ? { ...prev, rows } : prev));
    setMsg(`Saved${formulaCount ? ` · ${formulaCount} formula(s)` : ""}.`);
  }
  async function download() {
    if (!id || !sheet) return;
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

  const hasRows = (sheet?.rows.length ?? 0) > 0;

  return (
    <div className="maker-shell space-y-4 pb-24">
      <PageHeader
        eyebrow="Sheet editor"
        title={sheet?.name || "Loading…"}
        subtitle={
          sheet
            ? `${sheet.headers.length} columns · ${sheet.rows.length} rows · ${formulaCount} formula(s) · ${sheet.category || "General"}`
            : ""
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/custom-sheets"><Button type="button" variant="secondary">Back</Button></Link>
            {canWrite && sheet && <Button type="button" variant="secondary" onClick={addRow}>+ Row</Button>}
            {canWrite && sheet && <Button type="button" variant="secondary" onClick={addColumn}>+ Column</Button>}
          </div>
        }
      />
      {msg && <p className="maker-flash maker-flash--ok">{msg}</p>}
      {sheet && (
        <div className="maker-formula-help">
          <strong>Formulas</strong>
          <span>
            Type Excel-style formulas starting with <code>=</code> — e.g.{" "}
            <code>=A2+B2</code>, <code>=C2*D2</code>, <code>=SUM(E2:E20)</code>,{" "}
            <code>=AVERAGE(B2:B10)</code>. Row 1 is headers; first data row is row 2. Export writes live formulas to .xlsx.
          </span>
        </div>
      )}
      {!sheet ? (
        <div className="maker-section"><div className="maker-section__body">Loading…</div></div>
      ) : (
        <div className="maker-section maker-section--flush">
          <div className="maker-section__head">Spreadsheet</div>
          <div className="maker-table-wrap">
            <table className="maker-table">
              <thead>
                <tr className="bg-sand/50 text-left align-top">
                  <th className="px-2 py-1 w-6">#</th>
                  {sheet.headers.map((h: string, i: number) => (
                    <th key={i} className="px-2 py-1 font-semibold whitespace-nowrap">
                      <div className="maker-table__col-ref">{colLetter(i)}</div>
                      {canWrite ? (
                        <div className="flex flex-col gap-1">
                          <input
                            className="maker-table__head-input"
                            value={h}
                            onChange={(e) => renameColumn(i, e.target.value)}
                          />
                          <button
                            type="button"
                            className="maker-table__remove-col"
                            onClick={() => delColumn(i)}
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <span>{h}</span>
                      )}
                    </th>
                  ))}
                  {canWrite && <th></th>}
                </tr>
              </thead>
              <tbody>
                {sheet.rows.map((row: SheetCell[], ri: number) => (
                  <tr key={ri} className="border-t border-line">
                    <td className="px-2 py-0.5 text-steel-muted">{ri + 2}</td>
                    {sheet.headers.map((_h: string, ci: number) => {
                      const cell = row[ci] ?? { raw: "" };
                      const formula = isFormula(cell.raw);
                      return (
                        <td key={ci} className="px-1 py-0.5 align-top">
                          <input
                            className={`maker-table__cell${formula ? " maker-table__cell--formula" : ""}`}
                            value={cellEditValue(cell)}
                            onChange={(e) => setCell(ri, ci, e.target.value)}
                            disabled={!canWrite}
                            spellCheck={false}
                            title={formula ? `Result: ${cellPreview(cell)}` : undefined}
                          />
                          {formula && (
                            <div className="maker-table__cell-result" title="Calculated preview">
                              = {cellPreview(cell)}
                            </div>
                          )}
                        </td>
                      );
                    })}
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
        </div>
      )}
      {sheet && (
        <div className="maker-sticky-bar">
          {canWrite && <Button type="button" onClick={() => void save()} disabled={!sheet}>Save</Button>}
          <Button type="button" variant="secondary" onClick={() => void download()}>Export .xlsx</Button>
        </div>
      )}
    </div>
  );
}
