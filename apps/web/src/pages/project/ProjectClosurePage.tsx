import { FormEvent, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../../components/ui";
import { CLOSURE_SHEET_VIEWS, closureSheetFromParams } from "../../lib/closureSheetViews";

const API_BASE = import.meta.env.VITE_API_URL || "";

const SECTION_LABELS: Record<string, string> = {
  projectOverview: "Project overview",
  scopeDelivered: "Scope delivered",
  snagSummary: "Snag summary",
  lessonsSummary: "Lessons learnt summary",
  handoverChecklist: "Handover checklist",
  clientSignOff: "Client sign-off",
  pmcSignOff: "PMC sign-off",
};

export default function ProjectClosurePage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const sheetView = closureSheetFromParams(searchParams);
  const sheetKey = sheetView.key;
  const { token, user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [sections, setSections] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [snagForm, setSnagForm] = useState({
    itemDescription: "",
    location: "",
    package: "",
    severity: "Medium",
    priority: "Medium",
    vendor: "",
  });
  const [lessonForm, setLessonForm] = useState({
    category: "",
    description: "",
    wentWell: "",
    notMetExpectation: "",
    lessonsLearnt: "",
  });
  const canEdit = ["admin", "office", "employee", "site_employee"].includes(user?.role || "");

  const load = async () => {
    const [dash, repRaw] = await Promise.all([
      api(`/api/closure/project/${id}/dashboard`, { token }),
      api<any>(`/api/closure/project/${id}/report`, { token }),
    ]);
    const rep = repRaw as { sections?: Record<string, string>; summary?: string; status?: string; title?: string; fileUrl?: string };
    setData(dash);
    setReport(rep);
    setSections(rep.sections || {});
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  async function saveReport() {
    await api(`/api/closure/project/${id}/report`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ sections, summary: report?.summary, status: report?.status, title: report?.title }),
    });
    setMsg("Closure report saved");
    await load();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Project closure"
        title={sheetView.label}
        subtitle={`${sheetView.sheet} — snag zero gate, lessons learnt, and client closure pack.`}
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <Badge tone="warn">{data?.totals?.openSnags ?? 0} open snags</Badge>
            <Badge tone="ok">{data?.totals?.lessons ?? 0} lessons</Badge>
            <Badge tone="neutral">{data?.totals?.reportStatus ?? "Draft"}</Badge>
            <Link to={`/projects/${id}/hub/closure`} className="text-sm font-semibold text-brand">
              Closure hub →
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap gap-1">
        {CLOSURE_SHEET_VIEWS.map((s) => (
          <button
            key={s.key || "overview"}
            type="button"
            onClick={() => setSearchParams(s.key ? { sheet: s.key } : {})}
            className={`rounded-sm px-2.5 py-1.5 text-xs font-medium border ${
              sheetKey === s.key ? "bg-brand text-white border-brand" : "bg-paper border-line"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {msg && <p className="text-sm bg-brand-soft text-brand-dark rounded-lg px-3 py-2">{msg}</p>}

      {sheetKey === "" && data && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ["Total snags", data.totals.snags],
            ["Open snags", data.totals.openSnags],
            ["Closed snags", data.totals.closedSnags],
            ["Lessons learnt", data.totals.lessons],
          ].map(([l, v]) => (
            <Card key={l as string} className="!p-4">
              <div className="text-[10px] uppercase text-steel-muted font-mono">{l}</div>
              <div className="text-2xl font-display mt-1">{v as number}</div>
            </Card>
          ))}
        </div>
      )}

      {(sheetKey === "snaglist" || sheetKey === "") && sheetKey === "snaglist" && (
        <>
          {canEdit && (
            <Card>
              <h3 className="font-semibold mb-3">Raise snag</h3>
              <form
                className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3"
                onSubmit={async (e: FormEvent) => {
                  e.preventDefault();
                  await api(`/api/closure/project/${id}/snags`, {
                    method: "POST",
                    token,
                    body: JSON.stringify(snagForm),
                  });
                  setSnagForm({ itemDescription: "", location: "", package: "", severity: "Medium", priority: "Medium", vendor: "" });
                  setMsg("Snag raised");
                  await load();
                }}
              >
                <TextArea className="lg:col-span-3" rows={2} placeholder="Item description" value={snagForm.itemDescription} onChange={(e) => setSnagForm({ ...snagForm, itemDescription: e.target.value })} required />
                <Input placeholder="Location" value={snagForm.location} onChange={(e) => setSnagForm({ ...snagForm, location: e.target.value })} />
                <Input placeholder="Package" value={snagForm.package} onChange={(e) => setSnagForm({ ...snagForm, package: e.target.value })} />
                <Input placeholder="Vendor" value={snagForm.vendor} onChange={(e) => setSnagForm({ ...snagForm, vendor: e.target.value })} />
                <Select value={snagForm.severity} onChange={(e) => setSnagForm({ ...snagForm, severity: e.target.value })}>
                  {["Low", "Medium", "High", "Critical"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
                <Select value={snagForm.priority} onChange={(e) => setSnagForm({ ...snagForm, priority: e.target.value })}>
                  {["Low", "Medium", "High"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
                <Button type="submit">Add snag</Button>
              </form>
            </Card>
          )}
          <Card>
            <h3 className="font-semibold mb-3">Snaglist register</h3>
            <div className="overflow-x-auto max-h-[28rem]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase text-steel-muted font-mono border-b border-line">
                    <th className="py-2 pr-2">Sr</th>
                    <th className="py-2 pr-2">Description</th>
                    <th className="py-2 pr-2">Location</th>
                    <th className="py-2 pr-2">Severity</th>
                    <th className="py-2 pr-2">Status</th>
                    {canEdit && <th className="py-2">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {(data?.snags || []).map((s: any) => (
                    <tr key={s.id} className="border-b border-line/60">
                      <td className="py-2 pr-2 font-mono text-xs">{s.srNo ?? "—"}</td>
                      <td className="py-2 pr-2 max-w-md truncate">{s.itemDescription}</td>
                      <td className="py-2 pr-2">{s.location || "—"}</td>
                      <td className="py-2 pr-2">{s.severity}</td>
                      <td className="py-2 pr-2">
                        <Badge tone={s.status === "Open" ? "warn" : "ok"}>{s.status}</Badge>
                      </td>
                      {canEdit && (
                        <td className="py-2">
                          {s.status === "Open" && (
                            <Button
                              type="button"
                              variant="secondary"
                              className="!py-1 !px-2 !text-xs"
                              onClick={async () => {
                                await api(`/api/closure/snags/${s.id}`, {
                                  method: "PATCH",
                                  token,
                                  body: JSON.stringify({ status: "Closed" }),
                                });
                                setMsg("Snag closed");
                                await load();
                              }}
                            >
                              Close
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {sheetKey === "lessons" && (
        <>
          {canEdit && (
            <Card>
              <h3 className="font-semibold mb-3">Add lesson learnt</h3>
              <form
                className="grid sm:grid-cols-2 gap-3"
                onSubmit={async (e: FormEvent) => {
                  e.preventDefault();
                  await api(`/api/closure/project/${id}/lessons`, {
                    method: "POST",
                    token,
                    body: JSON.stringify(lessonForm),
                  });
                  setLessonForm({ category: "", description: "", wentWell: "", notMetExpectation: "", lessonsLearnt: "" });
                  setMsg("Lesson added");
                  await load();
                }}
              >
                <Input placeholder="Category / phase" value={lessonForm.category} onChange={(e) => setLessonForm({ ...lessonForm, category: e.target.value })} />
                <Input placeholder="Description" value={lessonForm.description} onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })} />
                <TextArea rows={2} placeholder="What went well" value={lessonForm.wentWell} onChange={(e) => setLessonForm({ ...lessonForm, wentWell: e.target.value })} />
                <TextArea rows={2} placeholder="What did not meet expectations" value={lessonForm.notMetExpectation} onChange={(e) => setLessonForm({ ...lessonForm, notMetExpectation: e.target.value })} />
                <TextArea className="sm:col-span-2" rows={3} placeholder="Lessons learnt / how to improve" value={lessonForm.lessonsLearnt} onChange={(e) => setLessonForm({ ...lessonForm, lessonsLearnt: e.target.value })} required />
                <Button type="submit">Save lesson</Button>
              </form>
            </Card>
          )}
          <Card>
            <h3 className="font-semibold mb-3">Lessons learnt register</h3>
            <ul className="space-y-4 max-h-[60vh] overflow-y-auto">
              {(data?.lessons || []).map((l: any) => (
                <li key={l.id} className="border border-line rounded-lg p-3 text-sm space-y-1">
                  <div className="font-semibold">{l.category || l.description}</div>
                  {l.wentWell && <p><span className="text-steel-muted">Went well:</span> {l.wentWell}</p>}
                  {l.notMetExpectation && <p><span className="text-steel-muted">Gap:</span> {l.notMetExpectation}</p>}
                  {l.lessonsLearnt && <p className="text-brand-dark">{l.lessonsLearnt}</p>}
                </li>
              ))}
              {!data?.lessons?.length && <li className="text-steel-muted">No lessons seeded yet.</li>}
            </ul>
          </Card>
        </>
      )}

      {sheetKey === "closure-report" && report && (
        <Card>
          <div className="flex flex-wrap gap-2 mb-4">
            <a
              href={`${API_BASE}/api/closure/template/closure-report.docx`}
              className="text-sm font-semibold text-brand"
              onClick={(e) => {
                e.preventDefault();
                void fetch(`${API_BASE}/api/closure/template/closure-report.docx`, {
                  headers: { Authorization: `Bearer ${token}` },
                })
                  .then((r) => r.blob())
                  .then((b) => {
                    const u = URL.createObjectURL(b);
                    const a = document.createElement("a");
                    a.href = u;
                    a.download = "Project Closure Report.docx";
                    a.click();
                  });
              }}
            >
              Download template (.docx) →
            </a>
            {report.fileUrl && (
              <a href={report.fileUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand">
                Open uploaded report →
              </a>
            )}
          </div>
          <Select
            className="mb-4 max-w-xs"
            value={report.status || "Draft"}
            onChange={(e) => setReport({ ...report, status: e.target.value })}
            disabled={!canEdit}
          >
            {["Draft", "In Review", "Approved"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          <div className="space-y-4">
            {Object.entries(SECTION_LABELS).map(([key, label]) => (
              <label key={key} className="block text-sm">
                <span className="font-semibold">{label}</span>
                <TextArea
                  className="mt-1"
                  rows={3}
                  value={sections[key] || ""}
                  onChange={(e) => setSections({ ...sections, [key]: e.target.value })}
                  disabled={!canEdit}
                />
              </label>
            ))}
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2 mt-4">
              <Button type="button" onClick={() => void saveReport()}>
                Save report sections
              </Button>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <span className="text-sm font-semibold text-brand">Upload signed docx</span>
                <input
                  type="file"
                  accept=".doc,.docx,.pdf"
                  className="text-xs"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const fd = new FormData();
                    fd.append("file", f);
                    await fetch(`${API_BASE}/api/closure/project/${id}/report/upload`, {
                      method: "POST",
                      headers: { Authorization: `Bearer ${token}` },
                      body: fd,
                    });
                    setMsg("Closure report uploaded");
                    await load();
                  }}
                />
              </label>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
