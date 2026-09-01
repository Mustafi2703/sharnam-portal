import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth";
import { HRMS_ACCENT, HRMS_SECTIONS } from "./hrmsNav";

function toolPath(to: string) {
  return to ? `/hrm/${to}` : "/hrm";
}

function isToolActive(pathname: string, to: string, end?: boolean) {
  const base = toolPath(to);
  if (end) return pathname === base || pathname === `${base}/`;
  return pathname === base || pathname.startsWith(`${base}/`);
}

export default function HrmsSideNav({ onNavigate }: { onNavigate?: () => void }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "office";

  return (
    <div className="hrms-side-nav__inner">
      <div className="hrms-side-nav__head">
        <Link to="/hrm" className="hrms-side-nav__brand" onClick={onNavigate} aria-label="HRMS home">
          <img src="/logo-transparent.png" alt="Sharnam" className="hrms-side-nav__logo" width={200} height={96} />
        </Link>
        <p className="hrms-side-nav__desk">HR team portal</p>
      </div>

      <div className="hrms-side-nav__scroll">
        {HRMS_SECTIONS.map((section) => {
          const tools = section.tools.filter((t) => !t.adminOnly || isAdmin);
          if (!tools.length) return null;
          return (
            <section key={section.id} className="hrms-side-nav__section">
              <div className="hrms-side-nav__section-head">
                <p className="hrms-side-nav__label">{section.label}</p>
              </div>
              <nav className="hrms-side-nav__group" aria-label={section.label}>
                {tools.map((t) => {
                  const to = toolPath(t.to);
                  const active = isToolActive(loc.pathname, t.to, t.end);
                  return (
                    <NavLink
                      key={t.to || "home"}
                      to={to}
                      end={t.end}
                      onClick={onNavigate}
                      className={`hrms-side-nav__item${active ? " is-active" : ""}`}
                    >
                      {t.label}
                    </NavLink>
                  );
                })}
              </nav>
            </section>
          );
        })}
      </div>

      <div className="hrms-side-nav__foot">
        <Link to="/dashboard" className="hrms-side-nav__foot-link" onClick={onNavigate}>
          Office portal ↗
        </Link>
        <p className="hrms-side-nav__user" title={user?.fullName}>
          {user?.fullName}
        </p>
        <button
          type="button"
          className="hrms-side-nav__signout"
          onClick={() => {
            logout();
            navigate("/login/hr");
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
