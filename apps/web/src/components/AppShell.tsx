import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import type { ReactNode } from "react";
import { Badge, Button } from "./ui";
import { BrandMark } from "./Brand";

const nav = [
  { to: "/", label: "Home", roles: ["admin", "office", "site_employee", "client", "employee", "vendor"] },
  { to: "/projects", label: "Projects", roles: ["admin", "office", "site_employee", "client", "employee", "vendor"] },
  { to: "/crm", label: "CRM", roles: ["admin", "office", "employee"] },
  { to: "/hrm", label: "HRM", roles: ["admin", "office"] },
  { to: "/audit", label: "Audit", roles: ["admin", "office"] },
  { to: "/roles", label: "Permissions", roles: ["admin"] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f0f0]">
      {/* Procore-style global top navbar */}
      <header className="procore-topbar sticky top-0 z-40 text-white">
        <div className="flex items-center gap-4 px-3 sm:px-4 h-12">
          <Link to="/" className="shrink-0 flex items-center gap-2">
            <BrandMark size="sm" tagTone="dark" compact />
          </Link>

          <nav className="flex items-center gap-0.5 overflow-x-auto min-w-0 flex-1">
            {nav
              .filter((n) => !user || n.roles.includes(user.role))
              .map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === "/"}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded text-[13px] font-medium whitespace-nowrap transition ${
                      isActive
                        ? "bg-white/15 text-white"
                        : "text-white/75 hover:bg-white/10 hover:text-white"
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
          </nav>

          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <Badge tone="brand">{user?.portal}</Badge>
            <span className="text-xs text-white/70 max-w-[140px] truncate">{user?.fullName}</span>
            <Button
              variant="ghost"
              className="!text-white/80 hover:!text-white hover:!bg-white/10 !px-2 !py-1 !text-xs !rounded"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              Sign out
            </Button>
          </div>
          <button
            type="button"
            className="sm:hidden text-xs text-white/80 px-2"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Out
          </button>
        </div>
      </header>

      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-[1400px] px-3 sm:px-5 lg:px-6 py-4 sm:py-5">{children}</div>
      </main>
    </div>
  );
}
