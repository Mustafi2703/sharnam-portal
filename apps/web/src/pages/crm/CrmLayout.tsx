import { type CSSProperties } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../auth";
import { PageHeader } from "../../components/ui";
import { CRM_ACCENT, CRM_SOFT, CRM_TOOLS, CRM_VENDOR_TOOLS } from "./crmNav";

const tabClass = (on: boolean) =>
  `tool-strip__tab shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold border transition whitespace-nowrap ${
    on ? "is-on text-white border-transparent" : "bg-paper border-line text-steel-muted hover:text-ink"
  }`;

/** CRM module shell — Procore-style tool strip matching project modules. */
export default function CrmLayout() {
  const loc = useLocation();
  const { user } = useAuth();
  const isVendor = user?.role === "vendor";
  const tools = isVendor ? CRM_VENDOR_TOOLS : CRM_TOOLS;

  const activeTool = tools.find((t) => {
    const base = `/crm/${t.to}`;
    return "end" in t && t.end ? loc.pathname === base || loc.pathname === `${base}/` : loc.pathname.startsWith(base);
  });

  const onBidDetail = /\/crm\/bids\/[^/]+/.test(loc.pathname);

  return (
    <div
      className="page-stack--register page-scroll-full flex flex-col flex-1 min-h-0 gap-4"
      style={
        {
          ["--module-accent" as string]: CRM_ACCENT,
          ["--module-soft" as string]: CRM_SOFT,
        } as CSSProperties
      }
    >
      <div className="shrink-0 space-y-3">
        <PageHeader
          eyebrow={isVendor ? "CRM · Contractor" : "CRM · Market intelligence"}
          title={
            onBidDetail
              ? "Bid package"
              : activeTool?.label || (isVendor ? "My bids" : "CRM desk")
          }
          subtitle={
            activeTool?.subtitle ||
            (isVendor
              ? "Fill R2 discipline BOQs in-portal — no separate sheet maker."
              : "Leads, comparative bids, and PMC proposals — one desk.")
          }
        />

        <nav
          className="tool-strip px-2 sm:px-3 py-2 border border-line rounded-xl bg-paper flex gap-2 overflow-x-auto scrollbars-visible"
          aria-label="CRM tools"
        >
          {tools.map((t) => {
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
          })}
          {!isVendor && onBidDetail && (
            <span
              className="tool-strip__tab shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold border is-on text-white"
              style={{ background: CRM_ACCENT, borderColor: CRM_ACCENT }}
            >
              Package detail
            </span>
          )}
        </nav>
      </div>

      <div className="crm-outlet min-w-0 w-full">
        <Outlet />
      </div>
    </div>
  );
}
