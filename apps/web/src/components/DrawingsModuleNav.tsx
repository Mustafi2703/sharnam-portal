import { useLocation } from "react-router-dom";
import { DRAWINGS_MODULE_NAV, drawingsNavActive } from "../lib/drawingsModuleNav";
import { formatUiText } from "../lib/formatUiText";
import { useAuth } from "../auth";
import { openFamilyChecklistFill } from "../lib/checklistFillWindow";
import { isToolWindow, openModuleToolWindow, withToolWindowParam } from "../lib/moduleToolWindow";

/** Shared tab strip for all Drawings-module tools */
export function DrawingsModuleNav({ projectId, accent = "#2563EB" }: { projectId: string; accent?: string }) {
  const location = useLocation();
  const { user, token } = useAuth();
  const items = DRAWINGS_MODULE_NAV.filter(
    (item) => !item.roles || !user?.role || item.roles.includes(user.role)
  );

  return (
    <nav className="flex gap-2 overflow-x-scroll overscroll-x-contain scrollbars-visible" aria-label="Drawings module tools">
      {items.map((item) => {
        const href = `/projects/${projectId}/${item.to}${item.query ? `?${item.query}` : ""}`;
        const active = drawingsNavActive(item.key, location.pathname, location.search);
        const inWin = isToolWindow(location.search);
        return (
          <a
            key={item.key}
            href={inWin ? withToolWindowParam(href, true) : href}
            className={`tool-strip__tab shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold border transition whitespace-nowrap ${
              active ? "is-on text-white border-transparent" : "bg-paper border-line text-steel-muted hover:text-ink"
            }`}
            style={active ? { background: accent, borderColor: accent } : undefined}
            onClick={(e) => {
              if (item.fillFamily) {
                e.preventDefault();
                void openFamilyChecklistFill(projectId, item.fillFamily, token);
                return;
              }
              if (inWin || item.key === "hub") return;
              e.preventDefault();
              const w = openModuleToolWindow(href, item.label);
              if (!w) window.location.assign(withToolWindowParam(href, true));
            }}
          >
            {formatUiText(item.label)}
          </a>
        );
      })}
    </nav>
  );
}
