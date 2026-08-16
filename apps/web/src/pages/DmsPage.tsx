import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, apiBase } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader } from "../components/ui";
import { UploadModal } from "../components/UploadModal";
import { DrawingFileViewer } from "../components/DrawingFileViewer";
import { drawingFileKind, type DrawingPreview } from "../lib/drawingPreview";

type DriveItem = {
  name: string;
  path: string;
  type: "folder" | "file";
  url?: string;
  size?: number;
  modifiedAt?: string;
};

type BrowseData = {
  projectCode: string;
  path: string;
  fullPath: string;
  children: DriveItem[];
  syncedAt?: string;
  provider?: string;
};

function formatBytes(n?: number) {
  if (!n && n !== 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function fileUrl(projectCode: string, item: DriveItem) {
  if (item.url?.startsWith("http")) return item.url;
  if (item.url?.startsWith("/")) return `${apiBase()}${item.url}`;
  return `${apiBase()}/uploads/onedrive/${projectCode}/${item.path}`;
}

function isPdf(name: string) {
  return /\.pdf$/i.test(name);
}
function isImage(name: string) {
  return /\.(png|jpe?g|webp|gif)$/i.test(name);
}

function folderLabel(path: string) {
  if (!path) return "Project root";
  const leaf = path.split("/").pop() || path;
  return leaf.replace(/_/g, " ");
}

/** Build collapsible tree nodes from flat folder paths */
function buildFolderTree(folders: string[], rootPrefix = "") {
  const roots: { path: string; label: string; depth: number }[] = [];
  const seen = new Set<string>();
  const baseDepth = rootPrefix ? rootPrefix.split("/").filter(Boolean).length : 0;
  for (const f of folders) {
    if (seen.has(f)) continue;
    seen.add(f);
    const depth = Math.max(0, f.split("/").filter(Boolean).length - baseDepth - 1);
    roots.push({ path: f, label: folderLabel(f), depth });
  }
  return roots.sort((a, b) => a.path.localeCompare(b.path));
}

/** ISO root for GFC / design files — separate from general Documents module */
export const DRAWINGS_LIBRARY_ROOT =
  "04_DESIGN_AND_INFORMATION_MANAGEMENT/04.02_Drawings_and_Specifications";

/** Discipline subfolders shown in Drawings → Drawing files (not full DMS tree) */
export const DRAWINGS_DISCIPLINE_FOLDERS = ["Architecture", "Structural", "MEP", "Civil"] as const;

export type DmsPageMode = "documents" | "drawings";

/**
 * Procore-style document manager — browse ISO folder tree, preview files,
 * upload into current folder. Live SharePoint when configured.
 *
 * mode=documents — full project DMS (Procore Documents parity)
 * mode=drawings  — design/engineering folders only (paired with GFC register)
 */
export default function DmsPage({ mode = "documents", embedded = false }: { mode?: DmsPageMode; embedded?: boolean }) {
  const { id } = useParams();
  const { token, user } = useAuth();
  const canUpload = user?.role === "admin" || user?.role === "office";
  const isDrawings = mode === "drawings";
  const rootPrefix = isDrawings ? DRAWINGS_LIBRARY_ROOT : "";

  const [path, setPath] = useState(isDrawings ? DRAWINGS_LIBRARY_ROOT : "");
  const [data, setData] = useState<BrowseData | null>(null);
  const [folderPaths, setFolderPaths] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [msg, setMsg] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [viewer, setViewer] = useState<DrawingPreview | null>(null);
  const [treeQuery, setTreeQuery] = useState("");

  const load = useCallback(
    async (folderPath = path) => {
      if (!id) return;
      setSyncing(true);
      try {
        const res = await api<BrowseData>(
          `/api/dms/${id}/browse?path=${encodeURIComponent(folderPath)}&sync=0`,
          { token }
        );
        setData(res);
      } catch (err) {
        setMsg(err instanceof Error ? err.message : "Browse failed");
      } finally {
        setSyncing(false);
      }
    },
    [id, path, token]
  );

  useEffect(() => {
    if (!id) return;
    api<{ folders: string[] }>(`/api/dms/${id}/folders`, { token })
      .then((r) => setFolderPaths(r.folders || []))
      .catch(() => setFolderPaths([]));
  }, [id, token]);

  useEffect(() => {
    void load(path);
  }, [load, path]);

  const breadcrumbs = useMemo(() => {
    const rel = rootPrefix && path.startsWith(rootPrefix)
      ? path.slice(rootPrefix.length).replace(/^\//, "")
      : path;
    if (!rel) {
      return [{ label: isDrawings ? "Design & Engineering" : "Root", path: rootPrefix || "" }];
    }
    const parts = rel.split("/").filter(Boolean);
    const base = rootPrefix || "";
    return [
      { label: isDrawings ? "Design & Engineering" : "Root", path: base },
      ...parts.map((_, i) => ({
        label: parts[i].replace(/_/g, " "),
        path: base ? `${base}/${parts.slice(0, i + 1).join("/")}` : parts.slice(0, i + 1).join("/"),
      })),
    ];
  }, [path, rootPrefix, isDrawings]);

  const folderTree = useMemo(() => {
    const scoped = rootPrefix
      ? folderPaths.filter((f) => f === rootPrefix || f.startsWith(`${rootPrefix}/`))
      : folderPaths;
    const tree = buildFolderTree(scoped, rootPrefix);
    if (!isDrawings) return tree;
    return tree.filter(
      (n) =>
        n.path === rootPrefix ||
        DRAWINGS_DISCIPLINE_FOLDERS.some((d) => n.path === `${rootPrefix}/${d}` || n.path.startsWith(`${rootPrefix}/${d}/`))
    );
  }, [folderPaths, rootPrefix, isDrawings]);
  const filteredTree = useMemo(() => {
    const q = treeQuery.trim().toLowerCase();
    if (!q) return folderTree;
    return folderTree.filter((n) => n.path.toLowerCase().includes(q) || n.label.toLowerCase().includes(q));
  }, [folderTree, treeQuery]);

  const contents = useMemo(() => {
    const list = data?.children || [];
    const q = filter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => c.name.toLowerCase().includes(q));
  }, [data?.children, filter]);

  const folders = contents.filter((c) => c.type === "folder");
  const files = contents.filter((c) => c.type === "file");

  async function fullSync() {
    if (!id) return;
    setMsg("Syncing project library…");
    const r = await api<any>(`/api/dms/${id}/sync`, { method: "POST", token });
    setMsg(r.message || "Sync complete");
    await load(path);
  }

  async function onUploadSubmit(e: FormEvent) {
    e.preventDefault();
    if (!id || !uploadFile) return;
    setUploadBusy(true);
    setUploadErr("");
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("folder", path || "_Registers");
      const saved = await api<any>(`/api/dms/${id}/upload`, { method: "POST", token, body: fd });
      setMsg(`Uploaded → ${saved.provider === "sharepoint" ? "SharePoint" : "drive"} · ${saved.path}`);
      setUploadFile(null);
      setUploadOpen(false);
      await load(path);
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  }

  function openItem(item: DriveItem) {
    if (item.type === "folder") {
      setPath(item.path);
      return;
    }
    const url = fileUrl(data?.projectCode || "", item);
    setViewer({
      title: item.name,
      fileUrl: url,
      fileName: item.name,
      kind: drawingFileKind(item.name),
    });
  }

  const canPreviewInApp = user?.role === "admin" || user?.role === "office" || user?.role === "employee";

  const isSharePoint = data?.provider === "sharepoint";

  return (
    <div className={`space-y-4 min-w-0 ${embedded ? "" : ""}`}>
      {!embedded && (
        <Link
          to={isDrawings ? `/projects/${id}/hub/drawings` : `/projects/${id}`}
          className="text-sm text-brand font-medium"
        >
          ← {isDrawings ? "Drawings module" : "Project"}
        </Link>
      )}

      {isDrawings && !embedded && (
        <p className="text-xs text-steel-muted">
          Sheet PDFs and DWG files live here. For revision register, publish gate, and R0–R5 workflow use{" "}
          <Link to={`/projects/${id}/drawings`} className="text-brand font-semibold">
            GFC register →
          </Link>
        </p>
      )}

      <PageHeader
        eyebrow={isDrawings ? "Drawings · files" : "Documents"}
        title={isDrawings ? "Drawing file library" : "Document manager"}
        subtitle={
          isDrawings
            ? "Drawing PDFs/DWG only — discipline folders under 04.02. Office users preview in-app; SharePoint opens in a new tab when required."
            : "Procore-style browse of the ISO folder tree — contracts, HSE, daily records, and all non-drawing project files."
        }
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <Badge tone={isSharePoint ? "ok" : "warn"}>{isSharePoint ? "SharePoint" : "Local mock"}</Badge>
            {canUpload && (
              <Button type="button" onClick={() => setUploadOpen(true)}>
                Upload
              </Button>
            )}
            <Button type="button" variant="secondary" disabled={syncing} onClick={() => void fullSync()}>
              {syncing ? "Syncing…" : "Sync library"}
            </Button>
          </div>
        }
      />

      {msg && <p className="text-sm rounded-lg px-3 py-2 bg-brand-soft text-brand-dark">{msg}</p>}

      <nav className="dms-breadcrumbs" aria-label="Folder path">
        {breadcrumbs.map((b, i) => (
          <span key={b.path || "root"} className="dms-breadcrumbs__item">
            {i > 0 && <span className="dms-breadcrumbs__sep">/</span>}
            <button type="button" className={path === b.path ? "dms-breadcrumbs__active" : ""} onClick={() => setPath(b.path)}>
              {b.label}
            </button>
          </span>
        ))}
      </nav>

      <div className="grid lg:grid-cols-[minmax(220px,280px)_1fr] gap-4 min-h-[480px]">
        {/* Folder tree */}
        <Card padding={false} className="flex flex-col overflow-hidden max-h-[70vh]">
          <div className="px-3 py-2.5 border-b border-line bg-procore-navy text-white text-xs font-semibold">
            {isDrawings ? "Drawing folders" : "Folders · ISO Rev 02"}
          </div>
          <div className="p-2 border-b border-line">
            <Input
              placeholder="Filter folders…"
              value={treeQuery}
              onChange={(e) => setTreeQuery(e.target.value)}
              className="!text-xs"
            />
          </div>
          <ul className="flex-1 overflow-y-auto p-1 text-sm">
            <li>
              <button
                type="button"
                className={`dms-tree__link w-full text-left ${path === (rootPrefix || "") ? "dms-tree__link--active" : ""}`}
                onClick={() => setPath(rootPrefix || "")}
              >
                📂 {isDrawings ? "Design & Engineering" : "Project root"}
              </button>
            </li>
            {filteredTree.map((node) => (
              <li key={node.path}>
                <button
                  type="button"
                  className={`dms-tree__link w-full text-left ${path === node.path ? "dms-tree__link--active" : ""}`}
                  style={{ paddingLeft: `${8 + node.depth * 12}px` }}
                  onClick={() => setPath(node.path)}
                  title={node.path}
                >
                  {node.depth === 0 ? "📁" : "📂"} {node.label}
                </button>
              </li>
            ))}
          </ul>
        </Card>

        {/* Contents pane */}
        <Card padding={false} className="flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-line bg-sand/40 flex flex-wrap gap-2 justify-between items-center">
            <div>
              <span className="font-semibold text-sm">{folderLabel(path)}</span>
              <span className="text-[11px] text-steel-muted ml-2">
                {folders.length} folders · {files.length} files
                {data?.syncedAt && ` · synced ${formatDate(data.syncedAt)}`}
              </span>
            </div>
            <Input
              placeholder="Filter in folder…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="!text-xs max-w-[200px]"
            />
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-steel-muted border-b border-line bg-paper sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold">Name</th>
                  <th className="text-left px-2 py-2 font-semibold w-24">Type</th>
                  <th className="text-left px-2 py-2 font-semibold w-24">Size</th>
                  <th className="text-left px-2 py-2 font-semibold w-36">Modified</th>
                  <th className="text-right px-4 py-2 font-semibold w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {folders.map((c) => (
                  <tr key={c.path} className="hover:bg-sand/50 cursor-pointer" onClick={() => openItem(c)}>
                    <td className="px-4 py-2.5 font-medium text-brand">📁 {c.name}</td>
                    <td className="px-2 py-2.5 text-steel-muted">Folder</td>
                    <td className="px-2 py-2.5 text-steel-muted">—</td>
                    <td className="px-2 py-2.5 text-steel-muted text-xs">{formatDate(c.modifiedAt)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Button type="button" variant="ghost" className="!py-1 !text-xs" onClick={(e) => { e.stopPropagation(); openItem(c); }}>
                        Open
                      </Button>
                    </td>
                  </tr>
                ))}
                {files.map((c) => (
                  <tr key={c.path} className="hover:bg-sand/50">
                    <td className="px-4 py-2.5 font-medium">📄 {c.name}</td>
                    <td className="px-2 py-2.5 text-steel-muted uppercase text-[10px]">{c.name.split(".").pop() || "file"}</td>
                    <td className="px-2 py-2.5 text-steel-muted text-xs">{formatBytes(c.size)}</td>
                    <td className="px-2 py-2.5 text-steel-muted text-xs">{formatDate(c.modifiedAt)}</td>
                    <td className="px-4 py-2.5 text-right flex gap-1 justify-end">
                      <Button type="button" variant="ghost" className="!py-1 !text-xs" onClick={() => openItem(c)}>
                        {canPreviewInApp && (isPdf(c.name) || isImage(c.name)) ? "Preview" : "Open"}
                      </Button>
                      <a
                        href={fileUrl(data?.projectCode || "", c)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-brand px-2 py-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Open
                      </a>
                    </td>
                  </tr>
                ))}
                {!contents.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-steel-muted">
                      {syncing ? "Loading…" : "Empty folder — upload a file or pick another folder from the tree."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <UploadModal
        open={uploadOpen}
        title="Upload document"
        context={path ? `Folder: ${path}` : "Project root / _Registers"}
        file={uploadFile}
        onFile={setUploadFile}
        accept={isDrawings ? ".pdf,.dwg,application/pdf" : ".pdf,.png,.jpg,.jpeg,.webp,.dwg,.doc,.docx,.xls,.xlsx"}
        fields={[]}
        primaryLabel="Upload to SharePoint"
        busy={uploadBusy}
        error={uploadErr}
        onClose={() => {
          setUploadOpen(false);
          setUploadFile(null);
          setUploadErr("");
        }}
        onSubmit={onUploadSubmit}
      />

      {viewer && (
        <DrawingFileViewer
          preview={viewer}
          variant="modal"
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}
