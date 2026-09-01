import { useState, type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { IconClose, IconMenu } from "../../components/icons";
import HrmsSideNav from "./HrmsSideNav";
import { HRMS_ACCENT } from "./hrmsNav";

/** Standalone HRMS portal — left nav desk matching office / CRM module feel. */
export default function HrmsShell({ children }: { children?: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div
      className="hrms-portal-shell min-h-dvh flex flex-col bg-sand"
      style={{ ["--module-accent" as string]: HRMS_ACCENT, ["--hrms-accent" as string]: HRMS_ACCENT }}
    >
      <div className="hrms-portal-shell__frame flex flex-1 min-h-0 w-full">
        <aside className="hrms-side-nav hidden lg:flex" aria-label="HRMS navigation">
          <HrmsSideNav />
        </aside>

        <div className="hrms-portal-shell__body flex flex-col flex-1 min-w-0 min-h-0">
          <header className="hrms-portal-shell__topbar shrink-0 lg:hidden border-b border-line bg-paper px-3 py-2.5 flex items-center gap-3">
            <button
              type="button"
              className="hrms-portal-shell__menu"
              aria-label="Open HR menu"
              onClick={() => setDrawerOpen(true)}
            >
              <IconMenu />
            </button>
            <span className="text-sm font-semibold text-ink">HRMS</span>
          </header>

          <main className="hrms-portal-shell__main flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4 max-w-[1440px] w-full mx-auto">
            {children ?? <Outlet />}
          </main>
        </div>
      </div>

      {drawerOpen && (
        <div className="app-mobile-drawer lg:hidden" role="dialog" aria-modal="true" aria-label="HRMS menu">
          <button type="button" className="app-mobile-drawer__backdrop" aria-label="Close menu" onClick={() => setDrawerOpen(false)} />
          <aside className="hrms-side-nav hrms-side-nav--drawer">
            <button
              type="button"
              className="hrms-side-nav__close absolute right-3 top-3 z-10 h-9 w-9 rounded-lg grid place-items-center"
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
            >
              <IconClose />
            </button>
            <HrmsSideNav onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}
    </div>
  );
}
