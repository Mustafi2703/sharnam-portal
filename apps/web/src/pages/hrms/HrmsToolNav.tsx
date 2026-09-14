import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../auth";
import { canManageHrms } from "../../lib/portalAccounts";
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
  `inline-flex shrink-0 items-center rounded-md px-3 py-1.5 text-xs font-semibold border transition whitespace-nowrap ${
    on ? "is-on text-white border-transparent" : "bg-paper border-line text-steel-muted hover:text-ink hover:border-brand/30"
  }`;

/** Section-scoped horizontal tabs — complements the left sidebar without repeating every module. */
export default function HrmsToolNav() {
  const loc = useLocation();
  const { user } = useAuth();
  const isAdmin = canManageHrms(user);
  const section = activeHrmsSection(loc.pathname);
  const tools = section.tools.filter((t) => !t.adminOnly || isAdmin);
  const onDashboard = loc.pathname === "/hrm" || loc.pathname === "/hrm/";

  if (onDashboard) return null;

  return (
    <nav className="hrms-tool-strip rounded-xl border border-line bg-paper px-3 py-2" aria-label={`${section.label} tools`}>
      <p className="text-[10px] font-mono uppercase tracking-wide text-steel-muted mb-2">{section.label}</p>
      <div className="flex flex-nowrap gap-2 overflow-x-auto scrollbars-visible pb-0.5">
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
      </div>
    </nav>
  );
}
