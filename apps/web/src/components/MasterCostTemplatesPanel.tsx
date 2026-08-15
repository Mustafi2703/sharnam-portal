/**
 * Master setup — upload global MB / BBS / BOQ template sheets (CustomSheet, projectId null).
 */
import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Badge, Button, Card, Input, Select } from "./ui";

type MasterKind = "mb" | "bbs" | "monitoring";

type MasterSummary = {
  id: string;
  name: string;
  category: string;
  sourceFile?: string | null;
  rowCount: number;
  updatedAt: string;
};

const KINDS: { id: MasterKind; label: string; hint: string; accept: string }[] = [
  { id: "mb", label: "MB sheets", hint: "SPDC * MB sheets from budget workbook", accept: ".xlsx,.xls" },
  { id: "bbs", label: "BBS sheets", hint: "SPDC * BBS sheets — bar schedule columns", accept: ".xlsx,.xls" },
  {
    id: "monitoring",
    label: "BOQ / Monitoring",
    hint: "BOQ line register — Section, Item, Description, Rate, Qty",
    accept: ".xlsx,.xls,.csv",
  },
];

type Props = {
  token?: string | null;
};

export function MasterCostTemplatesPanel({ token }: Props) {
  const [kind, setKind] = useState<MasterKind>("mb");
  const [masters, setMasters] = useState<MasterSummary[]>([]);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () =>
    api<MasterSummary[]>(`/api/custom-sheets/masters?kind=${kind}`, { token })
      .then(setMasters)
      .catch(() => setMasters([]));

  useEffect(() => {
    void load();
  }, [kind, token]);

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      fd.append("name", name || file.name.replace(/\.[^.]+$/, ""));
      const res = await api<{ rowCount: number; name: string }>(`/api/custom-sheets/masters/upload`, {
        method: "POST",
        token,
        body: fd,
      });
      setMsg(`Uploaded master “${res.name}” — ${res.rowCount} rows`);
      setFile(null);
      setName("");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const active = KINDS.find((k) => k.id === kind)!;

  return (
    <Card className="sm:col-span-2 xl:col-span-3 !p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">Cost sheet masters</h2>
          <p className="text-sm text-steel-muted mt-1">
            Upload once here — each project picks relevant lines by discipline/package on the Cost module (MB, BBS, BOQ tabs).
          </p>
        </div>
        <Link to="/custom-sheets" className="text-sm text-brand font-semibold">
          Open Sheet Maker →
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setKind(k.id)}
            className={`rounded-sm px-3 py-1.5 text-xs font-medium border ${
              kind === k.id ? "bg-procore-navy text-white border-procore-navy" : "bg-paper border-line text-ink"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {msg && <p className="text-sm text-brand bg-brand-soft px-3 py-2 rounded-sm">{msg}</p>}

      <form className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end" onSubmit={onUpload}>
        <Input placeholder="Master name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
        <Select value={kind} onChange={(e) => setKind(e.target.value as MasterKind)}>
          {KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </Select>
        <input type="file" accept={active.accept} onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <Button type="submit" disabled={!file || busy}>
          {busy ? "Uploading…" : "Upload master sheet"}
        </Button>
      </form>
      <p className="text-xs text-steel-muted">{active.hint}</p>

      <div className="border border-line rounded-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase text-steel-muted">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Rows</th>
              <th className="px-3 py-2">Source file</th>
              <th className="px-3 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {masters.map((m) => (
              <tr key={m.id} className="border-t border-line">
                <td className="px-3 py-2 font-medium">{m.name}</td>
                <td className="px-3 py-2">
                  <Badge tone="neutral">{m.rowCount}</Badge>
                </td>
                <td className="px-3 py-2 text-steel-muted text-xs">{m.sourceFile || "—"}</td>
                <td className="px-3 py-2 text-steel-muted text-xs">
                  {new Date(m.updatedAt).toLocaleString("en-IN")}
                </td>
              </tr>
            ))}
            {!masters.length && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-steel-muted">
                  No {active.label} master uploaded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
