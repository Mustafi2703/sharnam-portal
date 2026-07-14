import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../components/ui";
import { BrandMark } from "../components/Brand";

type Item = { id: string; itemCode?: string; description: string; section?: string };

/** Spacious dedicated fill window for one Final Index / QI checklist */
export default function ChecklistFillPage() {
  const { id: projectId, assignmentId } = useParams();
  const [search] = useSearchParams();
  const family = search.get("family") || "SiteExecution";
  const { token, user } = useAuth();
  const [assignment, setAssignment] = useState<any>(null);
  const [drawings, setDrawings] = useState<any[]>([]);
  const [drawingId, setDrawingId] = useState("");
  const [responses, setResponses] = useState<Record<string, { answer: string; remarks: string }>>({});
  const [remarks, setRemarks] = useState("");
  const [msg, setMsg] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const canFill = ["admin", "office", "site_employee", "employee", "vendor"].includes(user?.role || "");

  const load = async () => {
    const [a, d] = await Promise.all([
      api<any>(`/api/checklist/assignments/${assignmentId}`, { token }),
      api<any[]>(`/api/drawings/project/${projectId}`, { token }),
    ]);
    setAssignment(a);
    const published = d.filter((x) => x.isPublished);
    setDrawings(published);
    if (!drawingId && published[0]) setDrawingId(published[0].id);
    const init: Record<string, { answer: string; remarks: string }> = {};
    a.template.items.forEach((i: Item) => {
      init[i.id] = { answer: "", remarks: "" };
    });
    setResponses(init);
  };

  useEffect(() => {
    void load();
  }, [assignmentId, projectId, token]);

  const items: Item[] = assignment?.template?.items || [];
  const sections = useMemo(() => Array.from(new Set(items.map((i) => i.section || "General"))), [items]);
  const answered = Object.values(responses).filter((r) => r.answer).length;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    if (!drawingId) {
      setMsg("Select the GFC drawing this checklist applies to.");
      return;
    }
    try {
      await api(`/api/checklist/assignments/${assignmentId}/submit`, {
        method: "POST",
        token,
        body: JSON.stringify({
          responsesJson: responses,
          drawingId,
          remarks,
          status: "Submitted",
        }),
      });
      setMsg("Submitted — audit log updated. Office can review.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="min-h-screen bg-sand">
      <header className="procore-topbar text-white sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <BrandMark size="sm" tagTone="dark" compact />
            <span className="text-xs text-white/60 truncate">
              {assignment?.project?.code} · Checklist fill
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="brand">{family === "QualityInspection" ? "Quality inspection" : "Final Index"}</Badge>
            <Link to={`/projects/${projectId}/${family === "QualityInspection" ? "quality-inspections" : "checklist"}`} className="text-xs text-white/80 hover:text-white">
              Close
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {!assignment ? (
          <p className="text-sm text-steel-muted">Loading checklist…</p>
        ) : (
          <>
            <PageHeader
              eyebrow={assignment.template.category}
              title={assignment.template.name}
              subtitle={`${assignment.project.name} — choose the published drawing, fill every line, then submit. Each fill is kept in the audit log below.`}
              actions={
                <div className="text-right">
                  <div className="text-2xl font-display text-brand">
                    {answered}/{items.length}
                  </div>
                  <div className="text-[11px] text-steel-muted font-mono uppercase tracking-wider">answered</div>
                </div>
              }
            />

            <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
              <form onSubmit={submit} className="space-y-6 brand-frame surface rounded-xl p-6 sm:p-8">
                <div className="grid sm:grid-cols-2 gap-4 pb-4 border-b border-line">
                  <label className="text-sm block">
                    <span className="font-medium">Apply to drawing (GFC)</span>
                    <Select className="mt-1" required value={drawingId} onChange={(e) => setDrawingId(e.target.value)}>
                      <option value="">Select published drawing…</option>
                      {drawings.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.drawingNumber} · {d.currentRev} — {d.title}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="text-sm block">
                    <span className="font-medium">Fill remarks</span>
                    <Input className="mt-1" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Weather / bay / grid notes" />
                  </label>
                </div>

                {sections.map((section) => (
                  <section key={section} className="space-y-4">
                    <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand">{section}</h3>
                    {items
                      .filter((i) => (i.section || "General") === section)
                      .map((item) => (
                        <div key={item.id} className="rounded-xl border border-line bg-white p-5 space-y-3">
                          <div className="text-[15px] leading-relaxed font-medium">
                            {item.itemCode && <span className="font-mono text-brand mr-2">{item.itemCode}</span>}
                            {item.description}
                          </div>
                          <div className="flex flex-wrap gap-2">
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
                                  className={`rounded-lg px-4 py-2 text-sm font-medium border transition ${
                                    on
                                      ? ans === "Yes"
                                        ? "bg-emerald-50 border-emerald-300 text-ok"
                                        : ans === "No"
                                          ? "bg-red-50 border-red-300 text-danger"
                                          : "bg-amber-50 border-amber-300 text-warn"
                                      : "bg-sand/60 border-line text-steel-muted hover:border-brand/40"
                                  }`}
                                >
                                  {ans}
                                </button>
                              );
                            })}
                          </div>
                          <Input
                            placeholder="Line remarks"
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
                  </section>
                ))}

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  {canFill && (
                    <Button type="submit" disabled={!drawings.length}>
                      Submit checklist
                    </Button>
                  )}
                  {!drawings.length && (
                    <span className="text-sm text-warn">Publish a drawing first — then pick it above.</span>
                  )}
                  {msg && <span className="text-sm text-steel-muted">{msg}</span>}
                </div>
              </form>

              <aside className="space-y-4 sticky top-16">
                <Card>
                  <h3 className="font-semibold text-sm mb-3">Audit log</h3>
                  <ul className="space-y-3 max-h-[50vh] overflow-y-auto text-sm">
                    {(assignment.submissions || []).map((s: any) => (
                      <li key={s.id} className="border-b border-line pb-3 last:border-0">
                        <div className="flex items-center justify-between gap-2">
                          <Badge tone={s.status === "Approved" ? "ok" : s.status === "Rejected" ? "danger" : "brand"}>
                            {s.status}
                          </Badge>
                          <span className="text-[11px] font-mono text-steel-muted">
                            {new Date(s.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="mt-1 font-medium">{s.submittedBy?.fullName}</div>
                        <div className="text-xs text-steel-muted">
                          {s.drawing
                            ? `${s.drawing.drawingNumber} · ${s.drawing.currentRev}`
                            : "No drawing linked"}
                        </div>
                      </li>
                    ))}
                    {!assignment.submissions?.length && (
                      <li className="text-steel-muted text-xs">No fills yet — first submission starts the log.</li>
                    )}
                  </ul>
                </Card>

                <Card>
                  <h3 className="font-semibold text-sm mb-2">Email notice</h3>
                  <p className="text-[11px] text-steel-muted mb-2">
                    Uses project notification emails (configure under Project settings).
                  </p>
                  <TextArea
                    rows={3}
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    placeholder="Optional note to project distribution…"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-2 w-full !text-xs"
                    onClick={async () => {
                      try {
                        await api(`/api/projects/${projectId}/emails/send`, {
                          method: "POST",
                          token,
                          body: JSON.stringify({
                            subject: `Checklist: ${assignment.template.name}`,
                            body: emailBody || `Please review checklist ${assignment.template.name}.`,
                            context: "checklist.notify",
                          }),
                        });
                        setMsg("Email queued to project distribution.");
                      } catch (err) {
                        setMsg(err instanceof Error ? err.message : "Email failed — set recipients in settings");
                      }
                    }}
                  >
                    Send email
                  </Button>
                </Card>
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
