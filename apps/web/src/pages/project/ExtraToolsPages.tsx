import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../../components/ui";

export function CoordinationPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    discipline: "MEP",
    location: "",
    priority: "Medium",
  });
  const [filter, setFilter] = useState("All");
  const canEdit =
    user?.role === "admin" ||
    user?.role === "office" ||
    user?.role === "employee" ||
    user?.role === "site_employee";

  const load = () =>
    api<any>(`/api/directory/project/${id}/overview`, { token }).then((o) => setRows(o.coordination || []));

  useEffect(() => {
    void load();
  }, [id, token]);

  const filtered = rows.filter((r) => filter === "All" || r.status === filter);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Design"
        title="Design coordination"
        subtitle="Clash and coordination issues across Architecture, Structural, MEP, and Civil — open / close status."
      />

      {canEdit && (
        <Card>
          <h3 className="font-semibold mb-3">Raise coordination issue</h3>
          <form
            className="grid sm:grid-cols-2 gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              await api(`/api/directory/project/${id}/coordination`, {
                method: "POST",
                token,
                body: JSON.stringify(form),
              });
              setForm({ title: "", description: "", discipline: "MEP", location: "", priority: "Medium" });
              await load();
            }}
          >
            <Input className="sm:col-span-2" required placeholder="Issue title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Select value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })}>
              {["Architecture", "Structural", "MEP", "Civil"].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
            <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {["Low", "Medium", "High"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
            <Input placeholder="Location / grid" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <TextArea
              className="sm:col-span-2"
              rows={2}
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <Button type="submit" className="sm:col-span-2">
              Log issue
            </Button>
          </form>
        </Card>
      )}

      <div className="flex gap-1">
        {["All", "Open", "Closed"].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded px-3 py-1 text-xs border ${filter === f ? "bg-procore-navy text-white" : "bg-white border-line"}`}
          >
            {f}
          </button>
        ))}
      </div>

      <Card padding={false}>
        <ul className="divide-y">
          {filtered.map((r) => (
            <li key={r.id} className="px-4 py-3 flex flex-wrap justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-steel-muted mt-0.5">
                  {r.discipline} · {r.priority}
                  {r.location ? ` · ${r.location}` : ""}
                </div>
                {r.description && <p className="text-xs text-steel-muted mt-1">{r.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={r.status === "Open" ? "warn" : "ok"}>{r.status}</Badge>
                {canEdit && r.status === "Open" && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="!text-xs !py-1"
                    onClick={async () => {
                      await api(`/api/directory/coordination/${r.id}`, {
                        method: "PATCH",
                        token,
                        body: JSON.stringify({ status: "Closed" }),
                      });
                      await load();
                    }}
                  >
                    Close
                  </Button>
                )}
              </div>
            </li>
          ))}
          {!filtered.length && <li className="p-4 text-sm text-steel-muted">No coordination issues.</li>}
        </ul>
      </Card>
    </div>
  );
}

export function SubmittalsPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [title, setTitle] = useState("");

  const load = () =>
    api<any>(`/api/directory/project/${id}/overview`, { token }).then((o) => setRows(o.submittals || []));

  useEffect(() => {
    void load();
  }, [id, token]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Approvals" title="Submittals" subtitle="Product data, shop drawings, samples — ball-in-court workflow." />
      {(user?.role === "admin" || user?.role === "office") && (
        <Card>
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              await api(`/api/directory/project/${id}/submittals`, {
                method: "POST",
                token,
                body: JSON.stringify({ title, submittalType: "Product Data" }),
              });
              setTitle("");
              await load();
            }}
          >
            <Input className="flex-1" placeholder="Submittal title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <Button type="submit">Create</Button>
          </form>
        </Card>
      )}
      <Card padding={false}>
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-3 flex justify-between text-sm">
              <div>
                <span className="font-mono text-xs text-brand mr-2">{r.number}</span>
                {r.title}
              </div>
              <Badge>{r.status}</Badge>
            </li>
          ))}
          {!rows.length && <li className="p-4 text-steel-muted text-sm">No submittals yet.</li>}
        </ul>
      </Card>
    </div>
  );
}

export function PhotosPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [description, setDescription] = useState("");
  const [album, setAlbum] = useState("Site");

  const load = () =>
    api<any>(`/api/directory/project/${id}/overview`, { token }).then((o) => setRows(o.photos || []));

  useEffect(() => {
    void load();
  }, [id, token]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Media" title="Photos" subtitle="Albums for site capture — feeds diary, RFIs, and inspections." />
      <Card>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await api(`/api/directory/project/${id}/photos`, {
              method: "POST",
              token,
              body: JSON.stringify({ description, album, fileUrl: `/uploads/photos/${Date.now()}.txt` }),
            });
            setDescription("");
            await load();
          }}
        >
          <Input className="flex-1" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} required />
          <Input placeholder="Album" value={album} onChange={(e) => setAlbum(e.target.value)} />
          <Button type="submit">Add photo record</Button>
        </form>
      </Card>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map((p) => (
          <Card key={p.id}>
            <Badge tone="brand">{p.album}</Badge>
            <div className="mt-2 text-sm font-medium">{p.description || "Photo"}</div>
            <div className="text-xs text-steel-muted mt-1">{new Date(p.createdAt).toLocaleString()}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
