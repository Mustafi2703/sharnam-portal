import { Link, NavLink, useLocation } from "react-router-dom";
import { DrawingsModuleNav } from "./DrawingsModuleNav";
import { useAuth } from "../auth";
import { isToolActive } from "../lib/moduleToolNav";
import { MODULE_TOOLS, type WorkspaceKey } from "../workspaces";

type ModuleNavKey = WorkspaceKey | "home";

const tabClass = (on: boolean) =>
  `tool-strip__tab shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold border transition whitespace-nowrap ${
    on ? "is-on text-white border-transparent" : "bg-paper border-line text-steel-muted hover:text-ink"
  }`;

/** Single module tool strip — rendered once in ProjectToolsLayout chrome (not duplicated on each page). */
export function ModuleToolNav({
  projectId,
  moduleKey,
  accent,
}: {
  projectId: string;
  moduleKey: ModuleNavKey;
  accent: string;
}) {
  const location = useLocation();
  const { user } = useAuth();

  if (moduleKey === "drawings") {
    return <DrawingsModuleNav projectId={projectId} accent={accent} />;
  }

  const items = (MODULE_TOOLS[moduleKey] || []).filter(
    (t) => !t.roles || !user?.role || t.roles.includes(user.role)
  );

  const hubHref = moduleKey === "home" ? `/projects/${projectId}` : `/projects/${projectId}/hub/${moduleKey}`;
  const hubLabel = moduleKey === "home" ? "Project home" : "Hub";

  return (
    <nav className="flex gap-2 overflow-x-auto overscroll-x-contain scrollbar-thin" aria-label={`${moduleKey} module tools`}>
      <Link
        to={hubHref}
        className="tool-strip__tab shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold border border-line text-steel-muted hover:text-ink transition whitespace-nowrap"
      >
        {hubLabel}
      </Link>
      {items.map((t) => {
        const href = t.to ? `/projects/${projectId}/${t.to}${t.query ? `?${t.query}` : ""}` : `/projects/${projectId}`;
        const on = isToolActive(t, location.pathname, location.search, projectId);
        return (
          <NavLink
            key={`${t.to}-${t.query || ""}-${t.label}`}
            to={href}
            end={t.end}
            className={() => tabClass(on)}
            style={on ? { background: accent, borderColor: accent } : undefined}
          >
            {t.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
