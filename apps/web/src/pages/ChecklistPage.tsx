import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, WorkflowStrip } from "../components/ui";

type Item = { id: string; itemCode?: string; description: string; section?: string };
type Template = { id: string; name: string; items: Item[] };
type Assignment = {
  id: string;
  status: string;
  template: { id: string; name: string; category: string; _count: { items: number } };
  submissions: { id: string; status: string; createdAt: string; submittedBy: { fullName: string } }[];
};

export default function ChecklistPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [data, setData] = useState<{
    assignments: Assignment[];
    canSubmit: boolean;
    publishedDrawings: number;
  } | null>(null);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [responses, setResponses] = useState<Record<string, { answer: string; remarks: string }>>({});
  const [msg, setMsg] = useState("");
  const canFill = ["admin", "office", "site_employee", "employee"].includes(user?.role || "");
  const canReview = user?.role === "admin" || user?.role === "office";

  const load = () =>
    api<{ assignments: Assignment[]; canSubmit: boolean; publishedDrawings: number }>(
      `/api/checklist/project/${id}`,
      { token }
    ).then(setData);

  useEffect(() => {
    void load();
  }, [id, token]);

  const categories = useMemo(() => {
    const set = new Set(data?.assignments.map((a) => a.template.category) || []);
    return ["All", ...Array.from(set).sort()];
  }, [data]);

  const filtered = useMemo(() => {
    return (data?.assignments || []).filter((a) => {
      const catOk = category === "All" || a.template.category === category;
      const q = query.trim().toLowerCase();
      const qOk = !q || a.template.name.toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [data, category, query]);

  const activeAssignment = useMemo(
    () => data?.assignments.find((a) => a.id === active) || null,
    [data, active]
  );

  useEffect(() => {
    if (!activeAssignment) return;
    api<Template>(`/api/checklist/templates/${activeAssignment.template.id}`, { token }).then((t) => {
      setTemplate(t);
      const init: Record<string, { answer: string; remarks: string }> = {};
      t.items.forEach((i) => {
        init[i.id] = { answer: "", remarks: "" };
      });
      setResponses(init);
      setMsg("");
    });
  }, [activeAssignment, token]);

  const answered = Object.values(responses).filter((r) => r.answer).length;
  const total = template?.items.length || 0;
  const sections = useMemo(() => {
    if (!template) return [] as string[];
    return Array.from(new Set(template.items.map((i) => i.section || "General")));
  }, [template]);

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/projects/${id}`} className="text-sm text-brand font-medium">
          ← Project hub
        </Link>
        <PageHeader
          eyebrow="Quality assurance"
          title="Checklists"
          subtitle="Excel masters become structured forms. Site submit is blocked until drawings are published."
          actions={
            data && (
              <Badge tone={data.canSubmit ? "ok" : "warn"}>
                {data.canSubmit
                  ? `${data.publishedDrawings} published drawings`
                  : "Waiting on published drawings"}
              </Badge>
            )
          }
        />
      </div>

      <WorkflowStrip
        active={data?.canSubmit ? (active ? 2 : 1) : 0}
        steps={[
          { label: "Drawing published", hint: "Office unlocks the gate" },
          { label: "Pick checklist", hint: `${data?.assignments.length || 0} assigned to project` },
          { label: "Fill Yes / No / N.A.", hint: "Remarks per line item" },
          { label: "Office review", hint: "Approve for client visibility" },
        ]}
      />

      <div className="grid lg:grid-cols-[380px_1fr] gap-4 items-start">
        <Card padding={false} className="overflow-hidden sticky top-4">
          <div className="p-4 border-b border-line space-y-3 bg-sand/30">
            <Input
              placeholder="Search checklists…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="flex flex-wrap gap-1">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`rounded-full px-2.5 py-1 text-[11px] ${
                    category === c ? "bg-brand text-white" : "bg-white border border-line text-steel-muted"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-steel-muted">
              {filtered.length} templates
            </p>
          </div>
          <div className="max-h-[65vh] overflow-y-auto divide-y divide-line">
            {filtered.map((a) => {
              const latest = a.submissions[0];
              return (
                <button
                  key={a.id}
                  className={`w-full text-left p-4 transition ${
                    active === a.id ? "bg-brand-soft/70" : "hover:bg-sand/30"
                  }`}
                  onClick={() => setActive(a.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-sm leading-snug">{a.template.name}</div>
                    <Badge tone="neutral">{a.template._count.items}</Badge>
                  </div>
                  <div className="text-[11px] text-steel-muted mt-1.5 font-mono">{a.template.category}</div>
                  {latest && (
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <Badge
                        tone={
                          latest.status === "Approved"
                            ? "ok"
                            : latest.status === "Rejected"
                              ? "danger"
                              : "warn"
                        }
                      >
                        {latest.status}
                      </Badge>
                      <span className="text-[11px] text-steel-muted truncate">{latest.submittedBy.fullName}</span>
                    </div>
                  )}
                  {canReview && latest?.status === "Submitted" && (
                    <div className="mt-2 flex gap-2">
                      <button
                        className="text-xs text-ok font-medium"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await api(`/api/checklist/submissions/${latest.id}/review`, {
                            method: "POST",
                            token,
                            body: JSON.stringify({ status: "Approved" }),
                          });
                          await load();
                        }}
                      >
                        Approve
                      </button>
                      <button
                        className="text-xs text-danger font-medium"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await api(`/api/checklist/submissions/${latest.id}/review`, {
                            method: "POST",
                            token,
                            body: JSON.stringify({ status: "Rejected" }),
                          });
                          await load();
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </button>
              );
            })}
            {!filtered.length && (
              <div className="p-6 text-sm text-steel-muted text-center">No checklists match.</div>
            )}
          </div>
        </Card>

        <Card>
          {!template && (
            <div className="py-16 text-center">
              <div className="font-display text-2xl text-ink">Select a checklist</div>
              <p className="text-steel-muted mt-2 text-sm max-w-sm mx-auto">
                Browse the catalog on the left. Each line becomes Yes / No / N.A. with remarks — the site
                workflow Sharnam wants instead of Excel uploads.
              </p>
            </div>
          )}
          {template && (
            <form
              className="space-y-5"
              onSubmit={async (e) => {
                e.preventDefault();
                setMsg("");
                try {
                  await api(`/api/checklist/assignments/${active}/submit`, {
                    method: "POST",
                    token,
                    body: JSON.stringify({ responsesJson: responses, status: "Submitted" }),
                  });
                  setMsg("Submitted to office for review");
                  await load();
                } catch (err) {
                  setMsg(err instanceof Error ? err.message : "Failed");
                }
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-line">
                <div>
                  <h2 className="font-display text-2xl leading-tight">{template.name}</h2>
                  <p className="text-sm text-steel-muted mt-1">
                    {answered}/{total} answered
                    {sections.length > 1 ? ` · ${sections.length} sections` : ""}
                  </p>
                </div>
                <div className="w-40">
                  <div className="h-2 rounded-full bg-steel/10 overflow-hidden">
                    <div
                      className="h-full bg-brand transition-all"
                      style={{ width: `${total ? (answered / total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="max-h-[58vh] overflow-y-auto space-y-6 pr-1">
                {sections.map((section) => (
                  <div key={section}>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand mb-3 sticky top-0 bg-paper/95 py-1 backdrop-blur">
                      {section}
                    </div>
                    <div className="space-y-3">
                      {template.items
                        .filter((i) => (i.section || "General") === section)
                        .map((item) => (
                          <div
                            key={item.id}
                            className="rounded-2xl border border-line bg-white/80 p-4 hover:border-brand/30 transition"
                          >
                            <div className="text-sm font-medium leading-snug">
                              {item.itemCode ? (
                                <span className="font-mono text-brand mr-2">{item.itemCode}</span>
                              ) : null}
                              {item.description}
                            </div>
                            <div className="flex flex-wrap gap-2 mt-3">
                              {["Yes", "No", "N.A."].map((ans) => {
                                const on = responses[item.id]?.answer === ans;
                                return (
                                  <button
                                    key={ans}
                                    type="button"
                                    onClick={() =>
                                      setResponses({
                                        ...responses,
                                        [item.id]: { ...responses[item.id], answer: ans },
                                      })
                                    }
                                    className={`rounded-full px-3.5 py-1.5 text-xs font-medium border transition ${
                                      on
                                        ? ans === "Yes"
                                          ? "bg-emerald-50 border-emerald-300 text-ok"
                                          : ans === "No"
                                            ? "bg-red-50 border-red-300 text-danger"
                                            : "bg-amber-50 border-amber-300 text-warn"
                                        : "bg-white border-line text-steel-muted hover:border-brand/40"
                                    }`}
                                  >
                                    {ans}
                                  </button>
                                );
                              })}
                            </div>
                            <Input
                              className="mt-3"
                              placeholder="Remarks / photo ref"
                              value={responses[item.id]?.remarks || ""}
                              onChange={(e) =>
                                setResponses({
                                  ...responses,
                                  [item.id]: { ...responses[item.id], remarks: e.target.value },
                                })
                              }
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-line flex flex-wrap items-center gap-3">
                {canFill && (
                  <Button type="submit" disabled={!data?.canSubmit}>
                    Submit for review
                  </Button>
                )}
                {!data?.canSubmit && (
                  <span className="text-sm text-warn">Publish at least one drawing to unlock submit.</span>
                )}
                {msg && <span className="text-sm text-steel-muted">{msg}</span>}
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
