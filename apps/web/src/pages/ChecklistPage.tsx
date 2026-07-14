import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, Select, WorkflowStrip } from "../components/ui";

export type ChecklistFamily = "SiteExecution" | "QualityInspection";

const FAMILY_META: Record<
  ChecklistFamily,
  { eyebrow: string; title: string; subtitle: string; otherTo: string; otherLabel: string }
> = {
  SiteExecution: {
    eyebrow: "Site execution",
    title: "Final Index checklists",
    subtitle: "Open each form in a spacious fill window. Choose the GFC drawing, fill Yes/No/N.A., and keep an audit log per checklist.",
    otherTo: "quality-inspections",
    otherLabel: "Quality Inspections →",
  },
  QualityInspection: {
    eyebrow: "Quality assurance",
    title: "Quality inspection checklists",
    subtitle: "Separate QI library (pre-pour, drawing review…). Not Final Index site-execution forms.",
    otherTo: "checklist",
    otherLabel: "Final Index (site) →",
  },
};

type Assignment = {
  id: string;
  status: string;
  template: { id: string; name: string; category: string; checklistType?: string; _count: { items: number } };
  submissions: { id: string; status: string; createdAt: string; submittedBy: { fullName: string } }[];
};

export default function ChecklistPage({ family = "SiteExecution" as ChecklistFamily }: { family?: ChecklistFamily }) {
  const { id } = useParams();
  const { token, user } = useAuth();
  const meta = FAMILY_META[family];
  const [data, setData] = useState<{
    assignments: Assignment[];
    canSubmit: boolean;
    publishedDrawings: number;
  } | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [addTemplateId, setAddTemplateId] = useState("");
  const [msg, setMsg] = useState("");
  const canManage = ["admin", "office", "employee", "site_employee"].includes(user?.role || "");

  const load = async () => {
    const [d, t] = await Promise.all([
      api<{ assignments: Assignment[]; canSubmit: boolean; publishedDrawings: number }>(
        `/api/checklist/project/${id}?type=${encodeURIComponent(family)}`,
        { token }
      ),
      api<any[]>(`/api/checklist/templates?type=${encodeURIComponent(family)}`, { token }),
    ]);
    setData(d);
    setTemplates(t);
  };

  useEffect(() => {
    void load();
  }, [id, token, family]);

  const categories = useMemo(() => {
    const set = new Set(data?.assignments.map((a) => a.template.category) || []);
    return ["All", ...Array.from(set).sort()];
  }, [data]);

  const filtered = useMemo(() => {
    return (data?.assignments || []).filter((a) => {
      const catOk = category === "All" || a.template.category === category;
      const q = query.trim().toLowerCase();
      return catOk && (!q || a.template.name.toLowerCase().includes(q));
    });
  }, [data, category, query]);

  const assignedIds = new Set(data?.assignments.map((a) => a.template.id) || []);
  const available = templates.filter((t) => !assignedIds.has(t.id));

  function openFill(assignmentId: string) {
    const url = `${window.location.origin}/projects/${id}/checklist/fill/${assignmentId}?family=${family}`;
    window.open(url, "_blank", "noopener,noreferrer,width=1400,height=900");
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/workspace`} className="text-sm text-brand font-medium">
          ← Workspaces
        </Link>
        <PageHeader
          eyebrow={meta.eyebrow}
          title={meta.title}
          subtitle={meta.subtitle}
          actions={
            <div className="flex flex-wrap gap-2 items-center">
              <Link to={`/projects/${id}/${meta.otherTo}`} className="text-xs font-semibold text-brand underline">
                {meta.otherLabel}
              </Link>
              <Badge tone={data?.canSubmit ? "ok" : "warn"}>
                {data?.canSubmit ? `${data.publishedDrawings} published drawings` : "Waiting on published drawings"}
              </Badge>
            </div>
          }
        />
      </div>

      <WorkflowStrip
        active={data?.canSubmit ? 1 : 0}
        steps={[
          { label: "Drawing published", hint: "Unlocks fills" },
          { label: "Manage catalog", hint: "Assign forms" },
          { label: "Open fill window", hint: "Spacious + drawing pick" },
          { label: "Audit & email", hint: "Log + notify" },
        ]}
      />

      {canManage && (
        <Card>
          <h3 className="font-semibold mb-3">Manage checklists</h3>
          <div className="flex flex-wrap gap-2 items-end">
            <label className="text-sm flex-1 min-w-[220px]">
              Add template to project
              <Select className="mt-1" value={addTemplateId} onChange={(e) => setAddTemplateId(e.target.value)}>
                <option value="">Select template…</option>
                {available.slice(0, 200).map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.category}] {t.name}
                  </option>
                ))}
              </Select>
            </label>
            <Button
              type="button"
              disabled={!addTemplateId}
              onClick={async () => {
                setMsg("");
                try {
                  await api(`/api/checklist/project/${id}/assign`, {
                    method: "POST",
                    token,
                    body: JSON.stringify({ templateId: addTemplateId }),
                  });
                  setAddTemplateId("");
                  setMsg("Checklist assigned to project.");
                  await load();
                } catch (err) {
                  setMsg(err instanceof Error ? err.message : "Failed");
                }
              }}
            >
              Assign
            </Button>
          </div>
          {msg && <p className="text-sm text-steel-muted mt-2">{msg}</p>}
        </Card>
      )}

      <Card padding={false} className="overflow-hidden">
        <div className="p-4 border-b border-line space-y-3 bg-sand/40">
          <Input placeholder="Search checklists…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${
                  category === c ? "bg-brand text-white" : "bg-white border border-line text-steel-muted"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-steel-muted">
            {filtered.length} forms · open in new window to fill
          </p>
        </div>
        <ul className="divide-y divide-line max-h-[70vh] overflow-y-auto">
          {filtered.map((a) => {
            const latest = a.submissions[0];
            return (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 hover:bg-brand-soft/30">
                <div className="min-w-0">
                  <div className="font-medium text-sm leading-snug">{a.template.name}</div>
                  <div className="text-[11px] text-steel-muted mt-1 font-mono">
                    {a.template.category} · {a.template._count.items} items
                    {latest ? ` · last ${latest.status} by ${latest.submittedBy.fullName}` : " · no fills yet"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" className="!text-xs !py-1.5" onClick={() => openFill(a.id)}>
                    Open fill window
                  </Button>
                  {canManage && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="!text-xs !py-1.5 text-danger"
                      onClick={async () => {
                        if (!confirm("Remove this checklist from the project?")) return;
                        await api(`/api/checklist/assignments/${a.id}`, { method: "DELETE", token });
                        await load();
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
          {!filtered.length && <li className="p-8 text-center text-sm text-steel-muted">No checklists in this family yet — assign from Manage above.</li>}
        </ul>
      </Card>
    </div>
  );
}
