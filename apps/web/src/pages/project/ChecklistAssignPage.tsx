import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, PageHeader, Select } from "../../components/ui";

/** Full page — assign checklist types to project (Procore-style tool) */
export default function ChecklistAssignPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [family, setFamily] = useState<"SiteExecution" | "QualityInspection">("SiteExecution");
  const [templates, setTemplates] = useState<any[]>([]);
  const [assigned, setAssigned] = useState<any[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [gate, setGate] = useState({ publishedCount: 0, canSubmit: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const canManage = ["admin", "office", "employee", "site_employee"].includes(user?.role || "");

  const load = async () => {
    const [d, t] = await Promise.all([
      api<{ assignments: any[]; canSubmit: boolean; publishedDrawings: number }>(
        `/api/checklist/project/${id}?type=${encodeURIComponent(family)}`,
        { token }
      ),
      api<any[]>(`/api/checklist/templates?type=${encodeURIComponent(family)}`, { token }),
    ]);
    setAssigned(d.assignments || []);
    setGate({ publishedCount: d.publishedDrawings, canSubmit: d.canSubmit });
    const used = new Set((d.assignments || []).map((a: any) => a.template.id));
    setTemplates(t.filter((x) => !used.has(x.id)));
  };

  useEffect(() => {
    void load();
  }, [id, token, family]);

  if (!canManage) {
    return (
      <Card>
        <p className="text-sm text-steel-muted">Only office / site can assign checklist types.</p>
        <Link to={`/projects/${id}/checklist`} className="text-brand text-sm font-semibold mt-3 inline-block">
          ← Checklist catalog
        </Link>
      </Card>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!templateId) return;
    setBusy(true);
    setError("");
    setMsg("");
    try {
      await api(`/api/checklist/project/${id}/assign`, {
        method: "POST",
        token,
        body: JSON.stringify({ templateId }),
      });
      setMsg("Checklist type assigned. Raise a Drawing or QI fill RFI so matrix parties / vendor can complete it.");
      setTemplateId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        eyebrow="Quality · Procore-style"
        title="Assign checklist type"
        subtitle="Add Final Index or QI forms to this project. Engineers open Fill vs drawing and pick sheet + revision."
        actions={
          <Link to={`/projects/${id}/checklist`}>
            <Button type="button" variant="secondary">
              Open catalog
            </Button>
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2 items-center">
        <Badge tone={gate.canSubmit ? "ok" : "warn"}>
          {gate.canSubmit ? `${gate.publishedCount} published drawings` : "Gate locked — publish a drawing first"}
        </Badge>
        <Button type="button" variant="ghost" className="!text-xs" onClick={() => navigate(`/projects/${id}/drawings?upload=1`)}>
          Upload drawing
        </Button>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="px-5 py-3 bg-procore-navy text-white">
          <div className="text-sm font-semibold">Checklist type upload / assign</div>
          <div className="text-[11px] text-white/70">Template → project catalog → engineer fill window</div>
        </div>
        <form className="p-5 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm">
            <span className="text-xs font-mono uppercase tracking-wider text-steel-muted">Family</span>
            <Select
              className="mt-1.5"
              value={family}
              onChange={(e) => setFamily(e.target.value as "SiteExecution" | "QualityInspection")}
            >
              <option value="SiteExecution">Final Index (site execution)</option>
              <option value="QualityInspection">Quality Inspections</option>
            </Select>
          </label>
          <label className="block text-sm">
            <span className="text-xs font-mono uppercase tracking-wider text-steel-muted">Template</span>
            <Select className="mt-1.5" value={templateId} onChange={(e) => setTemplateId(e.target.value)} required>
              <option value="">Select checklist type…</option>
              {templates.slice(0, 200).map((t) => (
                <option key={t.id} value={t.id}>
                  [{t.category}] {t.name}
                </option>
              ))}
            </Select>
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          {msg && <p className="text-sm text-ok">{msg}</p>}
          <Button type="submit" disabled={busy || !templateId} className="w-full !py-3">
            {busy ? "Assigning…" : "Assign checklist type"}
          </Button>
        </form>
      </Card>

      <Card>
        <h3 className="font-semibold mb-2">Already on project ({assigned.length})</h3>
        <ul className="divide-y divide-line max-h-64 overflow-y-auto">
          {assigned.map((a) => (
            <li key={a.id} className="py-2.5 flex justify-between gap-2 text-sm">
              <span>{a.template.name}</span>
              <span className="font-mono text-[11px] text-steel-muted">{a.template.category}</span>
            </li>
          ))}
          {!assigned.length && <li className="py-4 text-sm text-steel-muted">None yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
