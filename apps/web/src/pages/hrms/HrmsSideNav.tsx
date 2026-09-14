import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth";
import { canManageHrms, isJoiningEmployee } from "../../lib/portalAccounts";
import { ModuleIcon, IconMoon, IconSun } from "../../components/icons";
import { formatUiText } from "../../lib/formatUiText";
import type { ColorMode } from "../../themes";
import { HRMS_ACCENT, HRMS_SECTIONS } from "./hrmsNav";

function toolPath(to: string) {
  return to ? `/hrm/${to}` : "/hrm";
}

function isToolActive(pathname: string, to: string, end?: boolean) {
  const base = toolPath(to);
  if (end) return pathname === base || pathname === `${base}/`;
  return pathname === base || pathname.startsWith(`${base}/`);
}

export default function HrmsSideNav({
  onNavigate,
  colorMode,
  onToggleTheme,
}: {
  onNavigate?: () => void;
  colorMode: ColorMode;
  onToggleTheme: () => void;
}) {
  const loc = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isAdmin = canManageHrms(user);
  const isJoiner = isJoiningEmployee(user);
  const dark = colorMode === "dark";

  return (
    <div className="side-nav__inner">
      <div className="side-nav__head">
        <Link
          to={isJoiner && user?.joiningOfferId ? `/hrm/onboarding/${user.joiningOfferId}` : "/hrm"}
          className="side-nav__brand"
          onClick={onNavigate}
          aria-label="HRMS home"
        >
          <img src="/logo-transparent.png" alt="Sharnam" className="side-nav__logo" width={240} height={116} />
        </Link>
        <span className="side-nav__role-badge" aria-label="HR desk">
          {isJoiner ? "New joiner" : "HR desk"}
        </span>
      </div>

      <div className="side-nav__scroll">
        {HRMS_SECTIONS.map((section) => {
          const tools = section.tools.filter((t) => {
            if (isJoiner) return t.to === "onboarding";
            return !t.adminOnly || isAdmin;
          });
          if (!tools.length) return null;
          return (
            <section key={section.id} className="side-nav__section" aria-label={section.label}>
              <div className="side-nav__section-head">
                <p className="side-nav__label">{formatUiText(section.label)}</p>
              </div>
              <nav className="side-nav__group">
                {tools.map((t) => {
                  const to = toolPath(t.to);
                  const active = isToolActive(loc.pathname, t.to, t.end);
                  return (
                    <NavLink
                      key={t.to || "home"}
                      to={to}
                      end={t.end}
                      onClick={onNavigate}
                      className={`side-nav__item side-nav__item--module${active ? " is-active" : ""}`}
                      style={{ ["--item-accent" as string]: HRMS_ACCENT }}
                    >
                      <span className="side-nav__icon-wrap" style={{ color: HRMS_ACCENT }}>
                        <ModuleIcon name={t.icon} size={18} />
                      </span>
                      <span className="min-w-0 truncate">{formatUiText(t.label)}</span>
                      {active ? <span className="side-nav__item-live" aria-hidden /> : null}
                    </NavLink>
                  );
                })}
              </nav>
            </section>
          );
        })}
      </div>

      <div className="side-nav__foot">
        {!user?.hrDeskOnly && !isJoiner && (
          <Link to="/dashboard" className="side-nav__item" onClick={onNavigate}>
            <ModuleIcon name="modules" size={18} />
            <span>Office portal</span>
          </Link>
        )}
        <button type="button" className="side-nav__item w-full" onClick={onToggleTheme}>
          {dark ? <IconSun size={18} /> : <IconMoon size={18} />}
          <span>{dark ? "Light mode" : "Dark mode"}</span>
        </button>
        <div className="side-nav__user" title={user?.fullName}>
          {user?.fullName}
          <span className="side-nav__user-role">
            {isJoiner ? " · Pre-joining" : user?.hrDeskOnly ? " · HR Head" : " · Office"}
          </span>
        </div>
        <button
          type="button"
          className="side-nav__signout"
          onClick={() => {
            logout();
            navigate(isJoiner ? "/login/employee" : "/login/hr");
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
