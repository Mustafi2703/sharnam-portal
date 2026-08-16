import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, PageHeader } from "../../components/ui";

/** ISO folder from SharePoint tree — matches MODULE_TO_ISO_FOLDER.qap in graph.ts */
const QAP_FOLDER = "08_QUALITY_HSE_AND_ENVIRONMENT/08.01_Quality_Plans_and_Inspection_Test_Plans";

type DriveItem = { name: string; path: string; type: "folder" | "file"; modifiedAt?: string; url?: string };

/**
 * Quality Assurance Plan — upload / update client QAP (Week-50 sheet style).
 */
export default function QapPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [docs, setDocs] = useState<DriveItem[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const canUpload = ["admin", "office", "site_employee"].includes(user?.role || "");

  const load = async () => {
    if (!id) return;
    try {
      const res = await api<{ children: DriveItem[]; path: string }>(
        `/api/dms/${id}/browse?path=${encodeURIComponent(QAP_FOLDER)}&sync=0`,
        { token }
      );
      const files = (res.children || []).filter((f) => f.type === "file");
      setDocs(
        files.length
          ? files
          : (res.children || []).filter(
              (f) =>
                f.type === "file" &&
                (/qap|assurance|quality.?plan/i.test(f.name || f.path || "") ||
                  (f.path || "").toLowerCase().includes("qap"))
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
      fd.append("folder", QAP_FOLDER);
      await api(`/api/dms/${id}/upload`, { method: "POST", token, body: fd });
      setMsg("QAP uploaded to project DMS (Quality Plans folder).");
      setFile(null);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
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
            <Link to={`/projects/${id}/quality/checklist-master`}>
              <Button type="button" variant="secondary">
                Checklist master →
              </Button>
            </Link>
          </div>
        }
      />

      {msg && <p className="text-sm rounded-xl px-3 py-2 bg-brand-soft text-brand-dark">{msg}</p>}

      {canUpload && (
        <Card>
          <h3 className="font-semibold mb-2">Upload / update QAP</h3>
          <p className="text-sm text-steel-muted mb-3">
            Saves to DMS folder <code className="text-xs">{QAP_FOLDER.split("/").pop()}</code>. Accepts Excel or PDF from
            the shared Quality Assurance Plan pack.
          </p>
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
            <li key={d.path || d.name} className="py-2 flex justify-between gap-2">
              <span>{d.name}</span>
              <Badge tone="neutral">{d.modifiedAt ? new Date(d.modifiedAt).toLocaleDateString() : "—"}</Badge>
            </li>
          ))}
          {!docs.length && (
            <li className="py-6 text-steel-muted">
              No QAP on file yet — upload the Week-50 Quality Assurance Plan Excel (or latest revision).{" "}
              <Link to={`/projects/${id}/dms`} className="text-brand font-semibold">
                Open DMS →
              </Link>
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}
