import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import type { ReactNode } from "react";
import { Badge, Button } from "./ui";
import { BrandMark } from "./Brand";

const nav = [
  { to: "/", label: "Command", roles: ["admin", "office", "site_employee", "client", "employee"] },
  { to: "/projects", label: "Projects", roles: ["admin", "office", "site_employee", "client", "employee"] },
  { to: "/crm", label: "CRM", roles: ["admin", "office", "employee"] },
  { to: "/hrm", label: "People", roles: ["admin", "office"] },
  { to: "/audit", label: "Audit", roles: ["admin", "office"] },
  { to: "/roles", label: "Access", roles: ["admin"] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[272px_1fr] bg-[#f3f1ec]">
      <aside className="bg-steel text-white blueprint-grid lg:sticky lg:top-0 lg:h-screen flex flex-col border-b lg:border-b-0 lg:border-r border-white/10">
        <div className="px-5 py-6">
          <Link to="/" className="block">
            <BrandMark size="md" tagTone="dark" />
          </Link>
          <div className="mt-6 rounded-2xl border border-white/15 bg-white/8 p-3.5 backdrop-blur-sm">
            <div className="text-sm font-semibold text-white">{user?.fullName}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge tone="brand">{user?.portal} portal</Badge>
              <span className="text-[11px] text-white/55 capitalize">{user?.role?.replace("_", " ")}</span>
            </div>
          </div>
        </div>

        <nav className="px-3 pb-3 flex lg:flex-col gap-1 overflow-x-auto">
          {nav
            .filter((n) => !user || n.roles.includes(user.role))
            .map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/"}
                className={({ isActive }) =>
                  `px-3 py-2.5 rounded-xl text-sm whitespace-nowrap transition ${
                    isActive
                      ? "bg-brand text-white shadow-[0_8px_24px_-12px_rgba(78,195,224,0.8)]"
                      : "text-white/75 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
        </nav>

        <div className="mt-auto p-4 hidden lg:block border-t border-white/10">
          <Button
            variant="ghost"
            className="w-full !text-white/70 hover:!text-white hover:!bg-white/10 justify-start"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Sign out
          </Button>
        </div>
      </aside>

      <main className="min-w-0">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
