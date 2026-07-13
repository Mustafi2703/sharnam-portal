import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, Select, WorkflowStrip } from "../components/ui";

type Drawing = {
  id: string;
  drawingNumber: string;
  title: string;
  discipline: string;
  currentRev: string;
  isPublished: boolean;
  status: string;
};

type Project = {
  id: string;
  code: string;
  name: string;
  status: string;
  clientName?: string;
  location?: string;
  drawings: Drawing[];
  members: { id: string; role: string; user: { fullName: string; email: string; role: string } }[];
  _count?: { dailyLogs: number; checklistAssignments: number };
};

const modules = [
  { to: "checklist", label: "Checklists", desc: "Form-based QA after drawings", icon: "✓" },
  { to: "diary", label: "Daily Diary", desc: "Manpower, weather, notes", icon: "▣" },
  { to: "dms", label: "Drawings / DMS", desc: "Mock OneDrive tree", icon: "▭" },
  { to: "comms", label: "Communications", desc: "Matrix, logs, MoM", icon: "◎" },
  { to: "cost", label: "Cost Tracking", desc: "Budget, BOQ, cashflow", icon: "₹" },
  { to: "reports", label: "Reports", desc: "Daily & weekly packs", icon: "▤" },
];

export default function ProjectDetailPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [gate, setGate] = useState({ canSubmitChecklist: false, publishedCount: 0 });
  const [drawingForm, setDrawingForm] = useState({
    drawingNumber: "",
    title: "",
    discipline: "Architecture",
    revisionNumber: "Rev A",
    publish: true,
  });
  const [file, setFile] = useState<File | null>(null);
  const [filter, setFilter] = useState("All");
  const canUpload = user?.role === "admin" || user?.role === "office";

  const load = async () => {
    const p = await api<Project>(`/api/projects/${id}`, { token });
    setProject(p);
    const g = await api<{ canSubmitChecklist: boolean; publishedCount: number }>(
      `/api/drawings/project/${id}/gate`,
      { token }
    );
    setGate(g);
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  if (!project) {
    return <div className="text-steel-muted font-mono text-sm">Loading project spine…</div>;
  }

  const disciplines = ["All", ...Array.from(new Set(project.drawings.map((d) => d.discipline)))];
  const filtered =
    filter === "All" ? project.drawings : project.drawings.filter((d) => d.discipline === filter);
  const published = project.drawings.filter((d) => d.isPublished).length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={project.code}
        title={project.name}
        subtitle={`${project.clientName || "Client TBD"} · ${project.location || "Location TBD"} · ${project.status}`}
        actions={
          <Badge tone={gate.canSubmitChecklist ? "ok" : "warn"}>
            {gate.canSubmitChecklist
              ? `Gate open · ${gate.publishedCount} published`
              : "Gate locked · publish a drawing"}
          </Badge>
        }
      />

      <WorkflowStrip
        active={gate.canSubmitChecklist ? 2 : 0}
        steps={[
          { label: "Drawing set", hint: `${project.drawings.length} sheets in register` },
          { label: "Publish", hint: `${published} live for site` },
          { label: "Checklist", hint: "Site fills forms against sheets" },
          { label: "Client view", hint: "Approved trail only" },
        ]}
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {modules.map((m, i) => (
          <Link key={m.to} to={`/projects/${id}/${m.to}`} className={`rise rise-delay-${Math.min(i % 3, 3)}`}>
            <Card className="h-full hover:border-brand/40 transition group">
              <div className="flex items-start justify-between">
                <span className="h-9 w-9 rounded-xl bg-brand-soft text-brand grid place-items-center text-sm font-semibold">
                  {m.icon}
                </span>
                <span className="text-brand opacity-0 group-hover:opacity-100 transition text-sm">Open →</span>
              </div>
              <div className="font-semibold mt-4">{m.label}</div>
              <div className="text-sm text-steel-muted mt-1">{m.desc}</div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid xl:grid-cols-[1.4fr_0.8fr] gap-5">
        <Card padding={false} className="overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex flex-wrap items-center justify-between gap-3 bg-sand/30">
            <div>
              <h2 className="font-semibold">Drawing register</h2>
              <p className="text-xs text-steel-muted mt-0.5">
                {project.drawings.length} sheets · filter by discipline
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              {disciplines.map((d) => (
                <button
                  key={d}
                  onClick={() => setFilter(d)}
                  className={`rounded-full px-3 py-1 text-xs ${
                    filter === d ? "bg-brand text-white" : "bg-white border border-line text-steel-muted"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-[420px] overflow-y-auto divide-y divide-line">
            {filtered.map((d) => (
              <div key={d.id} className="px-5 py-3.5 flex items-start justify-between gap-3 hover:bg-sand/20">
                <div className="min-w-0">
                  <div className="font-mono text-[11px] text-brand">{d.drawingNumber}</div>
                  <div className="font-medium truncate">{d.title}</div>
                  <div className="text-xs text-steel-muted mt-1">
                    {d.discipline} · {d.currentRev} · {d.status}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge tone={d.isPublished ? "ok" : "warn"}>{d.isPublished ? "Published" : "Draft"}</Badge>
                  {!d.isPublished && canUpload && (
                    <button
                      className="text-xs text-brand font-medium"
                      onClick={async () => {
                        await api(`/api/drawings/${d.id}/publish`, { method: "POST", token });
                        await load();
                      }}
                    >
                      Publish
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!filtered.length && (
              <div className="p-8 text-center text-sm text-steel-muted">No drawings in this filter.</div>
            )}
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <h2 className="font-semibold mb-3">Project team</h2>
            <ul className="space-y-2.5">
              {project.members.map((m) => (
                <li key={m.id} className="flex justify-between gap-2 text-sm">
                  <span className="font-medium">{m.user.fullName}</span>
                  <span className="text-steel-muted capitalize text-xs">
                    {m.user.role.replace("_", " ")}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {canUpload && (
            <Card>
              <h2 className="font-semibold">Upload drawing</h2>
              <p className="text-xs text-steel-muted mt-1 mb-4">
                Publishing immediately opens the checklist gate for site.
              </p>
              <form
                className="space-y-2.5"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData();
                  Object.entries(drawingForm).forEach(([k, v]) => fd.append(k, String(v)));
                  if (file) fd.append("file", file);
                  await api(`/api/drawings/project/${id}`, { method: "POST", token, body: fd });
                  setDrawingForm({ ...drawingForm, drawingNumber: "", title: "" });
                  setFile(null);
                  await load();
                }}
              >
                <Input
                  placeholder="Number e.g. A-201"
                  value={drawingForm.drawingNumber}
                  onChange={(e) => setDrawingForm({ ...drawingForm, drawingNumber: e.target.value })}
                  required
                />
                <Input
                  placeholder="Title"
                  value={drawingForm.title}
                  onChange={(e) => setDrawingForm({ ...drawingForm, title: e.target.value })}
                  required
                />
                <Select
                  value={drawingForm.discipline}
                  onChange={(e) => setDrawingForm({ ...drawingForm, discipline: e.target.value })}
                >
                  {["Architecture", "Structural", "MEP", "Civil"].map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </Select>
                <input type="file" className="w-full text-sm" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={drawingForm.publish}
                    onChange={(e) => setDrawingForm({ ...drawingForm, publish: e.target.checked })}
                  />
                  Publish now
                </label>
                <Button type="submit" className="w-full">
                  Add to register
                </Button>
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
