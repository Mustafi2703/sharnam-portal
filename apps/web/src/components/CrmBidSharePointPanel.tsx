import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Button, Card } from "./ui";

type Node = {
  name: string;
  path: string;
  type: "folder" | "file";
  url?: string;
  children?: Node[];
};

type TreeResponse = {
  projectCode: string | null;
  comparativeSharePointUrl?: string | null;
  roots: Node[];
};

function TreeBranch({ node, depth = 0 }: { node: Node; depth?: number }) {
  const pad = depth * 14;
  const isFile = node.type === "file";
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 py-1 text-xs" style={{ paddingLeft: pad }}>
        <span aria-hidden>{isFile ? "📄" : "📁"}</span>
        <span className={isFile ? "font-mono text-ink" : "font-semibold text-ink"}>{node.name}</span>
        {node.url && (
          <a
            href={node.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand font-semibold hover:underline"
          >
            Open
          </a>
        )}
        <span className="text-[10px] text-steel-muted font-mono truncate max-w-[280px]">{node.path}</span>
      </div>
      {node.children?.map((c) => (
        <TreeBranch key={c.path} node={c} depth={depth + 1} />
      ))}
    </>
  );
}

/** ISO 05.05 / 05.06 procurement tree — vendor × discipline BOQs + live comparative master. */
export function CrmBidSharePointPanel({
  token,
  bidPackageId,
  vendorView = false,
}: {
  token: string;
  bidPackageId: string;
  vendorView?: boolean;
}) {
  const [tree, setTree] = useState<TreeResponse | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr("");
    try {
      const t = await api<TreeResponse>(`/api/crm/bid-packages/${bidPackageId}/sharepoint`, { token });
      setTree(t);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load SharePoint tree");
      setTree(null);
    }
  }, [bidPackageId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refreshMaster() {
    setBusy(true);
    try {
      await api(`/api/crm/bid-packages/${bidPackageId}/recompute`, { method: "POST", token });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="!p-4">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-brand">SharePoint · ISO 05 Procurement</p>
          <h3 className="font-semibold text-sm">
            {vendorView ? "My BOQ folders" : "Bid files — vendor × discipline + master comparative"}
          </h3>
          <p className="text-xs text-steel-muted mt-0.5">
            {tree?.projectCode ? (
              <>
                Project <strong className="font-mono">{tree.projectCode}</strong> · 05.05 one XLSX per bidder per discipline ·
                05.06 live master updates on save
              </>
            ) : (
              "Link a delivery project to sync folders."
            )}
          </p>
        </div>
        {!vendorView && (
          <Button type="button" variant="secondary" className="!text-xs" disabled={busy} onClick={() => void refreshMaster()}>
            {busy ? "Syncing…" : "Sync master to SharePoint"}
          </Button>
        )}
      </div>

      {err && <p className="text-xs text-warn mb-2">{err}</p>}

      {tree?.comparativeSharePointUrl && (
        <p className="text-xs mb-3">
          Master comparative:{" "}
          <a href={tree.comparativeSharePointUrl} target="_blank" rel="noopener noreferrer" className="text-brand font-semibold">
            Open in SharePoint
          </a>
        </p>
      )}

      <div className="border border-line rounded-xl bg-paper/80 max-h-64 overflow-y-auto p-3">
        {!tree?.roots?.length && !err && <p className="text-sm text-steel-muted">Loading folder tree…</p>}
        {tree?.roots.map((root) => (
          <div key={root.path} className="mb-3 last:mb-0">
            <TreeBranch node={root} />
          </div>
        ))}
      </div>
    </Card>
  );
}
