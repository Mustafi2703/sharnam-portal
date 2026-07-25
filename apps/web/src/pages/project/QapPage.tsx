import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, PageHeader } from "../../components/ui";

/**
 * Quality Assurance Plan — upload / update client QAP (Week-50 sheet style).
 */
export default function QapPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const canEdit = ["admin", "office", "employee", "client", "site_employee"].includes(user?.role || "");

  const load = async () => {
    if (!id) return;
    try {
      const list = await api<any[]>(`/api/dms/project/${id}?folder=Quality/QAP`, { token }).catch(() =>
        api<any[]>(`/api/dms/project/${id}`, { token }).catch(() => [])
      );
      const rows = Array.isArray(list) ? list : (list as any)?.files || [];
      setDocs(
        rows.filter(
          (f: any) =>
            /qap|assurance|quality.?plan/i.test(f.name || f.fileName || f.path || "") ||
            (f.folder || f.path || "").toLowerCase().includes("qap")
        )
      );
    } catch {
      setDocs([]);
    }
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!file || !id) return;
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "Quality/QAP");
      fd.append("name", file.name);
      await api(`/api/dms/project/${id}/upload`, { method: "POST", token, body: fd }).catch(async () => {
        await api(`/api/dms/upload`, {
          method: "POST",
          token,
          body: (() => {
            const f = new FormData();
            f.append("file", file);
            f.append("projectId", id);
            f.append("folder", "Quality/QAP");
            return f;
          })(),
        });
      });
      setMsg("QAP uploaded / updated.");
      setFile(null);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed — file kept locally in DMS when API path differs.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Quality · QAP"
        title="Quality Assurance Plan"
        subtitle="Upload and update the project QAP (client Week-50 sheet). Keep the latest plan visible for Office, Site, and Client."
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge tone="ok">Always available</Badge>
            <Link to={`/projects/${id}/checklist-master?family=QualityInspection`}>
              <Button type="button" variant="secondary">
                Checklist master →
              </Button>
            </Link>
          </div>
        }
      />

      {msg && <p className="text-sm rounded-xl px-3 py-2 bg-brand-soft text-brand-dark">{msg}</p>}

      {canEdit && (
        <Card>
          <h3 className="font-semibold mb-2">Upload / update QAP</h3>
          <p className="text-sm text-steel-muted mb-3">Accepts Excel or PDF from the shared Quality Assurance Plan pack.</p>
          <form className="flex flex-wrap items-end gap-3" onSubmit={onUpload}>
            <input
              type="file"
              accept=".xlsx,.xls,.pdf,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-sm"
            />
            <Button type="submit" disabled={!file || busy}>
              {busy ? "Uploading…" : "Save QAP"}
            </Button>
          </form>
        </Card>
      )}

      <Card>
        <h3 className="font-semibold mb-3">Current QAP files</h3>
        <ul className="divide-y divide-line text-sm">
          {docs.map((d) => (
            <li key={d.id || d.name} className="py-2 flex justify-between gap-2">
              <span>{d.name || d.fileName}</span>
              <Badge tone="neutral">{d.updatedAt ? new Date(d.updatedAt).toLocaleDateString() : "—"}</Badge>
            </li>
          ))}
          {!docs.length && (
            <li className="py-6 text-steel-muted">
              No QAP on file yet — upload the Week-50 Quality Assurance Plan Excel (or latest revision).
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}
