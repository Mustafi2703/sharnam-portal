import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader } from "../../components/ui";

/** Thin wrappers reusing existing module pages patterns for Procore tools nav */
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

export function CoordinationPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [title, setTitle] = useState("");

  const load = () =>
    api<any>(`/api/directory/project/${id}/overview`, { token }).then((o) => setRows(o.coordination || []));

  useEffect(() => {
    void load();
  }, [id, token]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Design" title="Design coordination" subtitle="Clash / coordination issues across disciplines." />
      {(user?.role === "admin" || user?.role === "office") && (
        <Card>
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              await api(`/api/directory/project/${id}/coordination`, {
                method: "POST",
                token,
                body: JSON.stringify({ title, discipline: "MEP", priority: "Medium" }),
              });
              setTitle("");
              await load();
            }}
          >
            <Input className="flex-1" placeholder="Issue title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <Button type="submit">Log issue</Button>
          </form>
        </Card>
      )}
      <Card padding={false}>
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-3 flex justify-between text-sm">
              <div>
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-steel-muted">{r.discipline} · {r.priority}</div>
              </div>
              <Badge tone={r.status === "Open" ? "warn" : "ok"}>{r.status}</Badge>
            </li>
          ))}
          {!rows.length && <li className="p-4 text-sm text-steel-muted">No coordination issues.</li>}
        </ul>
      </Card>
    </div>
  );
}
