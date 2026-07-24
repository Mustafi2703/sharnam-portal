import { Link, useParams } from "react-router-dom";
import { Card, PageHeader } from "../../components/ui";
import { MODULE_TOOLS, MODULE_META, type WorkspaceKey } from "../../workspaces";
import { useAuth } from "../../auth";

/** Short module opening — purpose + cards into each sub-tool (from module_prompts) */
export default function ModuleHubPage({ moduleKey }: { moduleKey: WorkspaceKey }) {
  const { id } = useParams();
  const { user } = useAuth();
  const meta = MODULE_META[moduleKey];
  const tools = (MODULE_TOOLS[moduleKey] || []).filter(
    (t) => !t.roles || !user?.role || t.roles.includes(user.role as any)
  );

  return (
    <div className="space-y-8">
      <div className="rounded-[var(--ui-radius,14px)] border border-line bg-paper overflow-hidden">
        <div className="h-1.5 w-full" style={{ background: meta.accent }} />
        <div className="p-6 sm:p-8">
          <PageHeader eyebrow={`${meta.title} module`} title={meta.title} subtitle={meta.desc} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {tools.map((t, i) => {
          const href = t.to
            ? `/projects/${id}/${t.to}${t.query ? `?${t.query}` : ""}`
            : `/projects/${id}`;
          const stripe = i % 3 === 0 ? "var(--color-brand)" : i % 3 === 1 ? "var(--color-mark)" : "var(--color-warn)";
          return (
            <Link key={`${t.to}-${t.query || ""}-${t.label}`} to={href} className="block group">
              <Card className="h-full !p-0 overflow-hidden hover:border-brand/40 transition shadow-sm group-hover:shadow-md">
                <div className="h-1 w-full" style={{ background: stripe }} />
                <div className="p-5 sm:p-6">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-steel-muted mb-2">
                    Tool
                  </div>
                  <div className="font-display text-lg font-semibold text-ink group-hover:text-brand transition">
                    {t.label}
                  </div>
                  {t.blurb && <p className="text-sm text-steel-muted mt-2 leading-relaxed">{t.blurb}</p>}
                  <div className="mt-5 text-sm font-semibold text-brand">Open →</div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
