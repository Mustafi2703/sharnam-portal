import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { applyThemeOption, THEME_OPTIONS, THEME_STORAGE_KEY } from "../themes";
import { Badge, Button, Card, PageHeader } from "../components/ui";
import { BrandMark } from "../components/Brand";

/** Designed (not photo) preview of every theme option A–H */
export default function ThemeOptionsPage() {
  const [active, setActive] = useState(() => {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) || "a-amber";
    } catch {
      return "a-amber";
    }
  });

  useEffect(() => {
    applyThemeOption(active);
  }, [active]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <PageHeader
        eyebrow="UI directions"
        title="Theme options A–H"
        subtitle="Designed Procore-style previews — no raw photos. Apply a theme to lock CSS tokens across the app."
        actions={
          <Link to="/workspace">
            <Button variant="secondary">Back to workspaces</Button>
          </Link>
        }
      />

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {THEME_OPTIONS.map((t) => {
          const on = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={`text-left rounded-xl border overflow-hidden transition interactive-lift ${
                on ? "selected-ring border-brand" : "border-line bg-white hover:border-brand/40"
              }`}
            >
              <div
                className="h-20 px-4 flex items-end pb-3"
                style={{
                  background: `linear-gradient(135deg, ${t.vars["--color-brand-soft"]}, ${t.vars["--color-sand"]})`,
                  borderBottom: `1px solid ${t.vars["--color-line"]}`,
                }}
              >
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white text-sm font-display"
                  style={{ background: t.vars["--color-brand"] }}
                >
                  {t.letter}
                </span>
              </div>
              <div className="p-4">
                <div className="font-display text-lg">{t.name}</div>
                <p className="text-xs text-steel-muted mt-1 leading-relaxed">{t.blurb}</p>
                <div className="flex gap-1.5 mt-3">
                  {[t.vars["--color-brand"], t.vars["--color-mark"], t.vars["--color-sand"], t.vars["--color-ink"]].map(
                    (c) => (
                      <span key={c} className="h-4 w-4 rounded-sm border border-line" style={{ background: c }} />
                    )
                  )}
                </div>
                <div className="mt-3 text-xs font-semibold" style={{ color: on ? t.vars["--color-brand"] : undefined }}>
                  {on ? "Applied ✓" : "Preview & apply"}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="procore-tool-header px-5 py-3 flex items-center justify-between gap-3 bg-procore-navy text-white">
          <div>
            <div className="text-sm font-semibold">Live chrome preview</div>
            <div className="text-[11px] text-white/70">Tool header · actions · register row</div>
          </div>
          <Badge tone="neutral">Option {THEME_OPTIONS.find((t) => t.id === active)?.letter}</Badge>
        </div>
        <div className="p-5 grid lg:grid-cols-[1fr_220px] gap-4 bg-sand">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button">Upload drawing</Button>
              <Button type="button" variant="secondary">
                Assign checklist
              </Button>
              <Button type="button" variant="ghost">
                Export CSV
              </Button>
            </div>
            <div className="rounded-lg border border-line bg-white overflow-hidden">
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
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-xs font-semibold text-brand">Open · Upload rev</span>
                    </td>
                  </tr>
                  <tr className="border-t border-line hover:bg-brand-soft/20">
                    <td className="px-3 py-2.5 font-mono text-brand text-xs">S-201</td>
                    <td className="px-3 py-2.5">Column schedule</td>
                    <td className="px-3 py-2.5 font-mono text-xs">R0</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-xs font-semibold text-brand">Publish</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="rounded-lg border border-line bg-white p-3 space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-steel-muted">Right panel</div>
            <Button type="button" className="w-full !text-xs">
              Upload drawing
            </Button>
            <Button type="button" variant="secondary" className="w-full !text-xs">
              Final Index forms
            </Button>
            <p className="text-[11px] text-steel-muted leading-relaxed">
              Gate · uploads · engineer fills — Procore-style actions.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <BrandMark size="sm" tagTone="light" />
        <p className="text-xs text-steel-muted">
          Active theme saved to this browser. Modules use designed surfaces — not photo tiles.
        </p>
      </div>
    </div>
  );
}
