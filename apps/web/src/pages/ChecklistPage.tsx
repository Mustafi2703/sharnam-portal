import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

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
  const [data, setData] = useState<{ assignments: Assignment[]; canSubmit: boolean; publishedDrawings: number } | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [responses, setResponses] = useState<Record<string, { answer: string; remarks: string }>>({});
  const [msg, setMsg] = useState("");
  const canFill = ["admin", "office", "site_employee", "employee"].includes(user?.role || "");
  const canReview = user?.role === "admin" || user?.role === "office";

  const load = () =>
    api<{ assignments: Assignment[]; canSubmit: boolean; publishedDrawings: number }>(`/api/checklist/project/${id}`, {
      token,
    }).then(setData);

  useEffect(() => {
    void load();
  }, [id, token]);

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
    });
  }, [activeAssignment, token]);

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/projects/${id}`} className="text-sm text-brand">
          ← Project
        </Link>
        <h1 className="font-display text-4xl mt-1">Checklists</h1>
        <p className="text-steel-muted">
          Excel masters converted to forms. Site submit requires published drawings.
        </p>
        {data && (
          <p className={`text-sm mt-2 ${data.canSubmit ? "text-emerald-700" : "text-amber-800"}`}>
            {data.canSubmit
              ? `Gate open (${data.publishedDrawings} published drawings)`
              : "Blocked until a drawing is published for this project"}
          </p>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white border border-black/5 divide-y">
          {data?.assignments.map((a) => (
            <button
              key={a.id}
              className={`w-full text-left p-4 ${active === a.id ? "bg-brand-soft" : ""}`}
              onClick={() => setActive(a.id)}
            >
              <div className="font-medium">{a.template.name}</div>
              <div className="text-xs text-steel-muted mt-1">
                {a.template.category} · {a.template._count.items} items · {a.submissions.length} submissions
              </div>
              {a.submissions[0] && (
                <div className="text-xs mt-2">
                  Latest: {a.submissions[0].status} by {a.submissions[0].submittedBy.fullName}
                  {canReview && a.submissions[0].status === "Submitted" && (
                    <span className="ml-2">
                      <button
                        className="text-emerald-700"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await api(`/api/checklist/submissions/${a.submissions[0].id}/review`, {
                            method: "POST",
                            token,
                            body: JSON.stringify({ status: "Approved" }),
                          });
                          await load();
                        }}
                      >
                        Approve
                      </button>
                    </span>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="rounded-2xl bg-white border border-black/5 p-4">
          {!template && <p className="text-steel-muted text-sm">Select a checklist to fill.</p>}
          {template && (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setMsg("");
                try {
                  await api(`/api/checklist/assignments/${active}/submit`, {
                    method: "POST",
                    token,
                    body: JSON.stringify({ responsesJson: responses, status: "Submitted" }),
                  });
                  setMsg("Submitted for review");
                  await load();
                } catch (err) {
                  setMsg(err instanceof Error ? err.message : "Failed");
                }
              }}
            >
              <h2 className="font-semibold">{template.name}</h2>
              <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
                {template.items.map((item) => (
                  <div key={item.id} className="rounded-xl border border-black/5 p-3">
                    {item.section && (
                      <div className="text-[10px] uppercase tracking-wider text-steel-muted mb-1">
                        {item.section}
                      </div>
                    )}
                    <div className="text-sm font-medium">
                      {item.itemCode ? `${item.itemCode}. ` : ""}
                      {item.description}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2 text-sm">
                      {["Yes", "No", "N.A."].map((ans) => (
                        <label key={ans} className="flex items-center gap-1">
                          <input
                            type="radio"
                            name={item.id}
                            checked={responses[item.id]?.answer === ans}
                            onChange={() =>
                              setResponses({
                                ...responses,
                                [item.id]: { ...responses[item.id], answer: ans },
                              })
                            }
                          />
                          {ans}
                        </label>
                      ))}
                    </div>
                    <input
                      className="mt-2 w-full rounded-lg border px-2 py-1.5 text-sm"
                      placeholder="Remarks"
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
              {canFill && (
                <button
                  disabled={!data?.canSubmit}
                  className="rounded-xl bg-brand text-white px-4 py-2 text-sm disabled:opacity-50"
                >
                  Submit checklist
                </button>
              )}
              {msg && <p className="text-sm text-steel-muted">{msg}</p>}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
