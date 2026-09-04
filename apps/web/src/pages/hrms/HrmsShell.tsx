import { useEffect, useState, type ReactNode } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { IconClose, IconMenu, IconMoon, IconPanel, IconPanelRight, IconSun } from "../../components/icons";
import { BRAND_EN } from "../../components/Brand";
import {
  applyModuleAccent,
  getColorMode,
  HRMS_SIDEBAR_HIDDEN_KEY,
  toggleColorMode,
  type ColorMode,
} from "../../themes";
import HrmsSideNav from "./HrmsSideNav";
import { HRMS_ACCENT, HRMS_SOFT, HRMS_TOOLS } from "./hrmsNav";

/** Standalone HRMS portal — same app-frame + collapsible nav as the office desk. */
export default function HrmsShell({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hidden, setHidden] = useState(() => {
    try {
      const v = localStorage.getItem(HRMS_SIDEBAR_HIDDEN_KEY);
      if (v === null) return false;
      return v === "1";
    } catch {
      return false;
    }
  });
  const [colorMode, setColorMode] = useState<ColorMode>(() => getColorMode());

  const activeTool = HRMS_TOOLS.find((t) => {
    const base = t.to ? `/hrm/${t.to}` : "/hrm";
    const exact = "end" in t && t.end;
    return exact ? location.pathname === base || location.pathname === `${base}/` : location.pathname.startsWith(base);
  });

  useEffect(() => {
    applyModuleAccent(HRMS_ACCENT, HRMS_SOFT);
    return () => {
      applyModuleAccent("#0B6A78", "#E6F4F6");
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(HRMS_SIDEBAR_HIDDEN_KEY, hidden ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [hidden]);

  function onToggleTheme() {
    setColorMode(toggleColorMode());
  }

  const dark = colorMode === "dark";

  return (
    <div
      className={`app-frame hrms-portal-shell ${hidden ? "is-hidden" : ""}`}
      style={{ ["--wd-accent" as string]: HRMS_ACCENT }}
    >
      <aside
        className={`side-nav hidden md:flex ${hidden ? "is-off" : ""}`}
        aria-label="HRMS navigation"
        aria-hidden={hidden}
      >
        {!hidden && <HrmsSideNav colorMode={colorMode} onToggleTheme={onToggleTheme} />}
      </aside>

      <div className="app-frame__main">
        <header className="app-topbar">
          <div className="flex items-center gap-2.5 px-3 sm:px-4 h-[52px]">
            <button
              type="button"
              className="app-topbar__menu-btn md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-paper text-ink"
              aria-label="Open HR menu"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
            >
              <IconMenu size={18} />
            </button>
            <button
              type="button"
              className="hidden md:inline-flex app-topbar__nav-toggle h-8 items-center gap-1.5 rounded-lg border border-line bg-paper px-2.5 text-ink hover:bg-brand-soft hover:border-brand/40"
              aria-label={hidden ? "Show left navigation" : "Hide left navigation"}
              title={hidden ? "Show left navigation" : "Hide left navigation"}
              onClick={() => setHidden((h) => !h)}
            >
              {hidden ? <IconPanelRight size={15} /> : <IconPanel size={15} />}
              <span className="text-[11px] font-bold uppercase tracking-[0.08em]">
                {hidden ? "Show nav" : "Hide nav"}
              </span>
            </button>

            <Link to="/hrm" className="app-topbar__brand min-w-0 shrink-0" aria-label={`${BRAND_EN} HRMS`}>
              <img src="/logo-transparent.png" alt={BRAND_EN} className="app-topbar__logo" width={160} height={76} />
            </Link>

            <div className="app-topbar__meta">
              <span className="app-topbar__role-badge">HR desk</span>
              <div className="app-topbar__title truncate">
                {activeTool?.label === "Dashboard" ? "Human Resources" : activeTool?.label || "HRMS"}
              </div>
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              <Link to="/dashboard" className="app-topbar__chip hidden sm:inline-flex hover:border-brand">
                Office portal
              </Link>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-paper text-ink hover:bg-brand-soft"
                aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
                onClick={onToggleTheme}
              >
                {dark ? <IconSun size={16} /> : <IconMoon size={16} />}
              </button>
            </div>
          </div>
        </header>

        <main className="app-frame__scroll">
          <div className="w-full max-w-6xl mx-auto px-3 sm:px-5 py-4 sm:py-6">{children ?? <Outlet />}</div>
        </main>
      </div>

      {drawerOpen && (
        <div className="app-mobile-drawer md:hidden" role="dialog" aria-modal="true" aria-label="HRMS menu">
          <button
            type="button"
            className="app-mobile-drawer__backdrop"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="side-nav side-nav--drawer app-mobile-drawer__panel">
            <button
              type="button"
              className="side-nav__close absolute right-3 top-3 z-10 h-9 w-9 rounded-lg grid place-items-center"
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
            >
              <IconClose size={16} />
            </button>
            <HrmsSideNav
              onNavigate={() => setDrawerOpen(false)}
              colorMode={colorMode}
              onToggleTheme={onToggleTheme}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
