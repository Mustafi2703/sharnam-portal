import { Fragment, type CSSProperties } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../auth";
import { CRM_ACCENT, CRM_SOFT, CRM_SECTIONS, CRM_TOOLS, CRM_VENDOR_TOOLS } from "./crmNav";

const tabClass = (on: boolean) =>
  `tool-strip__tab shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold border transition whitespace-nowrap ${
    on ? "is-on text-white border-transparent" : "bg-paper border-line text-steel-muted hover:text-ink"
  }`;

function toolActive(pathname: string, to: string, end?: boolean) {
  const base = `/crm/${to}`;
  if (end) return pathname === base;
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** CRM module shell — Procore-style chrome matching project tool workspaces. */
export default function CrmLayout() {
  const loc = useLocation();
  const { user } = useAuth();
  const isVendor = user?.role === "vendor";
  const tools = isVendor ? CRM_VENDOR_TOOLS : CRM_TOOLS;

  const activeTool = CRM_TOOLS.find((t) => toolActive(loc.pathname, t.to, t.to === "leads" || t.to === "projects"));

  const onBids = loc.pathname.startsWith("/crm/bids");
  const onBidDetail = /\/crm\/bids\/[^/]+/.test(loc.pathname);
  const onProposalEdit = /\/crm\/proposals\/(new|[^/]+)/.test(loc.pathname);

  const pageTitle = onBidDetail
    ? "Comparative bids"
    : onProposalEdit
      ? "PMC proposal"
      : activeTool?.label || (isVendor ? "My bids" : "CRM desk");

  const pageSubtitle =
    activeTool?.subtitle ||
    (isVendor
      ? "Fill R2 discipline BOQs in-portal — no separate sheet maker."
      : "Leads, comparative bids, and PMC proposals — one desk.");

  return (
    <div
      className="crm-workspace tool-workspace w-full min-w-0 flex flex-col flex-1 min-h-0"
      style={
        {
          ["--tool-accent" as string]: CRM_ACCENT,
          ["--module-accent" as string]: CRM_ACCENT,
          ["--module-soft" as string]: CRM_SOFT,
        } as CSSProperties
      }
    >
      <div className="tool-chrome bg-paper border-b border-line sticky top-0 z-20 shrink-0">
        <div className="px-3 sm:px-5 py-2.5 flex flex-wrap items-center gap-3 justify-between">
          <div className="min-w-0 flex items-center gap-3">
            <span
              className="h-9 w-9 rounded-lg grid place-items-center text-white shrink-0 shadow-sm font-display text-sm font-bold"
              style={{ background: CRM_ACCENT }}
            >
              CRM
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-steel-muted">
                <span className="font-semibold" style={{ color: CRM_ACCENT }}>
                  {isVendor ? "Contractor portal" : "Market intelligence"}
                </span>
                {onBidDetail && (
                  <>
                    <span>·</span>
                    <span className="font-mono text-ink">Package detail</span>
                  </>
                )}
              </div>
              <h1 className="font-display text-base sm:text-lg text-ink truncate">{pageTitle}</h1>
            </div>
          </div>
          <p className="text-xs text-steel-muted max-w-md hidden lg:block leading-relaxed">{pageSubtitle}</p>
        </div>

        <nav
          className="tool-strip px-2 sm:px-4 py-2 border-t border-line bg-paper"
          aria-label="CRM tools"
        >
          <div className="flex gap-1.5 overflow-x-auto scrollbars-visible items-center">
            {isVendor ? (
              tools.map((t) => {
                const to = `/crm/${t.to}`;
                return (
                  <NavLink
                    key={t.to}
                    to={to}
                    end={"end" in t ? t.end : false}
                    className={({ isActive }) => tabClass(isActive)}
                    style={({ isActive }) =>
                      isActive ? { background: CRM_ACCENT, borderColor: CRM_ACCENT } : undefined
                    }
                  >
                    {t.label}
                  </NavLink>
                );
              })
            ) : (
              CRM_SECTIONS.map((section, sectionIndex) => (
                <Fragment key={section.id}>
                  {sectionIndex > 0 && <span className="crm-nav-divider" aria-hidden />}
                  {section.tools.map((t) => {
                    const to = `/crm/${t.to}`;
                    const active =
                      toolActive(loc.pathname, t.to, t.to === "leads" || t.to === "projects") ||
                      (t.to === "proposals" && loc.pathname.startsWith("/crm/proposals"));
                    return (
                      <NavLink
                        key={t.to}
                        to={to}
                        end={t.to === "leads" || t.to === "projects"}
                        className={() => tabClass(active)}
                        style={active ? { background: CRM_ACCENT, borderColor: CRM_ACCENT } : undefined}
                      >
                        {t.label}
                      </NavLink>
                    );
                  })}
                </Fragment>
              ))
            )}
          </div>
        </nav>

        {onBids && !isVendor && (
          <div className="module-hub__workflow border-t border-line bg-sand/80 px-3 sm:px-5 py-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-steel-muted">
            <span>
              <strong className="text-ink font-semibold">1.</strong> Create package
            </span>
            <span>
              <strong className="text-ink font-semibold">2.</strong> Open bid & notify
            </span>
            <span>
              <strong className="text-ink font-semibold">3.</strong> Fill discipline BOQs
            </span>
            <span>
              <strong className="text-ink font-semibold">4.</strong> Compare & award L1
            </span>
          </div>
        )}
      </div>

      <div className="crm-shell crm-module min-w-0 w-full flex-1 min-h-0 flex flex-col">
        <Outlet />
      </div>
    </div>
  );
}
