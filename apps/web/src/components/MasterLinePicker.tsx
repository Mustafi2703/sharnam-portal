/**
 * Pick line items from a global cost master sheet and import into a project package.
 */
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Button, Card, Input, Select } from "./ui";

type MasterKind = "mb" | "bbs" | "monitoring";

type MasterSummary = {
  id: string;
  name: string;
  category: string;
  rowCount: number;
  updatedAt: string;
};

type MasterLine = {
  index: number;
  label: string;
  sub?: string;
};

type Props = {
  projectId: string;
  token?: string | null;
  kind: MasterKind;
  defaultPackage: string;
  packageOptions: string[];
  canEdit: boolean;
  onImported: () => void;
};

const KIND_LABEL: Record<MasterKind, string> = {
  mb: "MB sheet",
  bbs: "BBS sheet",
  monitoring: "BOQ / monitoring",
};

export function MasterLinePicker({
  projectId,
  token,
  kind,
  defaultPackage,
  packageOptions,
  canEdit,
  onImported,
}: Props) {
  const [masters, setMasters] = useState<MasterSummary[]>([]);
  const [masterId, setMasterId] = useState("");
  const [lines, setLines] = useState<MasterLine[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [packageName, setPackageName] = useState(defaultPackage);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setPackageName(defaultPackage !== "All" ? defaultPackage : packageOptions[0] || "Civil");
  }, [defaultPackage, packageOptions]);

  useEffect(() => {
    if (!canEdit || !open) return;
    void api<MasterSummary[]>(`/api/custom-sheets/masters?kind=${kind}`, { token })
      .then(setMasters)
      .catch(() => setMasters([]));
  }, [canEdit, open, kind, token]);

  useEffect(() => {
    if (!masterId) {
      setLines([]);
      setSelected(new Set());
      return;
    }
    void api<{ lines: MasterLine[] }>(`/api/custom-sheets/masters/${masterId}/lines`, { token })
      .then((r) => {
        setLines(r.lines || []);
        setSelected(new Set());
      })
      .catch(() => setLines([]));
  }, [masterId, token]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter((l) => l.label.toLowerCase().includes(q) || (l.sub || "").toLowerCase().includes(q));
  }, [lines, filter]);

  if (!canEdit) return null;

  async function importSelected() {
    if (!masterId || !selected.size) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await api<{ imported: number }>(`/api/cost/${projectId}/import-master`, {
        method: "POST",
        token,
        body: JSON.stringify({
          masterId,
          kind,
          packageName,
          rowIndexes: [...selected],
        }),
      });
      setMsg(`Imported ${res.imported} line(s) into ${packageName}`);
      setSelected(new Set());
      setOpen(false);
      onImported();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  function toggle(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected(new Set(filtered.map((l) => l.index)));
  }

  return (
    <Card className="!p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-sm">Add from global master</h3>
          <p className="text-xs text-steel-muted mt-0.5">
            Upload masters in Master → Global masters. Pick lines relevant to this discipline/package.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => setOpen((o) => !o)}>
          {open ? "Close picker" : `Pick ${KIND_LABEL[kind]} lines`}
        </Button>
      </div>
      {msg && <p className="text-sm text-brand bg-brand-soft px-3 py-2 rounded-sm">{msg}</p>}
      {open && (
        <div className="space-y-3 border-t border-line pt-3">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Select value={masterId} onChange={(e) => setMasterId(e.target.value)}>
              <option value="">Select master sheet…</option>
              {masters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.rowCount} rows)
                </option>
              ))}
            </Select>
            <Select value={packageName} onChange={(e) => setPackageName(e.target.value)}>
              {(packageOptions.length ? packageOptions : ["Civil"]).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
            <Input placeholder="Filter lines…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <div className="flex flex-wrap gap-2 items-center">
              <Button type="button" variant="ghost" className="!text-xs" onClick={selectAllVisible} disabled={!filtered.length}>
                Select visible
              </Button>
              <Button type="button" variant="ghost" className="!text-xs" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
              <span className="text-xs text-steel-muted">{selected.size} selected</span>
            </div>
          </div>
          {!masters.length && masterId === "" && (
            <p className="text-sm text-steel-muted">
              No global {KIND_LABEL[kind]} master yet — upload one under Master → Global masters → Cost sheet templates.
            </p>
          )}
          {masterId && (
            <div className="max-h-64 overflow-y-auto border border-line rounded-sm divide-y divide-line">
              {filtered.map((line) => (
                <label key={line.index} className="flex items-start gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-paper/80">
                  <input type="checkbox" checked={selected.has(line.index)} onChange={() => toggle(line.index)} className="mt-1" />
                  <span>
                    <span className="font-medium">{line.label}</span>
                    {line.sub && <span className="text-steel-muted text-xs block">{line.sub}</span>}
                  </span>
                </label>
              ))}
              {!filtered.length && <p className="text-sm text-steel-muted px-3 py-4">No lines match filter.</p>}
            </div>
          )}
          <Button type="button" disabled={busy || !masterId || !selected.size} onClick={() => void importSelected()}>
            {busy ? "Importing…" : `Import ${selected.size || ""} line(s) to ${packageName}`}
          </Button>
        </div>
      )}
    </Card>
  );
}
