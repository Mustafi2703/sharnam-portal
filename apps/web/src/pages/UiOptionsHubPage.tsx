import { useEffect } from "react";
import { Link } from "react-router-dom";
import { applyThemeOption, LIVE_UI_OPTIONS, type ThemeOption } from "../themes";
import { BrandMark, BRAND_EN, BRAND_HI, BRAND_TAG } from "../components/Brand";
import { Button } from "../components/ui";

/** Designed chrome preview — no photos */
function StylePreview({ opt }: { opt: ThemeOption }) {
  return (
    <div
      className="h-full flex flex-col overflow-hidden border"
      style={{
        borderColor: opt.vars["--color-line"],
        background: opt.vars["--color-sand"],
        borderRadius: opt.vars["--ui-radius"],
        color: opt.vars["--color-ink"],
      }}
    >
      <div
        className="flex items-center justify-between gap-2 px-3 h-10 text-[11px] font-medium"
        style={{ background: opt.vars["--color-procore-navy"], color: "#fff" }}
      >
        <span>Sharnam · Option {opt.number}</span>
        <span
          className="px-2 py-0.5 text-[10px] font-semibold"
          style={{
            background: opt.vars["--color-brand"],
            borderRadius: opt.vars["--ui-radius-sm"],
          }}
        >
          Upload drawing
        </span>
      </div>
      <div className="grid grid-cols-[56px_1fr_72px] flex-1 min-h-[140px]">
        <div className="border-r p-1.5 space-y-1" style={{ borderColor: opt.vars["--color-line"], background: opt.vars["--color-paper"] }}>
          {["Home", "DWG", "QA", "Field"].map((t, i) => (
            <div
              key={t}
              className="text-[9px] px-1.5 py-1"
              style={{
                background: i === 1 ? opt.vars["--color-brand-soft"] : "transparent",
                color: i === 1 ? opt.vars["--color-brand"] : opt.vars["--color-ink"],
                borderRadius: opt.vars["--ui-radius-sm"],
                fontWeight: i === 1 ? 700 : 500,
              }}
            >
              {t}
            </div>
          ))}
        </div>
        <div className="p-2 space-y-1.5">
          <div className="text-[10px] font-semibold" style={{ fontFamily: opt.vars["--font-display"] }}>
            GFC register
          </div>
          {[1, 2, 3].map((r) => (
            <div
              key={r}
              className="flex justify-between text-[9px] px-2 py-1.5 border"
              style={{
                borderColor: opt.vars["--color-line"],
                background: opt.vars["--color-paper"],
                borderRadius: opt.vars["--ui-radius-sm"],
              }}
            >
              <span className="font-mono" style={{ color: opt.vars["--color-brand"] }}>
                A-10{r}
              </span>
              <span style={{ color: opt.vars["--color-mark"] }}>R{r - 1}</span>
            </div>
          ))}
        </div>
        <div className="border-l p-1.5 space-y-1" style={{ borderColor: opt.vars["--color-line"], background: opt.vars["--color-paper"] }}>
          <div className="text-[8px] uppercase tracking-wider opacity-60">Actions</div>
          {["Drawing", "Rev", "Checklist"].map((a) => (
            <div
              key={a}
              className="text-[8px] text-center py-1 font-semibold text-white"
              style={{ background: opt.vars["--color-brand"], borderRadius: opt.vars["--ui-radius-sm"] }}
            >
              {a}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Public hub — pick UI system 1–5 (same portals underneath) */
export default function UiOptionsHubPage() {
  useEffect(() => {
    /* leave saved theme; hub itself uses default sand from CSS */
  }, []);

  return (
    <div className="min-h-screen bg-[#f7f4f0] text-ink">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-line">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between gap-3">
          <BrandMark size="sm" tagTone="light" />
          <div className="flex items-center gap-2">
            <Link to="/login" className="text-sm text-steel-muted hover:text-brand font-medium">
              Portal login
            </Link>
            <Link to="/ui/1">
              <Button className="!text-xs !py-2">Enter Option 1</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-12 sm:py-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-brand mb-3">
          {BRAND_HI} · Live on Render
        </p>
        <h1 className="font-display text-4xl sm:text-5xl tracking-tight max-w-2xl leading-[1.05]">
          Five construction UI systems. Same Sharnam portal.
        </h1>
        <p className="mt-4 text-steel-muted max-w-xl leading-relaxed">
          Options <strong>1–5</strong> are complete React themes — different colors, radius, density, and chrome style.
          No stock photos. Pick one to open its landing, then sign in to Office / Site / Vendor / Client.
        </p>

        <div className="mt-10 grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {LIVE_UI_OPTIONS.map((opt) => (
            <Link
              key={opt.id}
              to={`/ui/${opt.number}`}
              onClick={() => applyThemeOption(opt.id)}
              className="group block rounded-2xl border border-line bg-white overflow-hidden hover:border-brand/50 hover:shadow-lg transition"
            >
              <div className="p-3 h-[200px]">
                <StylePreview opt={opt} />
              </div>
              <div className="px-5 pb-5 pt-1 border-t border-line">
                <div className="flex items-center gap-2">
                  <span
                    className="h-7 w-7 grid place-items-center text-white text-xs font-display rounded-md"
                    style={{ background: opt.vars["--color-brand"] }}
                  >
                    {opt.number}
                  </span>
                  <div>
                    <div className="font-display text-lg">{opt.name}</div>
                    <div className="text-[11px] text-steel-muted">
                      {opt.style} · {opt.density} · {opt.radius}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-steel-muted mt-2 leading-relaxed">{opt.blurb}</p>
                <div className="mt-3 text-sm font-semibold text-brand group-hover:underline">
                  Open Option {opt.number} landing →
                </div>
              </div>
            </Link>
          ))}
        </div>

        <p className="mt-12 text-xs text-steel-muted">
          © {BRAND_EN} · {BRAND_TAG} · Demo password Demo@1234
        </p>
      </main>
    </div>
  );
}
