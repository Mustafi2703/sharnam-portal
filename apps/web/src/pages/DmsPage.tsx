import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, PageHeader } from "../components/ui";

/**
 * OneDrive-style DMS — browsable now; sync-on-open per folder.
 * Real Microsoft Graph plugs into the same browse contract later.
 */
export default function DmsPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [path, setPath] = useState("");
  const [data, setData] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState("");
  const [syncing, setSyncing] = useState(false);
  const canUpload = user?.role === "admin" || user?.role === "office";

  const load = async (folderPath = path) => {
    setSyncing(true);
    try {
      const res = await api<any>(
        `/api/dms/${id}/browse?path=${encodeURIComponent(folderPath)}&sync=1`,
        { token }
      );
      setData(res);
      if (res.syncedAt) setMsg(`Synced folder · ${new Date(res.syncedAt).toLocaleTimeString()}`);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    void load(path);
  }, [id, path, token]);

  function openFolder(rel: string) {
    setPath(rel);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/projects/${id}`} className="text-sm text-brand font-medium">
          ← Project
        </Link>
        <PageHeader
          eyebrow="Documents · OneDrive contract"
          title="Project drive"
          subtitle="All project documents are browsable here. Opening a folder syncs that path (mock now → Microsoft Graph later). Uploads land in the current folder."
          actions={<Badge tone={syncing ? "warn" : "ok"}>{syncing ? "Syncing…" : "Live browse"}</Badge>}
        />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            const r = await api<any>(`/api/dms/${id}/sync`, { method: "POST", token });
            setMsg(r.message);
            await load(path);
          }}
        >
          Full drive sync
        </Button>
        {path && (
          <Button type="button" variant="ghost" onClick={() => setPath(path.split("/").slice(0, -1).join("/"))}>
            Up one level
          </Button>
        )}
        <span className="text-xs font-mono text-steel-muted">
          /{data?.projectCode}/{path || "(root)"}
        </span>
      </div>
      {msg && <p className="text-sm text-brand bg-brand-soft/50 px-3 py-2 rounded-lg">{msg}</p>}

      <div className="grid lg:grid-cols-[220px_1fr] gap-4">
        <Card padding={false} className="overflow-hidden h-fit">
          <div className="px-3 py-2.5 bg-procore-navy text-white text-xs font-semibold">Quick folders</div>
          <ul className="p-2 space-y-0.5 text-sm">
            {[
              ["", "Root"],
              ["Drawings", "Drawings"],
              ["Documents", "Documents"],
              ["Documents/DPR", "DPR"],
              ["Documents/WPR", "WPR"],
              ["Documents/QAP", "QAP"],
              ["Documents/Communication-Matrix", "Comm matrix"],
              ["Checklists", "Checklists"],
              ["RFIs", "RFIs"],
              ["Safety", "Safety"],
              ["Cost-Bills", "Cost / bills"],
              ["Photos", "Photos"],
            ].map(([p, label]) => (
              <li key={p || "root"}>
                <button
                  type="button"
                  className={`w-full text-left px-2 py-1.5 rounded-md ${
                    path === p ? "bg-brand-soft text-brand font-semibold" : "hover:bg-sand"
                  }`}
                  onClick={() => openFolder(p)}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card padding={false} className="overflow-hidden">
          <div className="px-4 py-3 border-b border-line bg-sand/40 flex justify-between gap-2">
            <span className="font-semibold text-sm">Contents</span>
            <span className="text-[11px] text-steel-muted">{data?.provider || "mock-onedrive"} · sync on open</span>
          </div>
          <ul className="divide-y divide-line min-h-[240px]">
            {data?.children?.map((c: any) => (
              <li key={c.path} className="px-4 py-3 flex justify-between gap-2 text-sm">
                {c.type === "folder" ? (
                  <button type="button" className="text-left font-medium text-brand" onClick={() => openFolder(c.path)}>
                    📁 {c.name}
                    <span className="block text-[11px] text-steel-muted font-normal">Opens & syncs this folder</span>
                  </button>
                ) : (
                  <a className="font-medium hover:text-brand" href={c.url} target="_blank" rel="noreferrer">
                    📄 {c.name}
                  </a>
                )}
                <span className="text-steel-muted text-xs uppercase">{c.type}</span>
              </li>
            ))}
            {!data?.children?.length && (
              <li className="px-4 py-8 text-sm text-steel-muted text-center">Empty — upload or sync full drive.</li>
            )}
          </ul>
        </Card>
      </div>

      {canUpload && (
        <Card>
          <h3 className="font-semibold mb-2">Upload into current folder</h3>
          <form
            className="flex flex-wrap gap-2 items-center"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!file) return;
              const fd = new FormData();
              fd.append("file", file);
              fd.append("folder", path || "Documents");
              await api(`/api/dms/${id}/upload`, { method: "POST", token, body: fd });
              setFile(null);
              setMsg(`Uploaded to /${path || "Documents"}`);
              await load(path);
            }}
          >
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <Button type="submit" disabled={!file}>
              Upload
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
