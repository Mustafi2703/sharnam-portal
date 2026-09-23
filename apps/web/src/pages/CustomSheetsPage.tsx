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

/**
 * Interactive Sheet Maker — Notion-like grid: rename columns, edit cells, =formulas, export Excel.
 */
export default function CustomSheetsPage() {
  const { token, user } = useAuth();
  const canWrite = ["admin", "office", "employee"].includes(user?.role || "");
  const canAdmin = ["admin", "office"].includes(user?.role || "");
  const [search] = useSearchParams();
  const nav = useNavigate();
  const projectId = search.get("projectId") || undefined;

  const [sheets, setSheets] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [loadErr, setLoadErr] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [pickedProject, setPickedProject] = useState(projectId || "");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [sheetTabs, setSheetTabs] = useState<string[]>([]);
  const [pickedTab, setPickedTab] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [newName, setNewName] = useState("");

  const load = useCallback(async () => {
    setLoadErr("");
    try {
      const q = new URLSearchParams({ maker: "1" });
      if (pickedProject) q.set("projectId", pickedProject);
      const rows = await api<any[]>(`/api/custom-sheets?${q}`, { token });
      setSheets(rows);
    } catch (err) {
      setLoadErr(err instanceof Error ? err.message : "Could not load sheets");
      setSheets([]);
    }
  }, [token, pickedProject]);

  useEffect(() => {
    void load();
    api<any[]>("/api/projects", { token }).then(setProjects).catch(() => setProjects([]));
  }, [load, token]);

  async function createNew() {
    setMsg("");
    try {
      const r = await api<{ id: string; name: string }>("/api/custom-sheets/blank", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: newName.trim() || `Untitled — ${new Date().toLocaleDateString("en-IN")}`,
          projectId: pickedProject || undefined,
        }),
      });
      setNewName("");
      nav(`/custom-sheets/${r.id}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function clearWorkspace() {
    if (!confirm("Delete all sheets in Sheet Maker? Bid BOQ sheets are kept safe.")) return;
    try {
      const r = await api<{ deleted: number }>("/api/custom-sheets/clear-maker", { method: "POST", token });
      setMsg(r.deleted ? `Removed ${r.deleted} sheet(s).` : "Workspace already empty.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Clear failed");
    }
  }

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
    fd.append("category", "General");
    if (pickedProject) fd.append("projectId", pickedProject);
    if (pickedTab) fd.append("sheet", pickedTab);
    try {
      const r = await api<{ id: string }>("/api/custom-sheets/upload", { method: "POST", token, body: fd });
      setUploadOpen(false);
      setUploadFile(null);
      nav(`/custom-sheets/${r.id}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  }

  async function deleteSheet(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    await api(`/api/custom-sheets/${id}`, { method: "DELETE", token });
    await load();
  }

  return (
    <div className="maker-shell custom-sheet-maker page-scroll-full space-y-5 pb-8 w-full max-w-none">
      <PageHeader
        eyebrow="Sheet Maker"
        title="Interactive spreadsheets"
        subtitle="Create a blank sheet, rename columns, type values or formulas (=SUM(A2:A10)), save, and export .xlsx. No demo clutter — your workspace only."
        actions={
          canWrite ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void createNew()}>
                + New sheet
              </Button>
              <Button type="button" variant="secondary" onClick={() => setUploadOpen(true)}>
                Import Excel / CSV
              </Button>
              {canAdmin ? (
                <Button type="button" variant="ghost" className="!text-xs" onClick={() => void clearWorkspace()}>
                  Clear workspace
                </Button>
              ) : null}
            </div>
          ) : undefined
        }
      />

      {loadErr ? (
        <p className="text-sm text-danger border border-danger/30 rounded-lg px-3 py-2">{loadErr}</p>
      ) : null}
      {msg ? <p className="maker-flash maker-flash--ok">{msg}</p> : null}

      {canWrite && (
        <div className="maker-section">
          <div className="maker-section__head">Quick start</div>
          <div className="maker-section__body flex flex-wrap gap-2 items-end">
            <Input
              className="max-w-xs"
              placeholder="Sheet name (optional)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void createNew();
              }}
            />
            <Button type="button" onClick={() => void createNew()}>
              Open new sheet
            </Button>
            <Select className="max-w-md" value={pickedProject} onChange={(e) => setPickedProject(e.target.value)}>
              <option value="">All workspace sheets</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}

      <p className="text-xs text-steel-muted">
        Formulas: {SUPPORTED_FORMULAS.join(" · ")}
      </p>

      <div className="maker-section maker-section--flush">
        <div className="maker-section__head maker-section__head--row">
          <span>Your sheets</span>
          <span className="maker-section__meta">{sheets.length}</span>
        </div>
        <ul className="maker-list">
          {sheets.map((s) => (
            <li key={s.id} className="maker-list__row">
              <div className="min-w-0 flex-1">
                <div className="maker-list__title">{s.name}</div>
                <div className="maker-list__sub">
                  {s.rowCount ?? 0} rows · {s.headers?.length || 0} columns
                  {s.formulaCount > 0 ? ` · ${s.formulaCount} formulas` : ""} ·{" "}
                  {new Date(s.updatedAt).toLocaleString("en-IN")}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Link to={`/custom-sheets/${s.id}`}>
                  <Button type="button">Open</Button>
                </Link>
                {canWrite ? (
                  <Button type="button" variant="ghost" className="!text-xs text-danger" onClick={() => void deleteSheet(s.id, s.name)}>
                    Delete
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
          {!sheets.length && !loadErr && (
            <li className="maker-list__empty">No sheets yet — click <strong>New sheet</strong> to start.</li>
          )}
        </ul>
      </div>

      {uploadOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-paper rounded-xl border border-line shadow-2xl w-full max-w-lg p-6 space-y-4">
            <h2 className="font-display text-xl">Import spreadsheet</h2>
            <form onSubmit={upload} className="space-y-3">
              <Input placeholder="Name in portal" value={uploadName} onChange={(e) => setUploadName(e.target.value)} />
              <FilePickButton accept=".xlsx,.xls,.csv" onPick={(files) => void previewSheets(files[0])}>
                {uploadFile ? uploadFile.name : "Choose .xlsx / .csv"}
              </FilePickButton>
              {sheetTabs.length > 1 && (
                <Select value={pickedTab} onChange={(e) => setPickedTab(e.target.value)}>
                  {sheetTabs.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              )}
              <div className="flex gap-2">
                <Button type="submit" disabled={!uploadFile || uploadBusy}>
                  Import & open
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
  const officeWrite = ["admin", "office", "employee"].includes(user?.role || "");
  const [canWrite, setCanWrite] = useState(officeWrite);
  const [bidContext, setBidContext] = useState<{ bidPackageTitle?: string; bidPackageId?: string } | null>(null);
  const [sheet, setSheet] = useState<{
    name: string;
    headers: string[];
    rows: SheetCell[][];
    category?: string;
    formulaCount?: number;
  } | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [msg, setMsg] = useState("");
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [fxValue, setFxValue] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoadErr("");
    try {
      const s = await api<any>(`/api/custom-sheets/${id}`, { token });
      const rows = evaluateAllRows((s.rows || []).map((row: unknown[]) => row.map((cell) => normalizeCell(cell))));
      setSheet({ name: s.name, headers: s.headers, rows, category: s.category, formulaCount: s.formulaCount });
      setCanWrite(Boolean(s.canWrite ?? officeWrite));
      setBidContext(
        s.bidSlot ? { bidPackageTitle: s.bidSlot.bidPackageTitle, bidPackageId: s.bidSlot.bidPackageId } : null,
      );
      setDirty(false);
      setSelected(null);
      setFxValue("");
    } catch (err) {
      setSheet(null);
      setLoadErr(err instanceof Error ? err.message : "Could not load sheet");
    }
  }, [id, token, officeWrite]);

  useEffect(() => {
    void load();
  }, [load]);

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
      const headers = [...prev.headers, `Column ${colLetter(prev.headers.length)}`];
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
      return {
        ...prev,
        headers: prev.headers.filter((_h, i) => i !== idx),
        rows: evaluateAllRows(prev.rows.map((r) => r.filter((_c, i) => i !== idx))),
      };
    });
  }

  const formulaCount = useMemo(() => sheet?.rows.flat().filter((c) => isFormula(c.raw)).length ?? 0, [sheet]);

  async function save() {
    if (!id || !sheet) return;
    setSaving(true);
    try {
      const rows = evaluateAllRows(sheet.rows);
      await api(`/api/custom-sheets/${id}`, {
        method: "PUT",
        token,
        body: JSON.stringify({ headers: sheet.headers, rows, name: sheet.name.trim() || "Untitled sheet" }),
      });
      setSheet((prev) => (prev ? { ...prev, rows, formulaCount } : prev));
      setDirty(false);
      setMsg("Saved.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function downloadCsv() {
    if (!id || !sheet) return;
    const res = await fetch(`${apiBase()}/api/custom-sheets/${id}/export.csv`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) {
      setMsg("CSV export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sheet.name || "sheet"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg("Exported .csv");
  }

  async function download() {
    if (!id || !sheet) return;
    const res = await fetch(`${apiBase()}/api/custom-sheets/${id}/export`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
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
    a.click();
    URL.revokeObjectURL(url);
    setMsg("Exported .xlsx");
  }

  const selectedAddr = selected != null ? `${colLetter(selected.col)}${selected.row + 2}` : "";

  if (loadErr) {
    return (
      <div className="maker-shell custom-sheet-maker page-scroll-full p-4 space-y-3">
        <p className="text-sm text-danger">{loadErr}</p>
        <Link to="/custom-sheets">
          <Button variant="secondary">Back to Sheet Maker</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="maker-shell custom-sheet-maker page-scroll-full flex flex-col gap-3 pb-28 safe-bottom">
      <div className="maker-shell__body space-y-3 px-1 sm:px-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          {canWrite && sheet ? (
            <Input
              className="font-display text-lg font-semibold max-w-xl !border-0 !bg-transparent !px-0 focus:!ring-0"
              value={sheet.name}
              onChange={(e) => {
                setDirty(true);
                setSheet({ ...sheet, name: e.target.value });
              }}
              placeholder="Untitled sheet"
            />
          ) : (
            <h1 className="font-display text-xl">{sheet?.name || "Loading…"}</h1>
          )}
          <div className="flex flex-wrap gap-2">
            {bidContext?.bidPackageId ? (
              <Link to={user?.role === "vendor" ? "/crm/vendor-bids" : `/crm/bids/${bidContext.bidPackageId}`}>
                <Button variant="secondary">← Back to bid</Button>
              </Link>
            ) : (
              <Link to="/custom-sheets">
                <Button variant="secondary">← Sheets</Button>
              </Link>
            )}
            {canWrite && sheet ? (
              <>
                <Button type="button" variant="secondary" onClick={addRow}>
                  + Row
                </Button>
                <Button type="button" variant="secondary" onClick={addColumn}>
                  + Column
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {sheet ? (
          <p className="text-xs text-steel-muted">
            {sheet.headers.length} columns · {sheet.rows.length} rows · {formulaCount} formula(s)
            {dirty ? " · unsaved" : ""}
            {bidContext?.bidPackageTitle ? ` · ${bidContext.bidPackageTitle}` : ""}
          </p>
        ) : null}

        {msg ? <p className="text-xs text-brand">{msg}</p> : null}

        {sheet && (
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
                  placeholder="Value or =SUM(A2:A10)"
                  disabled={!canWrite || selected == null}
                />
                {canWrite ? (
                  <Button type="button" variant="secondary" disabled={selected == null} onClick={applyFxBar}>
                    Apply
                  </Button>
                ) : null}
              </div>
            </div>
            {selected != null && sheet.rows[selected.row]?.[selected.col] ? (
              <div className="maker-toolbar__field">
                <label>Result</label>
                <div className="text-sm font-semibold text-brand pt-2">{cellPreview(sheet.rows[selected.row][selected.col])}</div>
              </div>
            ) : null}
          </div>
        )}

        {!sheet ? (
          <p className="text-sm text-steel-muted py-8 text-center">Loading sheet…</p>
        ) : (
          <div className="custom-sheet-editor-grid">
            <div className="custom-sheet-grid-viewport" role="region" aria-label="Sheet cells">
              <table className="maker-table maker-table--notion">
                <thead>
                  <tr className="bg-sand/50 text-left align-top sticky top-0 z-[1]">
                    <th className="px-2 py-1 w-8">#</th>
                    {sheet.headers.map((h, i) => (
                      <th key={i} className="px-2 py-1 font-semibold whitespace-nowrap min-w-[120px]">
                        <div className="maker-table__col-ref text-[10px] text-steel-muted">{colLetter(i)}</div>
                        {canWrite ? (
                          <input
                            className="maker-table__head-input w-full"
                            data-preserve-case
                            value={h}
                            onChange={(e) => renameColumn(i, e.target.value)}
                            aria-label={`Column ${colLetter(i)} name`}
                          />
                        ) : (
                          <span>{h}</span>
                        )}
                        {canWrite ? (
                          <button type="button" className="maker-table__remove-col" onClick={() => delColumn(i)}>
                            Remove column
                          </button>
                        ) : null}
                      </th>
                    ))}
                    {canWrite ? <th className="w-8" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {sheet.rows.map((row, ri) => (
                    <tr key={ri} className="border-t border-line">
                      <td className="px-2 py-0.5 text-steel-muted text-xs">{ri + 2}</td>
                      {sheet.headers.map((_h, ci) => {
                        const cell = row[ci] ?? { raw: "" };
                        const formula = isFormula(cell.raw);
                        const isSel = selected?.row === ri && selected?.col === ci;
                        return (
                          <td key={ci} className="px-1 py-0.5 align-top">
                            <input
                            className={`maker-table__cell w-full min-w-[100px]${formula ? " maker-table__cell--formula" : ""}${isSel ? " ring-2 ring-brand" : ""}`}
                            data-preserve-case
                              value={cellEditValue(cell)}
                              onFocus={() => {
                                setSelected({ row: ri, col: ci });
                                setFxValue(cellEditValue(cell));
                              }}
                              onChange={(e) => setCell(ri, ci, e.target.value)}
                              disabled={!canWrite}
                              spellCheck={false}
                            />
                            {formula ? (
                              <div className="maker-table__cell-result text-[10px]">= {cellPreview(cell)}</div>
                            ) : null}
                          </td>
                        );
                      })}
                      {canWrite ? (
                        <td className="px-1">
                          <button type="button" className="text-danger text-xs" onClick={() => delRow(ri)} aria-label="Delete row">
                            ×
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {sheet ? (
        <div className="maker-sticky-bar">
          {canWrite ? (
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : dirty ? "Save" : "Save"}
            </Button>
          ) : null}
          <Button type="button" variant="secondary" onClick={() => void download()}>
            Export .xlsx
          </Button>
          <Button type="button" variant="secondary" onClick={() => void downloadCsv()}>
            Export .csv
          </Button>
        </div>
      ) : null}
    </div>
  );
}
