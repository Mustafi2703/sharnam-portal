import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

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
};

export default function ProjectDetailPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [gate, setGate] = useState({ canSubmitChecklist: false, publishedCount: 0 });
  const [drawingForm, setDrawingForm] = useState({
    drawingNumber: "",
    title: "",
    discipline: "Architecture",
    revisionNumber: "Rev 0",
    publish: true,
  });
  const [file, setFile] = useState<File | null>(null);
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

  if (!project) return <div className="text-steel-muted">Loading project…</div>;

  const modules = [
    { to: "checklist", label: "Checklists", desc: "Form-based site checks" },
    { to: "diary", label: "Daily Diary", desc: "Manpower & site notes" },
    { to: "comms", label: "Communications", desc: "Matrix, logs, meetings" },
    { to: "cost", label: "Cost Tracking", desc: "Budget, BOQ, cashflow" },
    { to: "dms", label: "DMS / OneDrive", desc: "Mock drive folders" },
    { to: "reports", label: "Reports", desc: "Daily & weekly packs" },
  ];

  return (
    <div className="space-y-8">
      <header>
        <div className="text-sm text-brand font-medium">{project.code}</div>
        <h1 className="font-display text-4xl mt-1">{project.name}</h1>
        <p className="text-steel-muted mt-2">
          {project.clientName} · {project.location} · {project.status}
        </p>
        <div
          className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${
            gate.canSubmitChecklist ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
          }`}
        >
          {gate.canSubmitChecklist
            ? `Checklist gate open · ${gate.publishedCount} published drawing(s)`
            : "Checklist gated — publish a drawing first"}
        </div>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {modules.map((m) => (
          <Link
            key={m.to}
            to={`/projects/${id}/${m.to}`}
            className="rounded-2xl bg-white border border-black/5 p-5 hover:border-brand/40 shadow-sm"
          >
            <div className="font-semibold">{m.label}</div>
            <div className="text-sm text-steel-muted mt-1">{m.desc}</div>
          </Link>
        ))}
      </div>

      <section className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white border border-black/5 p-5">
          <h2 className="font-semibold mb-3">Drawings</h2>
          <ul className="space-y-2 text-sm mb-4">
            {project.drawings.map((d) => (
              <li key={d.id} className="flex justify-between gap-2 border-b border-black/5 pb-2">
                <div>
                  <div className="font-medium">
                    {d.drawingNumber} — {d.title}
                  </div>
                  <div className="text-steel-muted">
                    {d.discipline} · {d.currentRev} · {d.status}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={d.isPublished ? "text-emerald-700" : "text-amber-700"}>
                    {d.isPublished ? "Published" : "Draft"}
                  </span>
                  {!d.isPublished && canUpload && (
                    <button
                      className="text-xs text-brand"
                      onClick={async () => {
                        await api(`/api/drawings/${d.id}/publish`, { method: "POST", token });
                        await load();
                      }}
                    >
                      Publish
                    </button>
                  )}
                </div>
              </li>
            ))}
            {!project.drawings.length && <li className="text-steel-muted">No drawings yet.</li>}
          </ul>

          {canUpload && (
            <form
              className="space-y-2 border-t border-black/5 pt-4"
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
              <div className="text-sm font-medium">Upload drawing revision</div>
              <input className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="Number e.g. A-102" value={drawingForm.drawingNumber} onChange={(e) => setDrawingForm({ ...drawingForm, drawingNumber: e.target.value })} required />
              <input className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="Title" value={drawingForm.title} onChange={(e) => setDrawingForm({ ...drawingForm, title: e.target.value })} required />
              <select className="w-full rounded-xl border px-3 py-2 text-sm" value={drawingForm.discipline} onChange={(e) => setDrawingForm({ ...drawingForm, discipline: e.target.value })}>
                {["Architecture", "Structural", "MEP", "Civil"].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
              <input type="file" className="w-full text-sm" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={drawingForm.publish} onChange={(e) => setDrawingForm({ ...drawingForm, publish: e.target.checked })} />
                Publish immediately (opens checklist gate)
              </label>
              <button className="rounded-xl bg-brand text-white px-4 py-2 text-sm">Upload</button>
            </form>
          )}
        </div>

        <div className="rounded-2xl bg-white border border-black/5 p-5">
          <h2 className="font-semibold mb-3">Team</h2>
          <ul className="space-y-2 text-sm">
            {project.members.map((m) => (
              <li key={m.id} className="flex justify-between">
                <span>{m.user.fullName}</span>
                <span className="text-steel-muted capitalize">{m.user.role.replace("_", " ")}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
