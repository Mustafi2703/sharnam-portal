import { useEffect, useState, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge } from "../components/ui";
import { BrandMark } from "../components/Brand";

type Project = { id: string; code: string; name: string; status: string; clientName?: string };

const WORKSPACES = [
  {
    key: "drawings",
    title: "Drawings & GFC",
    desc: "Register, revise, publish, view sheets.",
    path: "drawings",
    image: "/media/ws-drawings.jpg",
    roles: ["admin", "office", "site_employee", "employee", "vendor", "client"],
  },
  {
    key: "quality",
    title: "Quality",
    desc: "Final Index, QI forms, action plans, safety.",
    path: "checklist",
    image: "/media/ws-quality.jpg",
    roles: ["admin", "office", "site_employee", "employee", "vendor", "client"],
  },
  {
    key: "comms",
    title: "Communications",
    desc: "Matrix, meetings, MoM after publish.",
    path: "comms",
    image: "/media/ws-comms.jpg",
    roles: ["admin", "office", "site_employee", "employee", "vendor", "client"],
  },
  {
    key: "field",
    title: "Field & day log",
    desc: "Manpower, equipment, photos, RFIs.",
    path: "diary",
    image: "/media/ws-field.jpg",
    roles: ["admin", "office", "site_employee", "employee", "vendor", "client"],
  },
  {
    key: "home",
    title: "Full project hub",
    desc: "Every tool in one strip.",
    path: "",
    image: "/media/hero-site.jpg",
    roles: ["admin", "office", "site_employee", "employee", "vendor", "client"],
  },
] as const;

export default function WorkspacePage() {
  const { user, token } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("");

  useEffect(() => {
    api<Project[]>("/api/projects", { token }).then((list) => {
      setProjects(list);
      const stored = localStorage.getItem("sharnam_workspace_project");
      if (stored && list.some((p) => p.id === stored)) setProjectId(stored);
      else if (list[0]) setProjectId(list[0].id);
    });
  }, [token]);

  const selected = projects.find((p) => p.id === projectId);

  const onMove = (e: MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="relative overflow-hidden border border-line bg-black text-white -mx-3 sm:mx-0 sm:rounded-none">
        <img src="/media/hero-site.jpg" alt="" className="absolute inset-0 w-full h-full object-cover opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />
        <div className="absolute inset-0 spotlight" onMouseMove={onMove} />
        <div className="relative z-10 p-6 sm:p-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <BrandMark size="lg" tagTone="dark" />
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/50 mt-6 mb-2">Workspaces</p>
            <h1 className="font-display text-3xl sm:text-4xl text-white">
              Ready, {user?.fullName?.split(" ")[0] || "team"}
            </h1>
            <p className="mt-2 text-sm text-white/70 max-w-xl leading-relaxed">
              Pick a project, then open a live workspace — drawings, quality, comms, or field.
            </p>
          </div>
          <Badge tone="neutral">{user?.portal} portal</Badge>
        </div>
      </div>

      <section>
        <h2 className="font-display text-xl mb-3">Project</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setProjectId(p.id);
                localStorage.setItem("sharnam_workspace_project", p.id);
              }}
              className={`text-left border px-4 py-4 transition interactive-lift rise rise-delay-${Math.min(i + 1, 3)} ${
                projectId === p.id ? "border-ink bg-white brand-frame" : "border-line bg-white/80 hover:border-ink/40"
              }`}
            >
              <div className="font-mono text-[11px] text-steel-muted">{p.code}</div>
              <div className="font-display text-lg mt-1">{p.name}</div>
              <div className="text-xs text-steel-muted mt-1">{p.clientName || p.status}</div>
            </button>
          ))}
          {!projects.length && <p className="text-sm text-steel-muted">No projects assigned yet.</p>}
        </div>
      </section>

      {selected && (
        <section>
          <div className="flex items-end justify-between gap-3 mb-4">
            <h2 className="font-display text-xl">Open workspace</h2>
            <span className="font-mono text-[10px] uppercase tracking-wider text-steel-muted">{selected.code}</span>
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {WORKSPACES.filter((w) => !user || w.roles.includes(user.role as never)).map((w, i) => (
              <Link
                key={w.key}
                to={`/projects/${selected.id}/${w.path}`}
                className={`group media-tile interactive-lift rise rise-delay-${Math.min(i + 1, 4)} h-[240px] border border-line`}
              >
                <img src={w.image} alt="" />
                <div className="media-veil" />
                <div className="absolute inset-0 z-10 p-5 flex flex-col justify-end text-white">
                  <div className="font-display text-2xl leading-tight">{w.title}</div>
                  <p className="text-sm text-white/75 mt-1">{w.desc}</p>
                  <div className="mt-3 text-sm font-semibold inline-flex gap-2 items-center group-hover:gap-3 transition-all">
                    Enter <span>→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
