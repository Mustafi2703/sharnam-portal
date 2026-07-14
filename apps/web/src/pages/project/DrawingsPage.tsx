import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { canManageDrawings, isClientViewOnly } from "../../permissions";
import { Badge, Button, Card, Input, PageHeader, Select } from "../../components/ui";

export default function DrawingsPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [drawings, setDrawings] = useState<any[]>([]);
  const [filter, setFilter] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    drawingNumber: "",
    title: "",
    discipline: "Architecture",
    revisionNumber: "Rev A",
    publish: true,
  });
  const [file, setFile] = useState<File | null>(null);
  const canUpload = canManageDrawings(user?.role);
  const clientOnly = isClientViewOnly(user?.role);

  const load = () =>
    api<any[]>(`/api/drawings/project/${id}`, { token }).then((d) => {
      setDrawings(d);
      if (!selectedId && d[0]) setSelectedId(d[0].id);
    });

  useEffect(() => {
    void load();
  }, [id, token]);

  const disciplines = ["All", ...Array.from(new Set(drawings.map((d) => d.discipline)))];
  const filtered = filter === "All" ? drawings : drawings.filter((d) => d.discipline === filter);
  const selected = drawings.find((d) => d.id === selectedId);

  async function exportCsv() {
    const res = await fetch(`/api/drawings/project/${id}/export.csv`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gfc-drawing-log.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Approval & GFC Drawing Log"
        title="Drawing register"
        subtitle={
          clientOnly
            ? "View published sheets only. Uploads and publishing are controlled by Sharnam office."
            : "Register sheets like the Excel GFC log. Publish to unlock checklists. Dual-fill logs stay on the server with revision history."
        }
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void exportCsv()}>
              Export CSV log
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-1">
        {disciplines.map((d) => (
          <button
            key={d}
            onClick={() => setFilter(d)}
            className={`rounded-full px-3 py-1 text-xs ${filter === d ? "bg-brand text-white" : "bg-white border border-line"}`}
          >
            {d}
          </button>
        ))}
      </div>

      <Card padding={false} className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-sand/60 text-left text-[11px] uppercase tracking-wide text-steel-muted">
            <tr>
              <th className="px-3 py-2 font-semibold">Sr</th>
              <th className="px-3 py-2 font-semibold">Drawing No</th>
              <th className="px-3 py-2 font-semibold">Title</th>
              <th className="px-3 py-2 font-semibold">Discipline</th>
              <th className="px-3 py-2 font-semibold">Rev</th>
              <th className="px-3 py-2 font-semibold">Rev date</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Revs</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((d, i) => {
              const latest = d.revisions?.[0];
              return (
                <tr
                  key={d.id}
                  className={`cursor-pointer hover:bg-brand-soft/40 ${selectedId === d.id ? "bg-brand-soft/50" : ""}`}
                  onClick={() => setSelectedId(d.id)}
                >
                  <td className="px-3 py-2 font-mono text-xs">{i + 1}</td>
                  <td className="px-3 py-2 font-mono text-brand text-xs">{d.drawingNumber}</td>
                  <td className="px-3 py-2 font-medium">{d.title}</td>
                  <td className="px-3 py-2 text-xs">{d.discipline}</td>
                  <td className="px-3 py-2 font-mono text-xs">{d.currentRev}</td>
                  <td className="px-3 py-2 text-xs text-steel-muted">
                    {latest ? new Date(latest.createdAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={d.isPublished ? "ok" : "warn"}>{d.isPublished ? "Published" : d.status}</Badge>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{d.revisions?.length || 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="grid xl:grid-cols-[1fr_0.9fr] gap-4">
        <Card>
          {!selected && <p className="text-sm text-steel-muted">Select a drawing row for revision history.</p>}
          {selected && (
            <div className="space-y-4">
              <div className="flex justify-between gap-3">
                <div>
                  <div className="font-mono text-xs text-brand">{selected.drawingNumber}</div>
                  <h3 className="font-display text-2xl">{selected.title}</h3>
                  <p className="text-sm text-steel-muted">
                    {selected.discipline} · {selected.currentRev}
                  </p>
                </div>
                {!selected.isPublished && canUpload && (
                  <Button
                    onClick={async () => {
                      await api(`/api/drawings/${selected.id}/publish`, { method: "POST", token });
                      await load();
                    }}
                  >
                    Publish
                  </Button>
                )}
              </div>
              <div>
                <h4 className="text-xs font-mono uppercase tracking-wide text-steel-muted mb-2">Revision audit</h4>
                <ul className="space-y-2">
                  {(selected.revisions || []).map((r: any) => (
                    <li key={r.id} className="rounded-xl border border-line p-3 text-sm flex justify-between gap-2">
                      <div>
                        <div className="font-semibold">{r.revisionNumber}</div>
                        <div className="text-xs text-steel-muted">
                          {r.revisionLabel || "—"} · {new Date(r.createdAt).toLocaleString()}
                          {r.uploadedBy ? ` · ${r.uploadedBy.fullName || ""}` : ""}
                        </div>
                        {r.fileName && <div className="text-xs mt-1 font-mono">{r.fileName}</div>}
                      </div>
                      <Badge tone={r.published ? "ok" : "neutral"}>{r.published ? "Live" : "Draft"}</Badge>
                    </li>
                  ))}
                  {!selected.revisions?.length && <li className="text-steel-muted text-sm">No revision files yet.</li>}
                </ul>
              </div>
            </div>
          )}
        </Card>

        {canUpload && (
          <Card>
            <h3 className="font-semibold mb-3">Upload / register drawing</h3>
            <p className="text-xs text-steel-muted mb-3">
              Files store under project Drawings folders (mock OneDrive until Microsoft Graph is connected).
            </p>
            <form
              className="space-y-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData();
                Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
                if (file) fd.append("file", file);
                await api(`/api/drawings/project/${id}`, { method: "POST", token, body: fd });
                setForm({ ...form, drawingNumber: "", title: "" });
                setFile(null);
                await load();
              }}
            >
              <Input required placeholder="Number (e.g. A-101)" value={form.drawingNumber} onChange={(e) => setForm({ ...form, drawingNumber: e.target.value })} />
              <Input required placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <Select value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })}>
                {["Architecture", "Structural", "MEP", "Civil"].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
              <Input placeholder="Revision" value={form.revisionNumber} onChange={(e) => setForm({ ...form, revisionNumber: e.target.value })} />
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.publish} onChange={(e) => setForm({ ...form, publish: e.target.checked })} />
                Publish now (opens checklist & QA gate)
              </label>
              <Button type="submit" className="w-full">
                Save to GFC register
              </Button>
            </form>
          </Card>
        )}

        {clientOnly && (
          <Card>
            <h3 className="font-semibold mb-2">Client view</h3>
            <p className="text-sm text-steel-muted">
              You can browse published drawings and raise concerns under RFIs. Drawing upload and publish controls stay with Sharnam office.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
