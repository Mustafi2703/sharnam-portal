import { Link, useLocation } from "react-router-dom";
import { DRAWINGS_MODULE_NAV, drawingsNavActive } from "../lib/drawingsModuleNav";
import { formatUiText } from "../lib/formatUiText";
import { useAuth } from "../auth";

/** Shared tab strip for all Drawings-module tools */
export function DrawingsModuleNav({ projectId }: { projectId: string }) {
  const location = useLocation();
  const { user } = useAuth();
  const items = DRAWINGS_MODULE_NAV.filter(
    (item) => !item.roles || !user?.role || item.roles.includes(user.role)
  );

  return (
    <nav
      className="module-subnav flex gap-1 border-b border-line pb-3 overflow-x-auto overscroll-x-contain -mx-1 px-1 scrollbar-thin"
      aria-label="Drawings module tools"
    >
      {items.map((item) => {
        const href = `/projects/${projectId}/${item.to}${item.query ? `?${item.query}` : ""}`;
        const active = drawingsNavActive(item.key, location.pathname, location.search);
        return (
          <Link
            key={item.key}
            to={href}
            className={`shrink-0 rounded-sm px-2.5 py-1.5 text-xs font-medium border transition whitespace-nowrap ${
              active ? "bg-brand text-white border-brand" : "bg-paper border-line text-steel-muted hover:text-ink"
            }`}
          >
            {formatUiText(item.label)}
          </Link>
        );
      })}
    </nav>
  );
}
