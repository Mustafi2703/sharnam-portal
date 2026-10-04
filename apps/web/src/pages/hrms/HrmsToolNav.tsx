import { Fragment } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../auth";
import { canManageHrms } from "../../lib/portalAccounts";
import { HRMS_ACCENT, HRMS_SECTIONS, type HrmsSection } from "./hrmsNav";
import { formatUiText } from "../../lib/formatUiText";

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

/** Full HRMS tool strip — same chrome as CRM and project modules. */
export default function HrmsToolNav() {
  const loc = useLocation();
  const { user } = useAuth();
  const isAdmin = canManageHrms(user);

  return (
    <nav className="tool-strip" aria-label="HRMS tools">
      <div className="flex gap-1.5 overflow-x-auto scrollbars-visible items-center">
        {HRMS_SECTIONS.map((section, si) => {
          const tools = section.tools.filter((t) => !t.adminOnly || isAdmin);
          if (!tools.length) return null;
          return (
            <Fragment key={section.id}>
              {si > 0 ? <span className="crm-nav-divider" aria-hidden /> : null}
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
                    title={t.subtitle}
                  >
                    {formatUiText(t.label)}
                  </NavLink>
                );
              })}
            </Fragment>
          );
        })}
      </div>
    </nav>
  );
}
