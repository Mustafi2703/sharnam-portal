import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

export default function DmsPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [path, setPath] = useState("");
  const [data, setData] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState("");
  const canUpload = user?.role === "admin" || user?.role === "office";

  const load = () =>
    api(`/api/dms/${id}/browse?path=${encodeURIComponent(path)}`, { token }).then(setData);

  useEffect(() => {
    void load();
  }, [id, path, token]);

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/projects/${id}`} className="text-sm text-brand">
          ← Project
        </Link>
        <h1 className="font-display text-4xl mt-1">DMS · Mock OneDrive</h1>
        <p className="text-steel-muted">
          Project folder tree with Drawings / Documents / Photos. Swap to Microsoft Graph when Azure is ready.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-xl bg-brand text-white px-4 py-2 text-sm"
          onClick={async () => {
            const r = await api<any>(`/api/dms/${id}/sync`, { method: "POST", token });
            setMsg(r.message);
            await load();
          }}
        >
          Sync drive
        </button>
        {path && (
          <button className="rounded-xl border px-4 py-2 text-sm" onClick={() => setPath(path.split("/").slice(0, -1).join("/"))}>
            Up
          </button>
        )}
      </div>
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}

      <div className="rounded-2xl bg-white border border-black/5 p-4">
        <div className="text-xs text-steel-muted mb-3">/{data?.projectCode}/{path}</div>
        <ul className="divide-y divide-black/5">
          {data?.children?.map((c: any) => (
            <li key={c.path} className="py-2 flex justify-between gap-2 text-sm">
              {c.type === "folder" ? (
                <button className="text-left font-medium text-brand" onClick={() => setPath(c.path)}>
                  📁 {c.name}
                </button>
              ) : (
                <a className="font-medium" href={c.url} target="_blank" rel="noreferrer">
                  📄 {c.name}
                </a>
              )}
              <span className="text-steel-muted">{c.type}</span>
            </li>
          ))}
          {!data?.children?.length && <li className="text-steel-muted text-sm py-2">Empty folder</li>}
        </ul>
      </div>

      {canUpload && (
        <form
          className="rounded-2xl bg-white border border-black/5 p-4 flex flex-wrap gap-2 items-center"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!file) return;
            const fd = new FormData();
            fd.append("file", file);
            fd.append("folder", path || "Documents");
            await api(`/api/dms/${id}/upload`, { method: "POST", token, body: fd });
            setFile(null);
            await load();
          }}
        >
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button className="rounded-xl bg-steel text-white px-4 py-2 text-sm">Upload to current folder</button>
        </form>
      )}
    </div>
  );
}
