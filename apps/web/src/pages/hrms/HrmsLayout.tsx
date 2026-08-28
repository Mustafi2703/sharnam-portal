import { type CSSProperties } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { PageHeader } from "../../components/ui";
import { HRMS_ACCENT, HRMS_SOFT, HRMS_TOOLS } from "./hrmsNav";

const tabClass = (on: boolean) =>
  `tool-strip__tab shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold border transition whitespace-nowrap ${
    on ? "is-on text-white border-transparent" : "bg-paper border-line text-steel-muted hover:text-ink"
  }`;

/** HRMS module shell — same tool-strip pattern as project modules. */
export default function HrmsLayout() {
  const loc = useLocation();
  const activeTool = HRMS_TOOLS.find((t) => {
    const base = t.to ? `/hrm/${t.to}` : "/hrm";
    const exact = "end" in t && t.end;
    return exact ? loc.pathname === base || loc.pathname === `${base}/` : loc.pathname.startsWith(base);
  });

  return (
    <div
      className="page-stack--register flex flex-col flex-1 min-h-0 gap-4"
      style={
        {
          ["--module-accent" as string]: HRMS_ACCENT,
          ["--module-soft" as string]: HRMS_SOFT,
        } as CSSProperties
      }
    >
      <div className="shrink-0 space-y-3">
        <PageHeader
          eyebrow="HRMS · शरणम्"
          title={activeTool?.label === "Dashboard" ? "Human Resources desk" : activeTool?.label || "HRMS"}
          subtitle={
            activeTool?.subtitle ||
            "Recruitment → onboarding → attendance → leave → payroll — standalone HR portal at /login/hr. Employee directory stays in Office → Access."
          }
        />

        <nav
          className="tool-strip px-2 sm:px-3 py-2 border border-line rounded-xl bg-paper flex gap-2 overflow-x-auto scrollbars-visible"
          aria-label="HRMS tools"
        >
          {HRMS_TOOLS.map((t) => (
            <NavLink
              key={t.to || "home"}
              to={t.to ? `/hrm/${t.to}` : "/hrm"}
              end={"end" in t ? t.end : false}
              className={({ isActive }) => tabClass(isActive)}
              style={({ isActive }) =>
                isActive ? { background: HRMS_ACCENT, borderColor: HRMS_ACCENT } : undefined
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
