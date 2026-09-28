import { type CSSProperties } from "react";
import { Outlet } from "react-router-dom";
import HrmsToolNav from "./HrmsToolNav";
import { HRMS_ACCENT, HRMS_SOFT } from "./hrmsNav";

/** HRMS content — section tool strip only (title lives in the portal top bar). */
export default function HrmsLayout() {
  return (
    <div
      className="hrms-module flex flex-col gap-4 pb-8 min-w-0 w-full"
      style={
        {
          ["--module-accent" as string]: HRMS_ACCENT,
          ["--module-soft" as string]: HRMS_SOFT,
        } as CSSProperties
      }
    >
      <div className="tool-chrome bg-paper border border-line rounded-xl overflow-hidden">
        <div className="px-3 sm:px-4 py-2.5 flex flex-wrap items-center gap-3">
          <span
            className="h-9 w-9 rounded-lg grid place-items-center text-white shrink-0 shadow-sm text-xs font-bold"
            style={{ background: HRMS_ACCENT }}
          >
            HR
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold" style={{ color: HRMS_ACCENT }}>People Desk</p>
            <h1 className="font-display text-base text-ink">Hire, Pay, And File</h1>
          </div>
        </div>
        <div className="px-2 sm:px-3 py-2 border-t border-line">
          <HrmsToolNav />
        </div>
      </div>
      <div className="hrms-module__outlet min-w-0 w-full">
        <Outlet />
      </div>
    </div>
  );
}
