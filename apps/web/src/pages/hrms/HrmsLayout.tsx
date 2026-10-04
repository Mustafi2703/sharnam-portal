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
      {/* Tool strip duplicates the left nav — shown only on mobile or when the nav is hidden. */}
      <div className="hrms-toolstrip tool-chrome bg-paper border border-line rounded-xl overflow-hidden">
        <div className="px-2 sm:px-3 py-2">
          <HrmsToolNav />
        </div>
      </div>
      <div className="hrms-module__outlet min-w-0 w-full">
        <Outlet />
      </div>
    </div>
  );
}
