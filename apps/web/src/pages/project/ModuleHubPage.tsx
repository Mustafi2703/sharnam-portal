import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../../components/ui";
import { MODULE_TOOLS, MODULE_META, type WorkspaceKey } from "../../workspaces";
import { useAuth } from "../../auth";

/** Module opening — themed hero + colored tool cards meshed with module accent */
export default function ModuleHubPage({ moduleKey }: { moduleKey: WorkspaceKey }) {
  const { id } = useParams();
  const { user } = useAuth();
  const meta = MODULE_META[moduleKey];
  const tools = (MODULE_TOOLS[moduleKey] || []).filter(
    (t) => !t.roles || !user?.role || t.roles.includes(user.role as any)
  );

  return (
    <div className="space-y-8 module-hub" style={{ ["--mod-accent" as string]: meta.accent, ["--mod-soft" as string]: meta.soft, ["--mod-glow" as string]: meta.glow, ["--mod-ink" as string]: meta.ink }}>
      <div className="module-hub__hero rounded-[var(--ui-radius,14px)] border border-line overflow-hidden">
        <div className="module-hub__hero-wash" />
        <div className="relative p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span
              className="module-hub__badge h-12 w-12 rounded-xl grid place-items-center text-white text-sm font-display shrink-0 shadow-lg"
              style={{ background: meta.accent, boxShadow: `0 12px 28px ${meta.glow}` }}
            >
              {meta.icon}
            </span>
            <div className="min-w-0 flex-1">
              <PageHeader eyebrow={`${meta.title} module`} title={meta.title} subtitle={meta.desc} />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {tools.slice(0, 6).map((t) => (
              <span
                key={`${t.to}-${t.label}`}
                className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ background: meta.soft, color: meta.ink }}
              >
                {t.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {tools.map((t, i) => {
          const href = t.to
            ? `/projects/${id}/${t.to}${t.query ? `?${t.query}` : ""}`
            : `/projects/${id}`;
          const tint = i % 3 === 0 ? meta.accent : i % 3 === 1 ? meta.ink : "#C45C26";
          return (
            <Link key={`${t.to}-${t.query || ""}-${t.label}`} to={href} className="block group">
              <div
                className="module-tool-card h-full overflow-hidden rounded-[var(--ui-radius,14px)] border border-line bg-paper transition group-hover:-translate-y-0.5"
                style={{ ["--tool-accent" as string]: tint, boxShadow: "0 1px 0 color-mix(in srgb, var(--tool-accent) 12%, transparent)" }}
              >
                <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${tint}, ${meta.accent})` }} />
                <div className="p-5 sm:p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="h-8 w-8 rounded-lg grid place-items-center text-[10px] font-display text-white shrink-0"
                      style={{ background: tint }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-steel-muted">
                      Tool
                    </div>
                  </div>
                  <div
                    className="font-display text-lg font-semibold text-ink transition"
                    style={{ ["--hover" as string]: meta.accent }}
                  >
                    <span className="group-hover:text-[var(--mod-ink)]">{t.label}</span>
                  </div>
                  {t.blurb && <p className="text-sm text-steel-muted mt-2 leading-relaxed">{t.blurb}</p>}
                  <div className="mt-5 text-sm font-semibold" style={{ color: meta.accent }}>
                    Open →
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
