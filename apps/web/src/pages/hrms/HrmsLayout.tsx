import { type CSSProperties } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { PageHeader } from "../../components/ui";
import { HRMS_ACCENT, HRMS_TOOLS } from "./hrmsNav";

/**
 * Unified HRMS shell — one desk with a horizontal tool strip (Procore-style).
 * All HR tools live under /hrm/* instead of scattered /hrms/* sidebar links.
 */
export default function HrmsLayout() {
  const loc = useLocation();
  const activeTool = HRMS_TOOLS.find((t) => {
    const base = t.to ? `/hrm/${t.to}` : "/hrm";
    const exact = "end" in t && t.end;
    return exact ? loc.pathname === base || loc.pathname === `${base}/` : loc.pathname.startsWith(base);
  });

  return (
    <div
      className="space-y-5 min-w-0"
      style={
        {
          ["--module-accent" as string]: HRMS_ACCENT,
          ["--module-soft" as string]: "#CCFBF1",
        } as CSSProperties
      }
    >
      <PageHeader
        eyebrow="HRMS · शरणम्"
        title={activeTool?.label === "Dashboard" ? "Human Resources desk" : activeTool?.label || "HRMS"}
        subtitle={activeTool?.subtitle || "Recruitment → pre-join → onboarding → attendance → leave → payroll — one integrated module."}
      />

      <nav className="hrms-tool-rail" aria-label="HRMS tools">
        {HRMS_TOOLS.map((t) => (
          <NavLink
            key={t.to || "home"}
            to={t.to ? `/hrm/${t.to}` : "/hrm"}
            end={"end" in t ? t.end : false}
            className={({ isActive }) =>
              `hrms-tool-rail__link${isActive ? " hrms-tool-rail__link--active" : ""}`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>

      <div className="min-w-0 overflow-x-hidden">
        <Outlet />
      </div>
    </div>
  );
}
