import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import type { AuthUser, RoleKey } from "@sharnam/shared";
import { applyThemeOption, getLiveOption, LIVE_UI_OPTIONS } from "../themes";
import { BrandMark, BRAND_EN, BRAND_HI } from "../components/Brand";
import { Button, Card, Input } from "../components/ui";
import { PORTAL_LOGINS, LOGIN_LANDING_KEY, consumeLoginLanding } from "./PortalLogins";
import { setActiveWorkspace } from "../workspaces";

const HUB: (keyof typeof PORTAL_LOGINS)[] = ["master", "drawings", "quality", "comms", "field", "client"];

/** Professional themed landing — module logins + style switcher */
export default function UiOptionLandingPage() {
  const { optionId } = useParams();
  const opt = getLiveOption(optionId || "1");
  const { user, loading, loginWithToken } = useAuth();
  const [active, setActive] = useState<keyof typeof PORTAL_LOGINS>("master");
  const [email, setEmail] = useState(PORTAL_LOGINS.master.demoEmail);
  const [password, setPassword] = useState("Demo@1234");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    applyThemeOption(opt.id);
  }, [opt.id]);

  useEffect(() => {
    setEmail(PORTAL_LOGINS[active].demoEmail);
    setError("");
  }, [active]);

  if (!loading && user) return <Navigate to={consumeLoginLanding()} replace />;

  const cfg = PORTAL_LOGINS[active];

  return (
    <div className="min-h-screen bg-sand text-ink">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <BrandMark size="sm" tagTone="light" showTag={false} />
            <div className="min-w-0">
              <div className="font-display text-[15px] leading-none truncate">{BRAND_EN}</div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-steel-muted mt-1">
                Option {opt.number} · {opt.name}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {LIVE_UI_OPTIONS.map((t) => (
              <Link
                key={t.id}
                to={`/ui/${t.number}`}
                className={`shrink-0 h-9 min-w-9 px-2.5 grid place-items-center text-sm font-semibold border transition ${
                  t.number === opt.number
                    ? "bg-brand text-white border-brand"
                    : "bg-paper border-line text-steel-muted hover:border-brand"
                }`}
                style={{ borderRadius: "var(--ui-radius-sm)" }}
              >
                {t.number}
              </Link>
            ))}
            <Link to="/options" className="text-sm font-semibold text-brand whitespace-nowrap ml-2">
              All styles
            </Link>
          </div>
        </div>
      </header>

      <section className="hero-field text-white">
        <div className="max-w-6xl mx-auto px-5 py-12 sm:py-16">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/70 mb-3">
            {BRAND_HI} · PMC desk · Option {opt.number}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl tracking-tight leading-[1.05] max-w-xl">{opt.name}</h1>
          <p className="mt-4 text-base text-white/85 max-w-lg leading-relaxed">{opt.blurb}</p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 py-10 sm:py-14 grid lg:grid-cols-[1fr_420px] gap-10 items-start">
        <div className="space-y-8">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-brand mb-2">Module logins</p>
            <h2 className="font-display text-2xl sm:text-3xl tracking-tight">Master · Drawings · Quality · Comms · Field</h2>
            <p className="mt-3 text-steel-muted max-w-lg leading-relaxed">
              Finalize this UI, then sign into the module you manage. Checklist fills need Drawing or QI RFIs; PMC also raises classic Requests for Information.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {HUB.map((key, i) => {
              const p = PORTAL_LOGINS[key];
              const on = active === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActive(key)}
                  className={`portal-tile text-left p-5 rise rise-delay-${i} ${on ? "selected-ring border-brand" : ""}`}
                >
                  <div
                    className="h-10 w-10 grid place-items-center text-white text-xs font-bold mb-3"
                    style={{ background: p.tone, borderRadius: "var(--ui-radius-sm)" }}
                  >
                    {p.icon}
                  </div>
                  <div className="font-display text-lg">{p.title}</div>
                  <p className="text-sm text-steel-muted mt-1.5 leading-relaxed">{p.subtitle}</p>
                  <ul className="mt-3 space-y-1">
                    {p.points.map((pt) => (
                      <li key={pt} className="text-xs text-ink/80 flex gap-2">
                        <span className="text-brand">▸</span> {pt}
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {["GFC + revisions", "RFI + checklist", "Day log", "Comms matrix", "Submittals", "DPR / WPR"].map((m) => (
              <div key={m} className="border border-line bg-paper px-4 py-4" style={{ borderRadius: "var(--ui-radius)" }}>
                <div className="h-1 w-10 mb-3 rounded-full bg-brand" />
                <div className="text-sm font-semibold">{m}</div>
              </div>
            ))}
          </div>
        </div>

        <Card className="!p-0 overflow-hidden sticky top-24">
          <div className="px-5 py-4 border-b border-line bg-procore-navy text-white">
            <div className="text-sm font-semibold">Sign in · {cfg.title}</div>
            <div className="text-[11px] text-white/65 mt-1 font-mono">Password Demo@1234</div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-line">
            {HUB.map((key) => {
              const p = PORTAL_LOGINS[key];
              const on = active === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActive(key)}
                  className={`text-center py-3 text-[10px] sm:text-xs font-semibold transition ${on ? "bg-brand text-white" : "bg-paper hover:bg-sand"}`}
                >
                  {p.shortLabel}
                </button>
              );
            })}
          </div>
          <form
            className="p-6 space-y-4 bg-paper"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                const data = await api<{ token: string; user: AuthUser }>("/api/auth/login", {
                  method: "POST",
                  body: JSON.stringify({
                    email,
                    password,
                    allowedRoles: cfg.allowedRoles as RoleKey[],
                    portal: cfg.key,
                  }),
                });
                try {
                  localStorage.setItem(LOGIN_LANDING_KEY, cfg.landingPath || "/workspace");
                  if (cfg.workspaceKey) setActiveWorkspace(cfg.workspaceKey);
                  else setActiveWorkspace(null);
                } catch {
                  /* ignore */
                }
                loginWithToken(data.token, data.user);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Login failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="text-sm text-steel-muted leading-relaxed">{cfg.headline}</p>
            <label className="block text-sm">
              <span className="text-xs font-mono uppercase text-steel-muted">Email</span>
              <Input className="mt-1.5 !py-2.5" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-mono uppercase text-steel-muted">Password</span>
              <Input
                type="password"
                className="mt-1.5 !py-2.5"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full !py-3 !text-sm">
              {busy ? "Signing in…" : cfg.cta}
            </Button>
          </form>
        </Card>
      </section>
    </div>
  );
}
