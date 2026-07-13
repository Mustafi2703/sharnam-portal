import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import type { ReactNode } from "react";

const nav = [
  { to: "/", label: "Dashboard", roles: ["admin", "office", "site_employee", "client", "employee"] },
  { to: "/projects", label: "Projects", roles: ["admin", "office", "site_employee", "client", "employee"] },
  { to: "/crm", label: "CRM", roles: ["admin", "office", "employee"] },
  { to: "/hrm", label: "HRM", roles: ["admin", "office"] },
  { to: "/audit", label: "Audit", roles: ["admin", "office"] },
  { to: "/roles", label: "Roles", roles: ["admin"] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="md:w-64 bg-steel text-white md:min-h-screen shrink-0">
        <div className="px-5 py-6 border-b border-white/10">
          <Link to="/" className="block">
            <div className="font-display text-3xl tracking-tight">शरणम्</div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/60 mt-1">
              Construction Portal
            </div>
          </Link>
          <div className="mt-4 text-sm text-white/80">
            {user?.fullName}
            <div className="text-xs text-brand-soft/80 capitalize">
              {user?.role?.replace("_", " ")} · {user?.portal} portal
            </div>
          </div>
        </div>
        <nav className="p-3 flex md:flex-col gap-1 overflow-x-auto">
          {nav
            .filter((n) => !user || n.roles.includes(user.role))
            .map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/"}
                className={({ isActive }) =>
                  `px-3 py-2.5 rounded-lg text-sm whitespace-nowrap ${
                    isActive ? "bg-brand text-white" : "text-white/80 hover:bg-white/10"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
        </nav>
        <div className="p-3 mt-auto hidden md:block">
          <button
            className="w-full text-left px-3 py-2 text-sm text-white/70 hover:text-white"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
    </div>
  );
}
