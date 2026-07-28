import { Link } from "react-router-dom";
import { applyColorMode, getColorMode, type ColorMode } from "../themes";
import { BrandLockup } from "../components/Brand";
import { IconMoon, IconSun } from "../components/icons";

const MODES: { key: ColorMode; title: string; blurb: string }[] = [
  {
    key: "light",
    title: "Light",
    blurb: "Bright surfaces, teal accents — best for daytime office use.",
  },
  {
    key: "dark",
    title: "Dark",
    blurb: "Deep charcoal chrome with teal highlights — easier on night shifts.",
  },
];

export function ThemeOptionsPage() {
  const current = getColorMode();

  return (
    <div className="min-h-screen bg-sand px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <BrandLockup />
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-brand font-semibold">Appearance</p>
          <h1 className="font-display text-3xl text-ink mt-1">Light & dark mode</h1>
          <p className="text-sm text-steel-muted mt-2 max-w-xl">
            Toggle anytime from the top bar or login panel. Your choice is saved on this device.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {MODES.map((m) => {
            const on = current === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => applyColorMode(m.key)}
                className={`text-left rounded-2xl border p-5 transition ${
                  on ? "border-brand bg-brand-soft shadow-sm" : "border-line bg-surface hover:border-brand/40"
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-sand text-brand border border-line">
                    {m.key === "light" ? <IconSun size={20} /> : <IconMoon size={20} />}
                  </span>
                  <div>
                    <p className="font-semibold text-ink">{m.title}</p>
                    {on ? <p className="text-xs text-brand font-semibold">Active</p> : null}
                  </div>
                </div>
                <p className="text-sm text-steel-muted leading-relaxed">{m.blurb}</p>
              </button>
            );
          })}
        </div>

        <Link to="/login" className="inline-flex text-sm font-semibold text-brand hover:underline">
          ← Back to login
        </Link>
      </div>
    </div>
  );
}
