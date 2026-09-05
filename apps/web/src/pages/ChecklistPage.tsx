import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, Select } from "../components/ui";
import { moduleForChecklistFamily } from "../lib/rfiModuleScope";

export type ChecklistFamily = "SiteExecution" | "QualityInspection";

const FAMILY_META: Record<
  ChecklistFamily,
  {
    eyebrow: string;
    title: string;
    subtitle: string;
    rfiKind: string;
    masterPath: string;
    logsPath: string;
    assignPath: string;
  }
> = {
  SiteExecution: {
    eyebrow: "Progress · site checklists",
    title: "Site checklists",
    subtitle:
      "Choose types from Progress checklist master, assign to this project, then request site fill. Partial save, photos, and branded PDF/XLSX go to SharePoint.",
    rfiKind: "SiteExecution",
    masterPath: "progress/checklist-master",
    logsPath: "progress/checklist-logs",
    assignPath: "checklist/assign",
  },
  QualityInspection: {
    eyebrow: "Quality · legacy QI templates",
    title: "QI checklist templates",
    subtitle:
      "Template library for Request QI fill RFIs. Live Procore-style inspections are under Quality → Inspections.",
    rfiKind: "QualityInspection",
    masterPath: "quality/checklist-master",
    logsPath: "quality/checklist-logs",
    assignPath: "checklist/assign",
  },
};

type Assignment = {
  id: string;
  status: string;
  template: { id: string; name: string; category: string; checklistType?: string; _count: { items: number } };
  submissions: {
    id: string;
    status: string;
    createdAt: string;
    submittedBy: { fullName: string; role?: string };
    progress?: { progressLabel: string; answerPct: number; statusHint?: string };
  }[];
  latestDraft?: {
    status: string;
    submittedBy: { fullName: string; role?: string };
    progress?: { progressLabel: string; answerPct: number };
  } | null;
};

