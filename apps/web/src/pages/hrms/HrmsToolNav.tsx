import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../auth";
import { HRMS_ACCENT, HRMS_SECTIONS, type HrmsSection } from "./hrmsNav";

function toolPath(to: string) {
  return to ? `/hrm/${to}` : "/hrm";
}

function isToolActive(pathname: string, to: string, end?: boolean) {
  const base = toolPath(to);
  if (end) return pathname === base || pathname === `${base}/`;
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function activeHrmsSection(pathname: string): HrmsSection {
  for (const section of HRMS_SECTIONS) {
    for (const tool of section.tools) {
      if (isToolActive(pathname, tool.to, tool.end)) return section;
    }
  }
  return HRMS_SECTIONS[0];
}

const tabClass = (on: boolean) =>
  `tool-strip__tab shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold border transition whitespace-nowrap ${
    on ? "is-on text-white border-transparent" : "bg-paper border-line text-steel-muted hover:text-ink"
  }`;

/** Horizontal tool strip — mirrors project module tool navigation. */
export default function HrmsToolNav() {
  const loc = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "office";
  const section = activeHrmsSection(loc.pathname);
  const tools = section.tools.filter((t) => !t.adminOnly || isAdmin);

  return (
    <nav
      className="tool-strip flex gap-2 overflow-x-scroll overscroll-x-contain scrollbars-visible px-2 sm:px-0 py-2 border-t border-line bg-paper -mx-3 sm:-mx-5 px-3 sm:px-5"
      aria-label="HRMS tools"
    >
      <Link
        to="/hrm"
        className="tool-strip__tab shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold border border-line text-steel-muted hover:text-ink transition whitespace-nowrap"
      >
        HR home
      </Link>
      {tools.map((t) => {
        const to = toolPath(t.to);
        const on = isToolActive(loc.pathname, t.to, t.end);
        return (
          <NavLink
            key={t.to || "home"}
            to={to}
            end={t.end}
            className={() => tabClass(on)}
            style={on ? { background: HRMS_ACCENT, borderColor: HRMS_ACCENT } : undefined}
          >
            {t.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
