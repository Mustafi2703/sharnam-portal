import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { applyThemeOption, LIVE_UI_OPTIONS, THEME_STORAGE_KEY } from "../themes";
import { Badge, Button, Card, PageHeader } from "../components/ui";
import { BrandMark } from "../components/Brand";

/** In-app picker for live UI systems 1–5 */
export default function ThemeOptionsPage() {
  const [active, setActive] = useState(() => {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) || "ui-1";
    } catch {
      return "ui-1";
    }
  });

  useEffect(() => {
    applyThemeOption(active);
  }, [active]);

  const current = LIVE_UI_OPTIONS.find((t) => t.id === active) || LIVE_UI_OPTIONS[0];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <PageHeader
        eyebrow="UI systems"
        title="Options 1–5"
        subtitle="Five construction styles — colors, density, and corner radius. Same portals and tools underneath."
        actions={
          <div className="flex gap-2">
            <Link to={`/ui/${current.number}`}>
              <Button variant="secondary">Open public landing</Button>
            </Link>
            <Link to="/workspace">
              <Button>Workspaces</Button>
            </Link>
          </div>
        }
      />

      <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {LIVE_UI_OPTIONS.map((t) => {
          const on = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={`text-left border overflow-hidden transition interactive-lift ${
                on ? "selected-ring border-brand" : "border-line bg-paper hover:border-brand/40"
              }`}
              style={{ borderRadius: "var(--ui-radius, 12px)" }}
            >
              <div
                className="h-16 px-3 flex items-end pb-2"
                style={{
                  background: `linear-gradient(135deg, ${t.vars["--color-brand-soft"]}, ${t.vars["--color-sand"]})`,
                  borderBottom: `1px solid ${t.vars["--color-line"]}`,
                }}
              >
                <span
                  className="inline-flex h-8 w-8 items-center justify-center text-white text-sm font-display"
                  style={{ background: t.vars["--color-brand"], borderRadius: t.vars["--ui-radius-sm"] }}
                >
                  {t.number}
                </span>
              </div>
              <div className="p-3">
                <div className="font-display text-base">{t.name}</div>
                <p className="text-[11px] text-steel-muted mt-1 leading-relaxed">{t.blurb}</p>
                <div className="mt-2 text-xs font-semibold" style={{ color: on ? t.vars["--color-brand"] : undefined }}>
                  {on ? "Applied ✓" : "Apply"}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="procore-tool-header px-5 py-3 flex items-center justify-between gap-3 bg-procore-navy text-white">
          <div>
            <div className="text-sm font-semibold">Live chrome · Option {current.number}</div>
            <div className="text-[11px] text-white/70">{current.style} · {current.density} · {current.radius}</div>
          </div>
          <Badge tone="neutral">{current.name}</Badge>
        </div>
        <div className="p-5 grid lg:grid-cols-[1fr_220px] gap-4 bg-sand">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button">Upload drawing</Button>
              <Button type="button" variant="secondary">
                Upload revision
              </Button>
              <Button type="button" variant="secondary">
                Assign checklist
              </Button>
            </div>
            <div className="border border-line bg-paper overflow-hidden" style={{ borderRadius: "var(--ui-radius)" }}>
              <table className="w-full text-sm">
                <thead className="bg-brand-soft/60 text-[10px] uppercase tracking-wide text-steel-muted text-left">
                  <tr>
                    <th className="px-3 py-2">DWG</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Rev</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-line">
                    <td className="px-3 py-2.5 font-mono text-brand text-xs">A-101</td>
                    <td className="px-3 py-2.5">Ground floor plan</td>
                    <td className="px-3 py-2.5 font-mono text-xs">R2</td>
                    <td className="px-3 py-2.5 text-right text-xs font-semibold text-brand">Open · Upload rev</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="border border-line bg-paper p-3 space-y-2" style={{ borderRadius: "var(--ui-radius)" }}>
            <div className="text-[10px] font-mono uppercase tracking-wider text-steel-muted">Right panel</div>
            <Button type="button" className="w-full !text-xs">
              Upload drawing
            </Button>
            <Button type="button" variant="secondary" className="w-full !text-xs">
              Upload revision
            </Button>
            <Button type="button" variant="secondary" className="w-full !text-xs">
              Assign checklist
            </Button>
          </div>
        </div>
      </Card>

      <BrandMark size="sm" tagTone="light" />
    </div>
  );
}
