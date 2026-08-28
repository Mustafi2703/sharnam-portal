/**
 * Master setup — upload global MB / BBS template sheets only (CustomSheet, projectId null).
 * BOQ / monitoring is per-project structure upload on Cost → BOQ tab (not global).
 */
import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Badge, Button, Card, Input, Select } from "./ui";

type MasterKind = "mb" | "bbs";

type MasterSummary = {
  id: string;
  name: string;
  category: string;
  sourceFile?: string | null;
  rowCount: number;
  updatedAt: string;
};

const KINDS: { id: MasterKind; label: string; hint: string; accept: string; example: string }[] = [
  {
    id: "mb",
    label: "MB sheets",
    hint: "Upload SPDC * MB sheets (Dormitory MB, Electric MB, …) from budget workbook or standalone .xls",
    accept: ".xlsx,.xls",
    example: "DORMITORY MB · Electric MB · Plumbing MB",
  },
  {
    id: "bbs",
    label: "BBS sheets",
    hint: "Upload SPDC * BBS sheets — full bar schedule columns; pair with BBS shape code master for diagrams",
    accept: ".xlsx,.xls",
    example: "DORMITORY BBS · UGWT BBS · Compound Wall BBS",
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
      setMsg(`Uploaded ${kind.toUpperCase()} master “${res.name}” — ${res.rowCount} rows`);
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
          <h2 className="font-display text-xl">Global MB &amp; BBS sheet masters</h2>
          <p className="text-sm text-steel-muted mt-1">
            Like <strong>checklist master → project fill</strong>: upload MB/BBS templates once here; each project picks relevant lines by package on Cost → MB / BBS tabs.
          </p>
          <p className="text-xs text-steel-muted mt-1">
            <strong>BOQ / monitoring</strong> is <em>not</em> global — upload per project structure on{" "}
            <span className="font-medium text-ink">Cost → BOQ</span> (one package name per structure).
          </p>
        </div>
        <Link to="/custom-sheets" className="text-sm text-brand font-semibold">
          Sheet Maker (advanced) →
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
        <Input placeholder="Master name (e.g. Dormitory MB)" value={name} onChange={(e) => setName(e.target.value)} />
        <Select value={kind} onChange={(e) => setKind(e.target.value as MasterKind)}>
          {KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </Select>
        <input type="file" accept={active.accept} onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <Button type="submit" disabled={!file || busy}>
          {busy ? "Uploading…" : `Upload ${active.label}`}
        </Button>
      </form>
      <p className="text-xs text-steel-muted">
        {active.hint} · Examples: {active.example}
      </p>

      <div className="border border-line rounded-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase text-steel-muted">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Rows</th>
              <th className="px-3 py-2">Source file</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2 text-right">Actions</th>
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
                <td className="px-3 py-2 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    className="!text-xs"
                    onClick={async () => {
                      try {
                        const res = await fetch(
                          `${(import.meta.env.VITE_API_URL || "")}/api/custom-sheets/masters/${m.id}/download.xlsx`,
                          { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
                        );
                        if (!res.ok) throw new Error(`Download failed (${res.status})`);
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `Sharnam-${active.label.replace(/\s+/g, "-")}-${m.name.replace(/[^\w.-]+/g, "_")}.xlsx`;
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch (err) {
                        setMsg(err instanceof Error ? err.message : "Download failed");
                      }
                    }}
                  >
                    Download Sharnam .xlsx
                  </Button>
                </td>
              </tr>
            ))}
            {!masters.length && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-steel-muted">
                  No {active.label} uploaded yet — upload SPDC budget * {kind === "mb" ? "MB" : "BBS"} sheet here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
