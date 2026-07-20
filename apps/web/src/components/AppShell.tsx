import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import type { ReactNode } from "react";
import { Badge, Button } from "./ui";
import { BrandMark, BRAND_EN } from "./Brand";
import { getActiveWorkspace, WORKSPACES } from "../workspaces";
import { LIVE_UI_OPTIONS, THEME_STORAGE_KEY, applyThemeOption } from "../themes";

const primaryNav = [
  { to: "/workspace", label: "Home", roles: ["admin", "office", "site_employee", "client", "employee", "vendor"] },
  { to: "/projects", label: "Projects", roles: ["admin", "office", "site_employee", "client", "employee", "vendor"] },
  { to: "/crm", label: "CRM", roles: ["admin", "office", "employee"] },
  { to: "/hrm", label: "HR", roles: ["admin", "office"] },
  { to: "/options", label: "UI 1–5", roles: ["admin", "office", "site_employee", "client", "employee", "vendor"] },
];

const moreNav = [
  { to: "/audit", label: "Audit", roles: ["admin", "office"] },
  { to: "/roles", label: "Permissions", roles: ["admin"] },
  { to: "/themes", label: "Themes", roles: ["admin", "office", "site_employee", "client", "employee", "vendor"] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const ws = typeof window !== "undefined" ? getActiveWorkspace() : null;
  const wsLabel = WORKSPACES.find((w) => w.key === ws)?.title;
  const canUpload = user && user.role !== "client";
  const projectHint =
    typeof window !== "undefined" ? localStorage.getItem("sharnam_workspace_project") : null;

  let activeUi = "1";
  try {
    const id = localStorage.getItem(THEME_STORAGE_KEY) || "ui-1";
    activeUi = String(LIVE_UI_OPTIONS.find((t) => t.id === id)?.number || 1);
  } catch {
    /* ignore */
  }

  return (
    <div className="min-h-screen flex flex-col bg-sand">
      <header className="procore-topbar sticky top-0 z-40 shadow-sm">
        {/* Row 1 — brand + project actions */}
        <div className="flex items-center gap-3 px-3 sm:px-5 h-12 border-b border-line bg-procore-navy text-white">
          <Link to="/workspace" className="shrink-0 flex items-center gap-2" aria-label={`${BRAND_EN} home`}>
            <BrandMark size="sm" tagTone="dark" compact showTag={false} />
            <span className="hidden sm:inline font-display text-sm tracking-tight text-white">{BRAND_EN}</span>
          </Link>

          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-white/70 min-w-0">
            <span className="truncate">PMC portal</span>
            {wsLabel && (
              <>
                <span>/</span>
                <span className="text-white font-medium truncate">{wsLabel}</span>
              </>
            )}
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-1.5 shrink-0">
            {canUpload && projectHint && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  className="!hidden lg:!inline-flex !text-[11px] !py-1 !bg-white/10 !text-white !border-white/20 hover:!bg-white/20"
                  onClick={() => navigate(`/projects/${projectHint}/dms`)}
                >
                  Upload docs
                </Button>
                <Button
                  type="button"
                  className="!text-[11px] !py-1"
                  onClick={() => navigate(`/projects/${projectHint}/drawings?upload=1`)}
                >
                  Upload drawing
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="!hidden sm:!inline-flex !text-[11px] !py-1 !bg-white/10 !text-white !border-white/20"
                  onClick={() => navigate(`/projects/${projectHint}/drawings/upload-revision`)}
                >
                  Upload rev
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="!hidden md:!inline-flex !text-[11px] !py-1 !bg-white/10 !text-white !border-white/20"
                  onClick={() => navigate(`/projects/${projectHint}/checklist/assign`)}
                >
                  Assign checklist
                </Button>
              </>
            )}
            <Badge tone="neutral">{user?.portal}</Badge>
            <Button
              variant="ghost"
              className="!px-2 !py-1 !text-[11px] !text-white/80 hover:!text-white hover:!bg-white/10"
              onClick={() => {
                logout();
                navigate("/options");
              }}
            >
              Sign out
            </Button>
          </div>
        </div>

        {/* Row 2 — module nav + UI switcher */}
        <div className="flex items-center gap-1 px-2 sm:px-4 h-11 bg-paper">
          <nav className="flex items-center gap-0.5 overflow-x-auto min-w-0 flex-1">
            {primaryNav
              .filter((n) => !user || n.roles.includes(user.role))
              .map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === "/workspace"}
                  className={({ isActive }) =>
                    `px-3 py-2 text-[13px] font-medium whitespace-nowrap border-b-2 transition ${
                      isActive ? "border-brand text-brand" : "border-transparent text-steel-muted hover:text-ink"
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            {moreNav
              .filter((n) => user && n.roles.includes(user.role))
              .map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className={({ isActive }) =>
                    `hidden xl:inline-flex px-3 py-2 text-[13px] font-medium whitespace-nowrap border-b-2 transition ${
                      isActive ? "border-brand text-brand" : "border-transparent text-steel-muted hover:text-ink"
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
          </nav>

          <div className="flex items-center gap-1 shrink-0 pl-2 border-l border-line">
            <span className="hidden sm:inline text-[10px] font-mono uppercase text-steel-muted mr-1">UI</span>
            {LIVE_UI_OPTIONS.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.name}
                onClick={() => {
                  applyThemeOption(t.id);
                }}
                className={`h-7 w-7 text-[11px] font-semibold border transition ${
                  String(t.number) === activeUi
                    ? "bg-brand text-white border-brand"
                    : "bg-sand border-line text-steel-muted hover:border-brand"
                }`}
                style={{ borderRadius: "var(--ui-radius-sm, 6px)" }}
              >
                {t.number}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