export default function ChecklistPage({ family = "SiteExecution" as ChecklistFamily }: { family?: ChecklistFamily }) {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [showAssign, setShowAssign] = useState(false);
  const canManage = ["admin", "office", "employee", "site_employee"].includes(user?.role || "");
  const canFill = ["admin", "office", "site_employee", "employee", "vendor"].includes(user?.role || "");
  const isClient = user?.role === "client";

  const load = async () => {
    const [d, t] = await Promise.all([
      api<{ assignments: Assignment[]; canSubmit: boolean; publishedDrawings: number }>(
        `/api/checklist/project/${id}?type=${encodeURIComponent(family)}`,
        { token },
      ),
      api<any[]>(`/api/checklist/templates?type=${encodeURIComponent(family)}`, { token }),
    ]);
    setData(d);
    setTemplates(t);
  };

  useEffect(() => {
    void load();
  }, [id, token, family]);

  useEffect(() => {
    if (searchParams.get("assign") === "1" && canManage) {
      setShowAssign(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, canManage, setSearchParams]);

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

  const byCategory = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const a of filtered) {
      const k = a.template.category || "General";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(a);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const assignedIds = new Set(data?.assignments.map((a) => a.template.id) || []);
  const available = templates.filter((t) => !assignedIds.has(t.id));

  function openFill(assignmentId: string) {
    const url = `${window.location.origin}/projects/${id}/checklist/fill/${assignmentId}?family=${family}`;
    window.open(url, "_blank", "noopener,noreferrer,width=1400,height=900");
  }

  const hubModule = moduleForChecklistFamily(family);

  return (
    <div className="space-y-4 w-full min-w-0">
      <PageHeader
        eyebrow={meta.eyebrow}
        title={meta.title}
        subtitle={meta.subtitle}
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <Link to={`/projects/${id}/${meta.masterPath}`}>
              <Button type="button" variant="secondary" className="!text-xs">
                Checklist master
              </Button>
            </Link>
            <Link to={`/projects/${id}/${meta.logsPath}`}>
              <Button type="button" variant="secondary" className="!text-xs">
                Fill log & exports
              </Button>
            </Link>
            {canManage && (
              <Button type="button" className="!text-xs" onClick={() => setShowAssign((v) => !v)}>
                {showAssign ? "Hide assign" : "Assign from master"}
              </Button>
            )}
            {canManage && (
              <Link to={`/projects/${id}/rfis?kind=${meta.rfiKind}&compose=1`}>
                <Button type="button" variant="secondary" className="!text-xs">
                  Request fill →
                </Button>
              </Link>
            )}
            <Badge tone="ok">{filtered.length} on project</Badge>
          </div>
        }
      />

      {isClient && (
        <Card className="bg-brand-soft/40 border-brand/20">
          <div className="font-semibold">Client & PMC status view</div>
          <p className="text-sm text-steel-muted mt-1">
            Track draft or submitted progress and evidence. Filling is for matrix parties, office, site, and vendors.
          </p>
          <Link to={`/projects/${id}/${meta.logsPath}`} className="inline-block mt-2 text-sm font-semibold text-brand">
            Open fill log →
          </Link>
        </Card>
      )}

      {canManage && showAssign && (
        <Card>
          <h3 className="font-semibold mb-1">Assign checklist type</h3>
          <p className="text-xs text-steel-muted mb-3">
            Templates come from{" "}
            <Link to={`/projects/${id}/${meta.masterPath}`} className="text-brand font-semibold">
              checklist master
            </Link>
            . After assign, raise a{" "}
            {family === "QualityInspection" ? "QI fill" : "site checklist fill"} RFI so assignees complete the form.
          </p>
          <div className="flex flex-wrap gap-2 items-end">
            <label className="text-sm flex-1 min-w-[220px]">
              Template
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
                  setMsg("Checklist type assigned to project.");
                  await load();
                } catch (err) {
                  setMsg(err instanceof Error ? err.message : "Failed");
                }
              }}
            >
              Assign
            </Button>
            <Link to={`/projects/${id}/${meta.assignPath}?family=${family}`} className="text-xs font-semibold text-brand self-center">
              Open assign desk →
            </Link>
          </div>
          {msg && <p className="text-sm text-steel-muted mt-2">{msg}</p>}
        </Card>
      )}

      <Card padding={false} className="overflow-hidden w-full">
        <div className="p-4 border-b border-line space-y-3 bg-sand/40">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Input
              className="max-w-md flex-1 min-w-[200px]"
              placeholder="Search assigned checklist types…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <p className="font-mono text-[10px] uppercase tracking-wider text-steel-muted">
              {filtered.length} types · partial save + SharePoint export on fill
            </p>
          </div>
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
        </div>

        <div className="divide-y divide-line max-h-[min(72vh,680px)] overflow-y-auto">
          {byCategory.map(([cat, items]) => (
            <div key={cat}>
              <div className="px-4 py-2 bg-procore-navy text-white text-[11px] font-mono uppercase tracking-wider sticky top-0 z-[1]">
                {cat} · {items.length} type{items.length === 1 ? "" : "s"}
              </div>
              <ul>
                {items.map((a) => {
                  const latest = a.submissions[0];
                  const draft = a.latestDraft || a.submissions.find((s) => s.status === "Draft");
                  const show = draft || latest;
                  return (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 hover:bg-brand-soft/30 border-t border-line"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm leading-snug">{a.template.name}</div>
                        <div className="text-[11px] text-steel-muted mt-1 font-mono">
                          {a.template._count.items} items
                          {a.template.checklistType ? ` · ${a.template.checklistType}` : ""}
                          {show
                            ? ` · ${show.status} · ${show.progress?.progressLabel || "?"} (${show.progress?.answerPct ?? 0}%) by ${show.submittedBy.fullName}`
                            : " · not started"}
                        </div>
                        {show?.progress && (
                          <div className="mt-1.5 w-40 h-1 bg-line rounded-full overflow-hidden">
                            <div className="h-full bg-brand" style={{ width: `${show.progress.answerPct}%` }} />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        {canFill && (
                          <Button type="button" className="!text-xs !py-1.5" onClick={() => openFill(a.id)}>
                            {draft ? "Continue fill" : "Fill form"}
                          </Button>
                        )}
                        {canManage && (
                          <Link
                            to={`/projects/${id}/rfis?kind=${meta.rfiKind}&compose=1`}
                            className="text-xs font-semibold text-mark self-center px-1"
                          >
                            Request fill
                          </Link>
                        )}
                        {canManage && (
                          <Button
                            type="button"
                            variant="ghost"
                            className="!text-xs !py-1.5 text-danger"
                            onClick={async () => {
                              if (!confirm("Remove this checklist type from the project?")) return;
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
              </ul>
            </div>
          ))}
          {!filtered.length && (
            <div className="p-8 text-center text-sm text-steel-muted space-y-2">
              <p>No checklist types assigned yet.</p>
              <Link to={`/projects/${id}/${meta.masterPath}`} className="text-brand font-semibold">
                Open checklist master →
              </Link>
            </div>
          )}
        </div>
      </Card>

      {family === "SiteExecution" && (
        <p className="text-xs text-steel-muted">
          Module hub:{" "}
          <Link to={`/projects/${id}/hub/${hubModule}`} className="text-brand font-semibold">
            {hubModule} tools
          </Link>
        </p>
      )}
    </div>
  );
}
