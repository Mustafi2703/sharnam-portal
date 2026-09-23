import { PageHeader } from "../../components/ui";
import { formatUiText } from "../../lib/formatUiText";
import { openModuleToolWindow, withToolWindowParam } from "../../lib/moduleToolWindow";
import { CRM_ACCENT, CRM_SECTIONS } from "./crmNav";

function openCrmTool(href: string, label: string) {
  const w = openModuleToolWindow(href, label);
  if (!w) window.location.assign(withToolWindowParam(href, true));
}

/** CRM desk — same pattern as a project module hub: pick a tool, work in a new window. */
export default function CrmHubPage() {
  return (
    <div className="module-hub space-y-5 min-w-0 p-4 sm:p-5" style={{ ["--module-accent" as string]: CRM_ACCENT }}>
      <div className="module-hub__hero border border-line bg-paper rounded-xl overflow-hidden">
        <div className="module-hub__hero-bar h-1" style={{ background: CRM_ACCENT }} aria-hidden />
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-start gap-4">
          <span
            className="module-hub__icon h-12 w-12 rounded-xl grid place-items-center text-white text-base font-display shrink-0 shadow-sm"
            style={{ background: CRM_ACCENT }}
          >
            CRM
          </span>
          <div className="min-w-0 flex-1">
            <PageHeader
              eyebrow="CRM · Tool desk"
              title="CRM"
              subtitle={formatUiText(
                "Leads, proposals, bids, and company directory — all on this desk. Open a tool in a new window to work, then return to the hub."
              )}
            />
          </div>
        </div>
        <div className="module-hub__workflow border-t border-line bg-sand/80 px-5 sm:px-6 py-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-steel-muted">
          <span>
            <strong className="text-ink font-semibold">1.</strong> Clients directory → activate portal
          </span>
          <span>
            <strong className="text-ink font-semibold">2.</strong> Lead → proposal → SharePoint Word
          </span>
          <span>
            <strong className="text-ink font-semibold">3.</strong> Award → project setup + matrix export
          </span>
          <span>
            <strong className="text-ink font-semibold">4.</strong> Bids · vendors upload rates → R2
          </span>
        </div>
      </div>

      {CRM_SECTIONS.map((section) => (
        <div key={section.id} className="space-y-3">
          <h2 className="text-[11px] font-mono uppercase tracking-wider text-steel-muted">{section.label}</h2>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {section.tools.map((t) => {
              const href = `/crm/${t.to}`;
              return (
                <a
                  key={t.to}
                  href={href}
                  className="module-hub__card group block h-full"
                  onClick={(e) => {
                    e.preventDefault();
                    openCrmTool(href, t.label);
                  }}
                >
                  <div className="h-full rounded-xl border border-line bg-paper p-4 sm:p-5 transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-brand/50">
                    <div className="font-display text-base font-semibold text-ink group-hover:text-brand leading-snug">
                      {formatUiText(t.label)}
                    </div>
                    <p className="text-sm text-steel-muted mt-2 leading-relaxed line-clamp-3">{formatUiText(t.subtitle)}</p>
                    <div className="mt-4 pt-3 border-t border-line/80 text-sm font-semibold text-brand flex items-center justify-between gap-2">
                      <span>Open</span>
                      <span aria-hidden className="group-hover:translate-x-0.5 transition-transform">
                        ↗
                      </span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
