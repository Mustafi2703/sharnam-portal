import { type CSSProperties } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { PageHeader } from "../../components/ui";
import HrmsToolNav from "./HrmsToolNav";
import { HRMS_ACCENT, HRMS_SOFT, HRMS_TOOLS } from "./hrmsNav";

/** HRMS content shell — page header + horizontal tool strip (project-module pattern). */
export default function HrmsLayout() {
  const loc = useLocation();

  const activeTool = HRMS_TOOLS.find((t) => {
    const base = t.to ? `/hrm/${t.to}` : "/hrm";
    const exact = "end" in t && t.end;
    return exact ? loc.pathname === base || loc.pathname === `${base}/` : loc.pathname.startsWith(base);
  });

  return (
    <div
      className="hrms-module page-scroll-full flex flex-col gap-0 pb-8 min-w-0 w-full"
      style={
        {
          ["--module-accent" as string]: HRMS_ACCENT,
          ["--module-soft" as string]: HRMS_SOFT,
        } as CSSProperties
      }
    >
      <div className="sticky top-0 z-10 bg-paper border-b border-line -mx-3 sm:-mx-5">
        <div className="px-3 sm:px-5 pt-1">
          <PageHeader
            dense
            eyebrow="HRMS · शरणम्"
            title={activeTool?.label === "Dashboard" ? "Human Resources desk" : activeTool?.label || "HRMS"}
            subtitle={
              activeTool?.subtitle ||
              "Recruitment → onboarding → attendance → leave → payroll — standalone HR portal."
            }
          />
        </div>
        <HrmsToolNav />
      </div>

      <div className="hrms-module__outlet min-w-0 w-full pt-4">
        <Outlet />
      </div>
    </div>
  );
}
