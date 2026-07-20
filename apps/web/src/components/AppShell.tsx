import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import type { ReactNode } from "react";
import { Badge, Button } from "./ui";
import { BrandMark, BRAND_EN } from "./Brand";
import { getActiveWorkspace, WORKSPACES } from "../workspaces";

const nav = [
  { to: "/workspace", label: "Workspaces", roles: ["admin", "office", "site_employee", "client", "employee", "vendor"] },
  { to: "/projects", label: "Projects", roles: ["admin", "office", "site_employee", "client", "employee", "vendor"] },
  { to: "/themes", label: "Themes", roles: ["admin", "office", "site_employee", "client", "employee", "vendor"] },
  { to: "/crm", label: "CRM", roles: ["admin", "office", "employee"] },
  { to: "/hrm", label: "HRM", roles: ["admin", "office"] },
  { to: "/audit", label: "Audit", roles: ["admin", "office"] },
  { to: "/roles", label: "Permissions", roles: ["admin"] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const ws = typeof window !== "undefined" ? getActiveWorkspace() : null;
  const wsLabel = WORKSPACES.find((w) => w.key === ws)?.title;
  const canUpload = user && user.role !== "client";
  const projectHint =
    typeof window !== "undefined" ? localStorage.getItem("sharnam_workspace_project") : null;

  return (
    <div className="min-h-screen flex flex-col bg-sand">
      <header className="procore-topbar sticky top-0 z-40">
        <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-5 h-14">
          <Link to="/workspace" className="shrink-0 flex items-center gap-2 group" aria-label={`${BRAND_EN} workspaces`}>
            <BrandMark size="sm" tagTone="light" compact showTag={false} />
            <span className="hidden md:inline font-display text-sm tracking-tight text-ink group-hover:text-brand">
              {BRAND_EN}
            </span>
          </Link>

          <nav className="flex items-center gap-1 overflow-x-auto min-w-0 flex-1">
            {nav
              .filter((n) => !user || n.roles.includes(user.role))
              .map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === "/workspace"}
                  className={({ isActive }) =>
                    `px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition border-b-2 ${
                      isActive
                        ? "border-brand text-brand"
                        : "border-transparent text-steel-muted hover:text-ink hover:border-line"
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
          </nav>

          {/* Top-right action cluster — Procore-style */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {canUpload && projectHint && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  className="!hidden sm:!inline-flex !text-xs !py-1.5"
                  onClick={() => navigate(`/projects/${projectHint}/dms`)}
                >
                  Upload docs
                </Button>
                <Button
                  type="button"
                  className="!text-xs !py-1.5"
                  onClick={() => navigate(`/projects/${projectHint}/drawings`)}
                >
                  Upload drawing
                </Button>
              </>
            )}
            {wsLabel && <Badge tone="brand">{wsLabel}</Badge>}
            <Badge tone="neutral">{user?.portal}</Badge>
            <span className="hidden sm:inline text-xs text-steel-muted max-w-[100px] truncate">{user?.fullName}</span>
            <Button
              variant="ghost"
              className="!px-2 !py-1 !text-xs"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
