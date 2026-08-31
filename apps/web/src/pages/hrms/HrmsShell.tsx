import { type ReactNode } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth";
import { BrandMark } from "../../components/Brand";
import { HRMS_ACCENT } from "./hrmsNav";

/** Standalone HRMS portal shell — matches office portal sand/paper theme. */
export default function HrmsShell({ children }: { children?: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div
      className="hrms-portal-shell min-h-dvh flex flex-col bg-sand"
      style={{ ["--module-accent" as string]: HRMS_ACCENT }}
    >
      <header className="shrink-0 border-b border-line bg-paper shadow-sm">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link to="/hrm" className="shrink-0">
              <BrandMark size="md" showTag={false} compact />
            </Link>
            <div className="min-w-0 hidden sm:block border-l border-line pl-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-brand">HRMS Portal</div>
              <div className="text-sm font-semibold text-ink truncate">Recruitment · Attendance · Payroll</div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              to="/dashboard"
              className="hidden md:inline text-xs text-steel-muted hover:text-brand border border-line rounded-md px-2.5 py-1.5 bg-paper"
            >
              Office portal ↗
            </Link>
            <span className="text-xs text-steel-muted hidden lg:inline truncate max-w-[160px]">{user?.fullName}</span>
            <button
              type="button"
              className="text-xs font-semibold border border-line rounded-md px-3 py-1.5 hover:bg-sand bg-paper"
              onClick={() => {
                logout();
                navigate("/login/hr");
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="hrms-portal-shell__main flex-1 flex flex-col min-h-0 max-w-[1440px] mx-auto w-full px-4 sm:px-6 py-4">
        {children ?? <Outlet />}
      </main>

      <footer className="shrink-0 border-t border-line py-3 text-center text-[11px] text-steel-muted bg-paper">
        HR team portal · Office admins manage users &amp; vendors under HRMS → Users / Vendors ·{" "}
        <Link to="/login/office" className="text-brand">
          Office login
        </Link>
      </footer>
    </div>
  );
}
