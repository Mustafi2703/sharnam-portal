import { Link, useLocation } from "react-router-dom";
import { DRAWINGS_MODULE_NAV, drawingsNavActive } from "../lib/drawingsModuleNav";
import { formatUiText } from "../lib/formatUiText";
import { useAuth } from "../auth";

/** Shared tab strip for all Drawings-module tools */
export function DrawingsModuleNav({ projectId, accent = "#2563EB" }: { projectId: string; accent?: string }) {
  const location = useLocation();
  const { user } = useAuth();
  const items = DRAWINGS_MODULE_NAV.filter(
    (item) => !item.roles || !user?.role || item.roles.includes(user.role)
  );

  return (
    <nav className="flex gap-2 overflow-x-scroll overscroll-x-contain scrollbars-visible" aria-label="Drawings module tools">
      {items.map((item) => {
        const href = `/projects/${projectId}/${item.to}${item.query ? `?${item.query}` : ""}`;
        const active = drawingsNavActive(item.key, location.pathname, location.search);
        return (
          <Link
            key={item.key}
            to={href}
            className={`tool-strip__tab shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold border transition whitespace-nowrap ${
              active ? "is-on text-white border-transparent" : "bg-paper border-line text-steel-muted hover:text-ink"
            }`}
            style={active ? { background: accent, borderColor: accent } : undefined}
          >
            {formatUiText(item.label)}
          </Link>
        );
      })}
    </nav>
  );
}
