import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../../components/ui";
import { MODULE_TOOLS, MODULE_META, type WorkspaceKey } from "../../workspaces";
import { formatUiText } from "../../lib/formatUiText";
import { useAuth } from "../../auth";

/** Module hub — numbered tool cards with workflow hints (Procore-style desk). */
export default function ModuleHubPage({ moduleKey }: { moduleKey: WorkspaceKey }) {
  const { id } = useParams();
  const { user } = useAuth();
  const meta = MODULE_META[moduleKey];
  const tools = (MODULE_TOOLS[moduleKey] || []).filter(
    (t) => !t.roles || !user?.role || t.roles.includes(user.role as any)
  );

  return (
    <div className="module-hub space-y-5 min-w-0" style={{ ["--module-accent" as string]: meta.accent }}>
      <div className="module-hub__hero border border-line bg-paper rounded-xl overflow-hidden">
        <div className="module-hub__hero-bar h-1" style={{ background: meta.accent }} aria-hidden />
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-start gap-4">
          <span
            className="module-hub__icon h-12 w-12 rounded-xl grid place-items-center text-white text-base font-display shrink-0 shadow-sm"
            style={{ background: meta.accent }}
          >
            {meta.icon}
          </span>
          <div className="min-w-0 flex-1">
            <PageHeader
              eyebrow={`${meta.title} module · Project desk`}
              title={meta.title}
              subtitle={formatUiText(
                `${meta.desc} Pick a tool below — each card opens a dedicated register or form. Upload sheets through modals; data saves to this project only.`
              )}
            />
          </div>
        </div>
        <div className="module-hub__workflow border-t border-line bg-sand/80 px-5 sm:px-6 py-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-steel-muted">
          <span>
            <strong className="text-ink font-semibold">1.</strong> Select tool
          </span>
          <span>
            <strong className="text-ink font-semibold">2.</strong> Enter / upload data
          </span>
          <span>
            <strong className="text-ink font-semibold">3.</strong> Review register
          </span>
          <span>
            <strong className="text-ink font-semibold">4.</strong> Export or distribute
          </span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {tools.map((t, i) => {
          const href = !t.to
            ? `/projects/${id}`
            : t.to.startsWith("/")
              ? t.to
              : `/projects/${id}/${t.to}${t.query ? `?${t.query}` : ""}`;
          const ready = t.status === "ready";
          return (
            <Link key={`${t.to}-${t.query || ""}-${t.label}`} to={href} className="module-hub__card group block h-full">
              <div
                className={`h-full rounded-xl border bg-paper p-4 sm:p-5 transition-all hover:shadow-md hover:-translate-y-0.5 ${
                  ready ? "border-dashed border-line opacity-90" : "border-line hover:border-brand/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span
                    className="module-hub__step text-[11px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-md"
                    style={{ background: `${meta.accent}18`, color: meta.accent }}
                  >
                    Step {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={`text-[10px] font-mono uppercase tracking-wide shrink-0 px-2 py-0.5 rounded-full border ${
                      ready ? "text-warn border-warn/30 bg-warn/5" : "text-brand border-brand/25 bg-brand-soft/40"
                    }`}
                  >
                    {ready ? "Placeholder" : t.sheet ? "Sheet-backed" : "Live"}
                  </span>
                </div>
                <div className="font-display text-base font-semibold text-ink group-hover:text-brand leading-snug">
                  {formatUiText(t.label)}
                </div>
                {t.blurb && (
                  <p className="text-sm text-steel-muted mt-2 leading-relaxed line-clamp-3">{formatUiText(t.blurb)}</p>
                )}
                {t.sheet && (
                  <p className="mt-2.5 text-[11px] font-mono text-steel-muted truncate rounded-md bg-sand px-2 py-1" title={t.sheet}>
                    Template: {t.sheet}
                  </p>
                )}
                <div className="mt-4 pt-3 border-t border-line/80 text-sm font-semibold text-brand flex items-center justify-between gap-2">
                  <span>{ready ? "Open placeholder" : "Open tool"}</span>
                  <span aria-hidden className="group-hover:translate-x-0.5 transition-transform">→</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
