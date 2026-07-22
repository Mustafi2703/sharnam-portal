import { useEffect } from "react";
import { Link } from "react-router-dom";
import { applyThemeOption, LIVE_UI_OPTIONS, type ThemeOption } from "../themes";
import { BrandMark, BRAND_EN, BRAND_HI, BRAND_TAG } from "../components/Brand";
import { Button } from "../components/ui";

function StylePreview({ opt }: { opt: ThemeOption }) {
  return (
    <div
      className="h-full flex flex-col overflow-hidden border"
      style={{
        borderColor: opt.vars["--color-line"],
        background: opt.vars["--color-sand"],
        borderRadius: opt.vars["--ui-radius"],
        color: opt.vars["--color-ink"],
        fontFamily: opt.vars["--font-sans"],
      }}
    >
      <div
        className="flex items-center justify-between gap-2 px-3 h-11 text-[11px] font-medium"
        style={{ background: opt.vars["--color-procore-navy"], color: "#fff" }}
      >
        <span style={{ fontFamily: opt.vars["--font-display"] }}>Sharnam · {opt.number}</span>
        <span
          className="px-2.5 py-1 text-[10px] font-semibold"
          style={{ background: opt.vars["--color-brand"], borderRadius: opt.vars["--ui-radius-sm"] }}
        >
          Upload
        </span>
      </div>
      <div className="grid grid-cols-[64px_1fr_80px] flex-1 min-h-[150px]">
        <div className="border-r p-2 space-y-1.5" style={{ borderColor: opt.vars["--color-line"], background: opt.vars["--color-paper"] }}>
          {["Home", "GFC", "QA", "Field"].map((t, i) => (
            <div
              key={t}
              className="text-[10px] px-2 py-1.5"
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
        <div className="p-2.5 space-y-2">
          <div className="text-[11px] font-semibold" style={{ fontFamily: opt.vars["--font-display"] }}>
            Drawing register
          </div>
          {[1, 2, 3].map((r) => (
            <div
              key={r}
              className="flex justify-between text-[10px] px-2.5 py-2 border"
              style={{
                borderColor: opt.vars["--color-line"],
                background: opt.vars["--color-paper"],
                borderRadius: opt.vars["--ui-radius-sm"],
              }}
            >
              <span className="font-mono" style={{ color: opt.vars["--color-mark"] }}>
                A-10{r}
              </span>
              <span style={{ color: opt.vars["--color-brand"] }}>R{r - 1}</span>
            </div>
          ))}
        </div>
        <div className="border-l p-2 space-y-1.5" style={{ borderColor: opt.vars["--color-line"], background: opt.vars["--color-paper"] }}>
          <div className="text-[9px] uppercase tracking-wider opacity-55">Actions</div>
          {["Drawing", "Rev"].map((a) => (
            <div
              key={a}
              className="text-[9px] text-center py-1.5 font-semibold text-white"
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

/** Public hub — five clean PMC UI systems */
export default function UiOptionsHubPage() {
  useEffect(() => {
    /* hub uses page sand; themes apply on option open */
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F2EE] text-ink">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-line">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-3">
          <BrandMark size="sm" tagTone="light" />
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-steel-muted hover:text-brand font-semibold">
              Four portals
            </Link>
            <Link to="/ui/1">
              <Button className="!text-sm !py-2.5">Enter Site Amber</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="hero-site text-white">
        <div className="max-w-6xl mx-auto px-5 py-16 sm:py-24">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/70 mb-4">
            {BRAND_HI} · {BRAND_TAG}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-tight max-w-2xl leading-[1.05]">
            Construction PMC software that looks like the site office.
          </h1>
          <p className="mt-5 text-base sm:text-lg text-white/85 max-w-xl leading-relaxed">
            Five designed UI systems — same drawings, RFIs, diary, matrix, and client packs underneath. Pick a style,
            then sign in to Office, Site, Vendor, or Client.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/login">
              <Button className="!text-sm !py-3 !px-5">Open portal logins</Button>
            </Link>
            <Link to="/ui/2">
              <Button variant="secondary" className="!text-sm !py-3 !px-5 !bg-white/10 !text-white !border-white/30">
                Try Graphite
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-5 py-14 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-brand mb-2">UI systems 1–5</p>
            <h2 className="font-display text-3xl tracking-tight">Clean chrome. Spacious tools.</h2>
          </div>
          <p className="text-sm text-steel-muted max-w-sm">No cluttered cards — each option is a full theme for the same Sharnam portal.</p>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {LIVE_UI_OPTIONS.map((opt, i) => (
            <Link
              key={opt.id}
              to={`/ui/${opt.number}`}
              onClick={() => applyThemeOption(opt.id)}
              className={`group block border border-line bg-white overflow-hidden hover:border-brand/40 hover:shadow-lg transition rise rise-delay-${Math.min(i, 4)}`}
              style={{ borderRadius: "12px" }}
            >
              <div className="p-4 h-[210px] bg-[#fafafa]">
                <StylePreview opt={opt} />
              </div>
              <div className="px-5 pb-5 pt-2 border-t border-line">
                <div className="flex items-center gap-3">
                  <span
                    className="h-9 w-9 grid place-items-center text-white text-sm font-display"
                    style={{ background: opt.vars["--color-brand"], borderRadius: opt.vars["--ui-radius-sm"] }}
                  >
                    {opt.number}
                  </span>
                  <div>
                    <div className="font-display text-lg leading-tight">{opt.name}</div>
                    <div className="text-xs text-steel-muted mt-0.5">
                      {opt.style} · {opt.density}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-steel-muted mt-3 leading-relaxed">{opt.blurb}</p>
                <div className="mt-3 text-sm font-semibold text-brand group-hover:underline">Open landing →</div>
              </div>
            </Link>
          ))}
        </div>

        <p className="mt-14 text-xs text-steel-muted">
          © {BRAND_EN} · Demo password Demo@1234 · office@ / site@ / vendor@ / client@sharnam.demo
        </p>
      </main>
    </div>
  );
}
