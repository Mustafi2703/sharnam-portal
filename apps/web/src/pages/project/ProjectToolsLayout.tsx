import { NavLink, Outlet, useParams, Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button } from "../../components/ui";
import type { RoleKey } from "@sharnam/shared";

type ToolItem = { to: string; label: string; end?: boolean; roles?: RoleKey[]; note?: string };

const TOOL_GROUPS: { title: string; items: ToolItem[] }[] = [
  {
    title: "Project",
    items: [
      { to: "", label: "Home", end: true },
      { to: "directory", label: "Directory" },
      { to: "vendors", label: "Vendors", roles: ["admin", "office", "site_employee", "employee", "vendor"] },
      { to: "email", label: "Email settings", roles: ["admin", "office", "employee", "site_employee"] },
    ],
  },
  {
    title: "Design & Docs",
    items: [
      { to: "drawings", label: "Drawings" },
      { to: "dms", label: "Documents" },
      { to: "coordination", label: "Design Coordination", roles: ["admin", "office", "site_employee", "employee"] },
      { to: "submittals", label: "Submittals", roles: ["admin", "office", "site_employee", "employee", "vendor"] },
    ],
  },
  {
    title: "Quality",
    items: [
      { to: "checklist", label: "Final Index (Site)" },
      { to: "quality-inspections", label: "Quality Inspections" },
      { to: "inspections", label: "Quality Action Plan", roles: ["admin", "office", "site_employee", "employee", "vendor", "client"] },
      { to: "safety", label: "Safety" },
      { to: "rfis", label: "RFIs & Concerns" },
    ],
  },
  {
    title: "Field",
    items: [
      { to: "diary", label: "Employee Day Log", roles: ["admin", "office", "site_employee", "employee", "vendor", "client"] },
      { to: "photos", label: "Photos" },
      { to: "comms", label: "Meetings & Comms" },
    ],
  },
  {
    title: "Finance",
    items: [
      { to: "cost", label: "Budget & Cost", roles: ["admin", "office", "employee"], note: "Phase 2 depth" },
      { to: "reports", label: "Reports" },
    ],
  },
];

const SIDEBAR_KEY = "sharnam.toolsSidebarOpen";

function visibleTools(role?: RoleKey | null) {
  return TOOL_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((t) => !t.roles || !role || t.roles.includes(role)),
  })).filter((g) => g.items.length > 0);
}

export default function ProjectToolsLayout() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [project, setProject] = useState<any>(null);
  const [gate, setGate] = useState({ publishedCount: 0 });
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const v = localStorage.getItem(SIDEBAR_KEY);
      return v === null ? true : v === "1";
    } catch {
      return true;
    }
  });

  const groups = useMemo(() => visibleTools(user?.role), [user?.role]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, sidebarOpen ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [sidebarOpen]);

  useEffect(() => {
    if (!id) return;
    api(`/api/projects/${id}`, { token }).then(setProject).catch(console.error);
    api<{ publishedCount: number }>(`/api/drawings/project/${id}/gate`, { token })
      .then((g: { publishedCount: number }) => setGate(g))
      .catch(console.error);
  }, [id, token]);

  return (
    <div className="min-h-[70vh] -mx-3 sm:-mx-5 lg:-mx-6 -mt-4 sm:-mt-5">
      <div className="procore-tool-header px-3 sm:px-5 py-3">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              type="button"
              variant="secondary"
              className="!rounded !px-2.5 !py-1.5 !text-xs shrink-0"
              onClick={() => setSidebarOpen((o) => !o)}
              title={sidebarOpen ? "Hide tools menu" : "Show tools menu"}
            >
              {sidebarOpen ? "☰ Hide tools" : "☰ Tools"}
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-steel-muted">
                <Link to="/projects" className="text-procore-blue hover:underline">
                  Projects
                </Link>
                <span>/</span>
                <span className="font-mono text-[11px] text-brand">{project?.code || "…"}</span>
              </div>
              <h1 className="text-lg sm:text-xl font-semibold text-ink truncate leading-tight">
                {project?.name || "Project"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden md:inline text-xs text-steel-muted">
              {project?.clientName} · {project?.location}
            </span>
            <Badge tone={gate.publishedCount > 0 ? "ok" : "warn"}>
              {gate.publishedCount > 0
                ? `${gate.publishedCount} published drawings`
                : "Drawings gate locked"}
            </Badge>
          </div>
        </div>
      </div>

      <div className={`min-h-[60vh] ${sidebarOpen ? "lg:grid lg:grid-cols-[220px_1fr]" : ""}`}>
        {sidebarOpen && (
          <aside className="border-b lg:border-b-0 lg:border-r border-line bg-white lg:min-h-[60vh]">
            <div className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-steel-muted border-b border-line flex items-center justify-between">
              <span>Project tools</span>
              <button
                type="button"
                className="lg:hidden text-xs text-procore-blue"
                onClick={() => setSidebarOpen(false)}
              >
                Close
              </button>
            </div>
            <nav className="py-2 max-h-[50vh] lg:max-h-none overflow-y-auto">
              {groups.map((g) => (
                <div key={g.title} className="mb-2">
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-steel-muted/80">
                    {g.title}
                  </div>
                  {g.items.map((t) => (
                    <NavLink
                      key={t.to || "home"}
                      to={t.to ? `/projects/${id}/${t.to}` : `/projects/${id}`}
                      end={t.end}
                      className={({ isActive }) =>
                        `block px-3 py-1.5 text-[13px] border-l-[3px] transition ${
                          isActive
                            ? "border-brand bg-brand-soft text-ink font-semibold"
                            : "border-transparent text-ink/80 hover:bg-sand"
                        }`
                      }
                    >
                      {t.label}
                      {t.note ? <span className="block text-[10px] font-normal text-steel-muted">{t.note}</span> : null}
                    </NavLink>
                  ))}
                </div>
              ))}
            </nav>
          </aside>
        )}

        <div className="p-3 sm:p-5 bg-[#f0f0f0] min-w-0">
          {!sidebarOpen && (
            <div className="mb-3 flex flex-wrap gap-1">
              {groups
                .flatMap((g) => g.items)
                .slice(0, 8)
                .map((t) => (
                  <NavLink
                    key={t.to || "home"}
                    to={t.to ? `/projects/${id}/${t.to}` : `/projects/${id}`}
                    end={t.end}
                    className={({ isActive }) =>
                      `px-2.5 py-1 rounded text-xs border ${
                        isActive
                          ? "bg-brand text-white border-brand"
                          : "bg-white border-line text-ink hover:border-brand/40"
                      }`
                    }
                  >
                    {t.label}
                  </NavLink>
                ))}
              <button
                type="button"
                className="px-2.5 py-1 rounded text-xs border border-line bg-white text-procore-blue"
                onClick={() => setSidebarOpen(true)}
              >
                More tools…
              </button>
            </div>
          )}
          <Outlet
            context={{
              project,
              gate,
              reloadProject: () => api(`/api/projects/${id}`, { token }).then(setProject),
            }}
          />
        </div>
      </div>
    </div>
  );
}
