import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  type SheetCell,
  colLetter,
  isFormula,
  cellEditValue,
  cellPreview,
  evaluateAllRows,
  normalizeCell,
  SUPPORTED_FORMULAS,
} from "@sharnam/shared";
import { api, apiBase } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Input, PageHeader, Select } from "../components/ui";
import { FilePickButton } from "../components/FilePickButton";

const CATEGORIES = ["General", "MB / BBS", "Payment summary", "Comparative statement", "ISO checklist", "Progress", "Meeting"];

/**
 * Custom Sheet Maker — upload Excel/CSV, edit with formulas, export .xlsx to SharePoint.
 */
export default function CustomSheetsPage() {
  const { token, user } = useAuth();
  const canWrite = ["admin", "office", "employee"].includes(user?.role || "");
  const [search] = useSearchParams();
  const nav = useNavigate();
  const projectId = search.get("projectId") || undefined;

  const [sheets, setSheets] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [pickedProject, setPickedProject] = useState(projectId || "");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadCategory, setUploadCategory] = useState("General");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [sheetTabs, setSheetTabs] = useState<string[]>([]);
  const [pickedTab, setPickedTab] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [blankName, setBlankName] = useState("");

  const load = useCallback(async () => {
    const rows = await api<any[]>(`/api/custom-sheets${pickedProject ? `?projectId=${pickedProject}` : ""}`, { token });
    setSheets(rows);
  }, [token, pickedProject]);

  useEffect(() => {
    void load();
    api<any[]>("/api/projects", { token }).then(setProjects).catch(() => setProjects([]));
  }, [load, token]);

  async function previewSheets(file: File) {
    setUploadFile(file);
    setUploadName(file.name.replace(/\.(xlsx|xls|csv)$/i, ""));
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await api<{ sheets: string[] }>("/api/custom-sheets/preview-sheets", { method: "POST", token, body: fd });
      setSheetTabs(r.sheets || []);
      setPickedTab(r.sheets?.[0] || "");
    } catch {
      setSheetTabs([]);
      setPickedTab("");
    }
  }

  async function upload(e: FormEvent) {
    e.preventDefault();
    if (!uploadFile) return;
    setUploadBusy(true);
    setMsg("");
    const fd = new FormData();
    fd.append("file", uploadFile);
    fd.append("name", uploadName || uploadFile.name);
    fd.append("category", uploadCategory);
    if (pickedProject) fd.append("projectId", pickedProject);
    if (pickedTab) fd.append("sheet", pickedTab);
    try {
      const r = await api<{ id: string; rowCount: number; formulaCount: number }>("/api/custom-sheets/upload", {
        method: "POST",
        token,
        body: fd,
      });
      setMsg(`Uploaded — ${r.rowCount} rows · ${r.formulaCount} formula(s).`);
      setUploadOpen(false);
      setUploadFile(null);
      setSheetTabs([]);
      await load();
      nav(`/custom-sheets/${r.id}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  }

  async function createBlank() {
    try {
      const r = await api<{ id: string; name: string }>("/api/custom-sheets/blank", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: blankName || `Untitled sheet — ${new Date().toISOString().slice(0, 10)}`,
          category: uploadCategory,
          projectId: pickedProject || undefined,
        }),
      });
      setBlankName("");
      setMsg(`Blank sheet created — ${r.name}`);
      await load();
      nav(`/custom-sheets/${r.id}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function cloneSheet(id: string, name: string) {
    try {
      const r = await api<{ id: string }>(`/api/custom-sheets/${id}/clone`, {
        method: "POST",
        token,
        body: JSON.stringify({ name: `${name} (copy)`, projectId: pickedProject || undefined }),
      });
      setMsg("Sheet cloned.");
      await load();
      nav(`/custom-sheets/${r.id}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Clone failed");
    }
  }

  async function deleteSheet(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await api(`/api/custom-sheets/${id}`, { method: "DELETE", token });
      setMsg("Sheet deleted.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="maker-shell space-y-6">
      <PageHeader
        eyebrow="Sheet Maker"
        title="Upload · edit · export Excel with formulas"
        subtitle="Global master templates or project-scoped sheets — MB, BBS, payment summaries, ISO registers. Formulas recalc in-portal and export live to .xlsx / SharePoint."
        actions={
          canWrite ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => setUploadOpen(true)}>
                Upload Excel / CSV
              </Button>
              <Link to="/master">
                <Button type="button" variant="secondary">
                  Master setup
                </Button>
              </Link>
            </div>
          ) : undefined
        }
      />
      {msg && <p className="maker-flash maker-flash--ok">{msg}</p>}

      <div className="maker-upload-grid">
        <div className="maker-section">
          <div className="maker-section__head">Scope</div>
          <div className="maker-section__body space-y-3">
            <Select value={pickedProject} onChange={(e) => setPickedProject(e.target.value)}>
              <option value="">All sheets (global + projects)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </Select>
            <p className="text-xs text-steel-muted leading-relaxed">
              Link a project to store the original upload in SharePoint under Sheet Maker folder.
            </p>
          </div>
        </div>
        {canWrite && (
          <div className="maker-section">
            <div className="maker-section__head">Create blank sheet</div>
            <div className="maker-section__body space-y-3">
              <Input placeholder="Sheet name" value={blankName} onChange={(e) => setBlankName(e.target.value)} />
              <Select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Button type="button" variant="secondary" onClick={() => void createBlank()}>
                Create blank sheet
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="maker-formula-help">
        <strong>Supported formulas</strong>
        <span>{SUPPORTED_FORMULAS.join(" · ")}</span>
      </div>

      <div className="maker-section maker-section--flush">
        <div className="maker-section__head maker-section__head--row">
          <span>Your sheets{pickedProject ? " · project filter" : ""}</span>
          <span className="maker-section__meta">{sheets.length} sheet(s)</span>
        </div>
        <ul className="maker-list">
          {sheets.map((s) => (
            <li key={s.id} className="maker-list__row">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="maker-list__title">{s.name}</div>
                  <Badge tone="neutral">{s.category || "General"}</Badge>
                  {s.formulaCount > 0 && <Badge tone="brand">{s.formulaCount} formulas</Badge>}
                </div>
                <div className="maker-list__sub">
                  {s.rowCount ?? 0} rows · {s.headers?.length || 0} cols
                  {s.sourceFile ? ` · from ${s.sourceFile}` : ""} · {new Date(s.updatedAt).toLocaleString("en-IN")}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Link to={`/custom-sheets/${s.id}`}>
                  <Button type="button">Open editor</Button>
                </Link>
                {canWrite && (
                  <>
                    <Button type="button" variant="secondary" className="!text-xs" onClick={() => void cloneSheet(s.id, s.name)}>
                      Clone
                    </Button>
                    <Button type="button" variant="ghost" className="!text-xs text-danger" onClick={() => void deleteSheet(s.id, s.name)}>
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
          {!sheets.length && <li className="maker-list__empty">No sheets yet — upload Excel or create a blank sheet.</li>}
        </ul>
      </div>

      {uploadOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-paper rounded-xl border border-line shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex justify-between items-start gap-3">
              <div>
                <h2 className="font-display text-xl">Upload Excel / CSV</h2>
                <p className="text-sm text-steel-muted mt-1">Formulas are preserved and recalc in the editor.</p>
              </div>
              <button type="button" className="text-steel-muted text-xl leading-none" onClick={() => setUploadOpen(false)}>
                ×
              </button>
            </div>
            <form onSubmit={upload} className="space-y-3">
              <Input placeholder="Sheet name" value={uploadName} onChange={(e) => setUploadName(e.target.value)} />
              <Select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <FilePickButton accept=".xlsx,.xls,.csv" onPick={(files) => void previewSheets(files[0])}>
                {uploadFile ? uploadFile.name : "Choose file (.xlsx / .xls / .csv)"}
              </FilePickButton>
              {sheetTabs.length > 1 && (
                <label className="text-sm block">
                  Excel tab
                  <Select className="mt-1" value={pickedTab} onChange={(e) => setPickedTab(e.target.value)}>
                    {sheetTabs.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </label>
              )}
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={!uploadFile || uploadBusy}>
                  {uploadBusy ? "Uploading…" : "Upload & open editor"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setUploadOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Editor ─── */

export function CustomSheetEditorPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const canWrite = ["admin", "office", "employee"].includes(user?.role || "");
  const [sheet, setSheet] = useState<{
    name: string;
    headers: string[];
    rows: SheetCell[][];
    category?: string;
    formulaCount?: number;
  } | null>(null);
  const [msg, setMsg] = useState("");
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [fxValue, setFxValue] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!id) return;
    const s = await api<any>(`/api/custom-sheets/${id}`, { token });
    const rows = evaluateAllRows((s.rows || []).map((row: unknown[]) => row.map((cell) => normalizeCell(cell))));
    setSheet({ name: s.name, headers: s.headers, rows, category: s.category, formulaCount: s.formulaCount });
    setDirty(false);
    setSelected(null);
    setFxValue("");
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  useEffect(() => {
    if (!selected || !sheet) return;
    const cell = sheet.rows[selected.row]?.[selected.col];
    setFxValue(cell ? cellEditValue(cell) : "");
  }, [selected, sheet]);

  function setCell(rowIdx: number, colIdx: number, value: string) {
    setDirty(true);
    setSheet((prev) => {
      if (!prev) return prev;
      const rows = prev.rows.map((r) => r.map((c) => ({ ...c })));
      while (rows.length <= rowIdx) rows.push(prev.headers.map(() => ({ raw: "" })));
      if (!rows[rowIdx]) rows[rowIdx] = prev.headers.map(() => ({ raw: "" }));
      while (rows[rowIdx].length <= colIdx) rows[rowIdx].push({ raw: "" });
      rows[rowIdx][colIdx] = { raw: value };
      return { ...prev, rows: evaluateAllRows(rows) };
    });
  }

  function applyFxBar() {
    if (!selected) return;
    setCell(selected.row, selected.col, fxValue);
  }

  function addRow() {
    setDirty(true);
    setSheet((prev) => (prev ? { ...prev, rows: [...prev.rows, prev.headers.map(() => ({ raw: "" }))] } : prev));
  }

  function delRow(idx: number) {
    setDirty(true);
    setSheet((prev) => {
      if (!prev) return prev;
      const rows = prev.rows.slice();
      rows.splice(idx, 1);
      return { ...prev, rows: evaluateAllRows(rows) };
    });
  }

  function addColumn() {
    setDirty(true);
    setSheet((prev) => {
      if (!prev) return prev;
      const headers = [...prev.headers, `Column ${prev.headers.length + 1}`];
      const rows = prev.rows.map((r) => [...r, { raw: "" }]);
      return { ...prev, headers, rows: evaluateAllRows(rows) };
    });
  }

  function renameColumn(idx: number, name: string) {
    setDirty(true);
    setSheet((prev) => {
      if (!prev) return prev;
      const headers = prev.headers.slice();
      headers[idx] = name;
      return { ...prev, headers };
    });
  }

  function delColumn(idx: number) {
    setDirty(true);
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
    setSaving(true);
    try {
      const rows = evaluateAllRows(sheet.rows);
      await api(`/api/custom-sheets/${id}`, {
        method: "PUT",
        token,
        body: JSON.stringify({ headers: sheet.headers, rows, name: sheet.name }),
      });
      setSheet((prev) => (prev ? { ...prev, rows, formulaCount } : prev));
      setDirty(false);
      setMsg(`Saved · ${formulaCount} formula(s) · ${sheet.rows.length} rows.`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function download() {
    if (!id || !sheet) return;
    const res = await fetch(`${apiBase()}/api/custom-sheets/${id}/export`, {
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
    URL.revokeObjectURL(url);
    setMsg("Exported .xlsx — formulas included for Excel recalc.");
  }

  async function reimport(file: File) {
    if (!id) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const s = await api<any>(`/api/custom-sheets/${id}/reimport`, { method: "POST", token, body: fd });
      const rows = evaluateAllRows((s.rows || []).map((row: unknown[]) => row.map((cell) => normalizeCell(cell))));
      setSheet((prev) => (prev ? { ...prev, headers: s.headers, rows, formulaCount: s.formulaCount } : prev));
      setDirty(false);
      setMsg(`Re-imported from ${file.name}.`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Re-import failed");
    }
  }

  const selectedAddr =
    selected != null ? `${colLetter(selected.col)}${selected.row + 2}` : "";

  return (
    <div className="maker-shell page-stack--register flex flex-col flex-1 min-h-0 overflow-hidden gap-2 pb-2">
      <div className="shrink-0">
      <PageHeader
        eyebrow="Sheet editor"
        title={sheet?.name || "Loading…"}
        subtitle={
          sheet
            ? `${sheet.headers.length} columns · ${sheet.rows.length} rows · ${formulaCount} formula(s) · ${sheet.category || "General"}${dirty ? " · unsaved changes" : ""}`
            : ""
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/custom-sheets">
              <Button type="button" variant="secondary">
                Back
              </Button>
            </Link>
            {canWrite && sheet && (
              <>
                <Button type="button" variant="secondary" onClick={addRow}>
                  + Row
                </Button>
                <Button type="button" variant="secondary" onClick={addColumn}>
                  + Column
                </Button>
                <FilePickButton accept=".xlsx,.xls,.csv" variant="secondary" onPick={(files) => void reimport(files[0])}>
                  Re-import file
                </FilePickButton>
              </>
            )}
          </div>
        }
      />
      {msg && <p className="maker-flash maker-flash--ok">{msg}</p>}

      {sheet && (
        <>
          <div className="maker-formula-help">
            <strong>Formulas</strong>
            <span>
              Click a cell, edit in the formula bar, press Apply. Examples:{" "}
              <code>=SUM(C2:C20)</code>, <code>=IF(D2&gt;0,E2,0)</code>, <code>=AVERAGE(B2:B10)</code>. Export writes live
              formulas to Excel.
            </span>
          </div>

          <div className="maker-toolbar">
            <div className="maker-toolbar__field flex-[2]">
              <label>Cell {selectedAddr || "—"}</label>
              <div className="flex gap-2">
                <Input
                  className="font-mono text-sm"
                  value={fxValue}
                  onChange={(e) => setFxValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyFxBar();
                  }}
                  placeholder="Value or =formula"
                  disabled={!canWrite || selected == null}
                />
                {canWrite && (
                  <Button type="button" variant="secondary" disabled={selected == null} onClick={applyFxBar}>
                    Apply
                  </Button>
                )}
              </div>
            </div>
            {selected != null && sheet.rows[selected.row]?.[selected.col] && (
              <div className="maker-toolbar__field">
                <label>Preview</label>
                <div className="text-sm font-semibold text-brand pt-2">
                  {cellPreview(sheet.rows[selected.row][selected.col])}
                </div>
              </div>
            )}
          </div>
        </>
      )}
      </div>

      {!sheet ? (
        <div className="maker-section">
          <div className="maker-section__body">Loading…</div>
        </div>
      ) : (
        <div className="maker-section maker-section--flush flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="maker-section__head shrink-0">Spreadsheet</div>
          <div className="maker-table-wrap register-sheet-viewport sheet-register__scroll flex-1 min-h-0 overflow-auto">
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
                          <button type="button" className="maker-table__remove-col" onClick={() => delColumn(i)}>
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
                      const isSel = selected?.row === ri && selected?.col === ci;
                      return (
                        <td key={ci} className="px-1 py-0.5 align-top">
                          <input
                            className={`maker-table__cell${formula ? " maker-table__cell--formula" : ""}${isSel ? " ring-2 ring-brand" : ""}`}
                            value={cellEditValue(cell)}
                            onFocus={() => {
                              setSelected({ row: ri, col: ci });
                              setFxValue(cellEditValue(cell));
                            }}
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
                        <button type="button" className="text-danger text-[10px]" onClick={() => delRow(ri)}>
                          ×
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {!sheet.rows.length && (
                  <tr>
                    <td colSpan={sheet.headers.length + 2} className="text-center text-steel-muted py-6">
                      No rows — click + Row or type in the formula bar after adding a row.
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
          {canWrite && (
            <Button type="button" onClick={() => void save()} disabled={!sheet || saving}>
              {saving ? "Saving…" : dirty ? "Save changes" : "Save"}
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={() => void download()}>
            Export .xlsx
          </Button>
        </div>
      )}
    </div>
  );
}
