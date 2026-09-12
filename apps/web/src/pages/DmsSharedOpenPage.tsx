import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, apiBase } from "../api";
import { useAuth } from "../auth";
import { Button, Card, PageHeader } from "../components/ui";
import { DrawingFileViewer } from "../components/DrawingFileViewer";
import { drawingFileKind } from "../lib/drawingPreview";

type SharedMeta = {
  fileName: string;
  filePath: string;
  fileUrl: string;
  expiresAt?: string | null;
  project?: { id: string; code: string; name: string };
};

/** Vendor/client open an office-approved DMS request link. */
export default function DmsSharedOpenPage() {
  const { token: shareToken } = useParams();
  const { user, token } = useAuth();
  const [meta, setMeta] = useState<SharedMeta | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!shareToken || !token) return;
    void api<SharedMeta>(`/api/dms/shared/${shareToken}`, { token })
      .then((row) => {
        setMeta(row);
        setErr("");
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "This link is not for this login, or it expired."));
  }, [shareToken, token]);

  if (!user) {
    return (
      <Card className="max-w-lg mx-auto mt-12 space-y-3">
        <h1 className="font-display text-2xl">Sign in to open this file</h1>
        <p className="text-sm text-steel-muted">Office shared a project document. Use your vendor or client login.</p>
        <Link to={`/login?next=${encodeURIComponent(`/dms/open/${shareToken || ""}`)}`}>
          <Button type="button">Sign in</Button>
        </Link>
      </Card>
    );
  }

  if (err) {
    return (
      <Card className="max-w-lg mx-auto mt-12 space-y-3">
        <h1 className="font-display text-2xl">Access needed</h1>
        <p className="text-sm text-steel-muted">{err}</p>
        <p className="text-sm text-steel-muted">Ask office to share the file again from Documents.</p>
        <Link to="/dashboard" className="text-sm font-semibold text-brand">
          Back to dashboard →
        </Link>
      </Card>
    );
  }

  if (!meta) {
    return <p className="text-sm text-steel-muted py-12 text-center">Opening shared file…</p>;
  }

  const fileUrl = `${apiBase()}${meta.fileUrl}`;

  return (
    <div className="space-y-4 min-w-0 pb-8">
      <PageHeader
        eyebrow="Shared document"
        title={meta.fileName}
        subtitle={`${meta.project?.code || ""} · ${meta.filePath}${
          meta.expiresAt ? ` · expires ${new Date(meta.expiresAt).toLocaleDateString("en-IN")}` : ""
        }`}
        actions={
          meta.project?.id ? (
            <Link to={`/projects/${meta.project.id}/dms`}>
              <Button type="button" variant="secondary">
                Project documents
              </Button>
            </Link>
          ) : null
        }
      />
      <DrawingFileViewer
        preview={{
          title: meta.fileName,
          fileUrl,
          fileName: meta.fileName,
          kind: drawingFileKind(meta.fileName),
        }}
        variant="inline"
      />
    </div>
  );
}
