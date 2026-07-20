import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import type { AuthUser, RoleKey } from "@sharnam/shared";
import { applyThemeOption, getLiveOption, LIVE_UI_OPTIONS } from "../themes";
import { BrandMark, BRAND_EN, BRAND_HI } from "../components/Brand";
import { Button, Card, Input } from "../components/ui";
import { PORTAL_LOGINS } from "./PortalLogins";

const HUB: (keyof typeof PORTAL_LOGINS)[] = ["office", "site", "vendor", "client"];

/** Per-option themed landing — same portals, different construction UI style */
export default function UiOptionLandingPage() {
  const { optionId } = useParams();
  const opt = getLiveOption(optionId || "1");
  const { user, loading, loginWithToken } = useAuth();
  const [active, setActive] = useState<keyof typeof PORTAL_LOGINS>("office");
  const [email, setEmail] = useState(PORTAL_LOGINS.office.demoEmail);
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

  if (!loading && user) return <Navigate to="/workspace" replace />;

  const cfg = PORTAL_LOGINS[active];

  return (
    <div className="min-h-screen bg-sand text-ink">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandMark size="sm" tagTone="light" showTag={false} />
            <div>
              <div className="font-display text-sm leading-none">{BRAND_EN}</div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-steel-muted mt-0.5">
                UI Option {opt.number} · {opt.name}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            {LIVE_UI_OPTIONS.map((t) => (
              <Link
                key={t.id}
                to={`/ui/${t.number}`}
                className={`shrink-0 h-8 min-w-8 px-2 grid place-items-center text-xs font-semibold border transition ${
                  t.number === opt.number
                    ? "bg-brand text-white border-brand"
                    : "bg-paper border-line text-steel-muted hover:border-brand"
                }`}
                style={{ borderRadius: "var(--ui-radius-sm)" }}
              >
                {t.number}
              </Link>
            ))}
            <Link to="/options" className="text-xs font-medium text-brand whitespace-nowrap ml-1">
              All options
            </Link>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-5 py-10 sm:py-14 grid lg:grid-cols-2 gap-10 items-start">
        <div className="space-y-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-brand">
            {BRAND_HI} · Construction PMC · Option {opt.number}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl tracking-tight leading-[1.05]">{opt.name}</h1>
          <p className="text-steel-muted leading-relaxed max-w-md">{opt.blurb}</p>
          <ul className="grid sm:grid-cols-3 gap-2 text-xs">
            {[
              ["Style", opt.style],
              ["Density", opt.density],
              ["Corners", opt.radius],
            ].map(([k, v]) => (
              <li key={k} className="border border-line bg-paper px-3 py-2" style={{ borderRadius: "var(--ui-radius-sm)" }}>
                <div className="font-mono text-[9px] uppercase text-steel-muted">{k}</div>
                <div className="font-semibold mt-0.5 capitalize">{v}</div>
              </li>
            ))}
          </ul>

          {/* Designed module strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
            {["Drawings", "Checklists", "Revisions", "Day log", "RFIs", "Cost"].map((m) => (
              <div
                key={m}
                className="border border-line bg-paper px-3 py-3"
                style={{ borderRadius: "var(--ui-radius)" }}
              >
                <div className="h-1.5 w-8 mb-2 rounded-full bg-brand" />
                <div className="text-sm font-semibold">{m}</div>
                <div className="text-[11px] text-steel-muted mt-0.5">Procore-style tool</div>
              </div>
            ))}
          </div>
        </div>

        <Card className="!p-0 overflow-hidden ui-panel">
          <div className="px-5 py-3 border-b border-line bg-procore-navy text-white flex justify-between items-center">
            <span className="text-sm font-semibold">Sign in · same portals</span>
            <span className="text-[10px] font-mono text-white/70">Demo@1234</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-line">
            {HUB.map((key) => {
              const p = PORTAL_LOGINS[key];
              const on = active === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActive(key)}
                  className={`text-left p-3 transition ${on ? "bg-brand-soft" : "bg-paper hover:bg-sand"}`}
                >
                  <div className="text-[10px] font-mono uppercase text-steel-muted">{p.shortLabel}</div>
                  <div className={`text-sm font-semibold mt-0.5 ${on ? "text-brand" : ""}`}>{p.title}</div>
                </button>
              );
            })}
          </div>
          <form
            className="p-5 space-y-3 bg-paper"
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
                loginWithToken(data.token, data.user);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Login failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="text-sm text-steel-muted">{cfg.subtitle}</p>
            <label className="block text-sm">
              <span className="text-xs font-mono uppercase text-steel-muted">Email</span>
              <Input className="mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-mono uppercase text-steel-muted">Password</span>
              <Input
                type="password"
                className="mt-1"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full !py-3">
              {busy ? "Signing in…" : cfg.cta}
            </Button>
            <p className="text-center text-[11px] font-mono text-steel-muted">
              Or{" "}
              <Link to={`/login/${cfg.key}`} className="text-brand font-semibold">
                full {cfg.shortLabel} page
              </Link>
            </p>
          </form>
        </Card>
      </section>
    </div>
  );
}
