import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select } from "../../components/ui";

export default function DrawingsPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [drawings, setDrawings] = useState<any[]>([]);
  const [filter, setFilter] = useState("All");
  const [form, setForm] = useState({
    drawingNumber: "",
    title: "",
    discipline: "Architecture",
    revisionNumber: "Rev A",
    publish: true,
  });
  const [file, setFile] = useState<File | null>(null);
  const canUpload = user?.role === "admin" || user?.role === "office";

  const load = () => api<any[]>(`/api/drawings/project/${id}`, { token }).then(setDrawings);

  useEffect(() => {
    void load();
  }, [id, token]);

  const disciplines = ["All", ...Array.from(new Set(drawings.map((d) => d.discipline)))];
  const filtered = filter === "All" ? drawings : drawings.filter((d) => d.discipline === filter);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Drawing register"
        title="Drawings"
        subtitle="Publish sheets to unlock checklists and QA. Files land in Mock OneDrive by discipline folder."
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

      <div className="grid xl:grid-cols-[1.4fr_0.8fr] gap-4">
        <Card padding={false}>
          <div className="px-4 py-3 border-b bg-sand/40 font-semibold">
            {filtered.length} sheets
          </div>
          <ul className="divide-y max-h-[55vh] overflow-y-auto">
            {filtered.map((d) => (
              <li key={d.id} className="px-4 py-3 flex justify-between gap-2">
                <div>
                  <div className="font-mono text-[11px] text-brand">{d.drawingNumber}</div>
                  <div className="font-medium text-sm">{d.title}</div>
                  <div className="text-xs text-steel-muted">{d.discipline} · {d.currentRev}</div>
                </div>
                <div className="text-right">
                  <Badge tone={d.isPublished ? "ok" : "warn"}>{d.isPublished ? "Published" : "Draft"}</Badge>
                  {!d.isPublished && canUpload && (
                    <button
                      className="block text-xs text-brand mt-1"
                      onClick={async () => {
                        await api(`/api/drawings/${d.id}/publish`, { method: "POST", token });
                        await load();
                      }}
                    >
                      Publish
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {canUpload && (
          <Card>
            <h3 className="font-semibold mb-3">Upload / register drawing</h3>
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
              <Input required placeholder="Number" value={form.drawingNumber} onChange={(e) => setForm({ ...form, drawingNumber: e.target.value })} />
              <Input required placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <Select value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })}>
                {["Architecture", "Structural", "MEP", "Civil"].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.publish} onChange={(e) => setForm({ ...form, publish: e.target.checked })} />
                Publish now (opens checklist & QA gate)
              </label>
              <Button type="submit" className="w-full">Save to register</Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
