import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../../components/ui";
import { MODULE_TOOLS, MODULE_META, type WorkspaceKey } from "../../workspaces";
import { useAuth } from "../../auth";

/** Module hub — one card per sheet-backed tool (live or ready for sheet drop) */
export default function ModuleHubPage({ moduleKey }: { moduleKey: WorkspaceKey }) {
  const { id } = useParams();
  const { user } = useAuth();
  const meta = MODULE_META[moduleKey];
  const tools = (MODULE_TOOLS[moduleKey] || []).filter(
    (t) => !t.roles || !user?.role || t.roles.includes(user.role as any)
  );

  return (
    <div className="space-y-6">
      <div className="border border-line bg-paper rounded-[var(--ui-radius)] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span
            className="h-10 w-10 rounded-lg grid place-items-center text-white text-sm font-display shrink-0"
            style={{ background: meta.accent }}
          >
            {meta.icon}
          </span>
          <div className="min-w-0 flex-1">
            <PageHeader
              eyebrow={`${meta.title} module`}
              title={meta.title}
              subtitle={`${meta.desc} Each card is a separate tool. Ready cards wait for the next client sheet.`}
            />
          </div>
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
            <Link key={`${t.to}-${t.query || ""}-${t.label}`} to={href} className="block group">
              <div
                className={`h-full rounded-[var(--ui-radius)] border bg-paper p-4 sm:p-5 transition hover:border-brand ${
                  ready ? "border-dashed border-line" : "border-line"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-steel-muted">
                    {String(i + 1).padStart(2, "0")} · Tool
                  </div>
                  <span
                    className={`text-[10px] font-mono uppercase tracking-wide shrink-0 ${
                      ready ? "text-warn" : "text-brand"
                    }`}
                  >
                    {ready ? "Ready" : t.sheet ? "Sheet" : "Live"}
                  </span>
                </div>
                <div className="font-display text-base font-semibold text-ink group-hover:text-brand">{t.label}</div>
                {t.blurb && <p className="text-sm text-steel-muted mt-1.5 leading-relaxed">{t.blurb}</p>}
                {t.sheet && (
                  <p className="mt-2 text-[11px] font-mono text-steel-muted truncate" title={t.sheet}>
                    ← {t.sheet}
                  </p>
                )}
                <div className="mt-4 text-sm font-semibold text-brand">{ready ? "Open placeholder →" : "Open →"}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
