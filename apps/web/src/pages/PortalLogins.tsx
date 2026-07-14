import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import type { AuthUser, RoleKey } from "@sharnam/shared";
import { Badge, Button, Card, Input } from "../components/ui";
import { BrandLink, BrandMark } from "../components/Brand";

type PortalConfig = {
  key: string;
  title: string;
  headline: string;
  subtitle: string;
  demoEmail: string;
  allowedRoles: RoleKey[];
  panelClass: string;
  points: string[];
  cta: string;
};

export const PORTAL_LOGINS: Record<string, PortalConfig> = {
  client: {
    key: "client",
    title: "Client portal",
    headline: "Project clarity for owners & clients.",
    subtitle: "Approved checklists, diaries, and weekly reports — without site clutter.",
    demoEmail: "client@sharnam.demo",
    allowedRoles: ["client"],
    panelClass: "from-[#0a1212] to-[#0d6365]",
    points: ["Published drawings visibility", "Approved QA trail", "Weekly report pack"],
    cta: "Enter client portal",
  },
  site: {
    key: "site",
    title: "Site employee portal",
    headline: "Built for the field.",
    subtitle: "Daily diary and gated checklists once drawings are published.",
    demoEmail: "site@sharnam.demo",
    allowedRoles: ["site_employee"],
    panelClass: "from-[#0a0c0c] to-[#128a8c]",
    points: ["Upload drawings / revisions", "Drawing-gated checklists", "Daily diary"],
    cta: "Enter site portal",
  },
  employee: {
    key: "employee",
    title: "Employee portal",
    headline: "Your workday workspace.",
    subtitle: "Projects, coordination, and self-service for staff.",
    demoEmail: "employee@sharnam.demo",
    allowedRoles: ["employee", "office"],
    panelClass: "from-[#0d6365] to-[#0a0c0c]",
    points: ["Project modules", "Communications", "HR self-service"],
    cta: "Enter employee portal",
  },
  office: {
    key: "office",
    title: "Office portal",
    headline: "Run the project spine.",
    subtitle: "Publish drawings, review QA, track cost, and communicate.",
    demoEmail: "office@sharnam.demo",
    allowedRoles: ["office", "admin"],
    panelClass: "from-[#128a8c] to-[#0a0c0c]",
    points: ["Drawing publish", "Checklist review", "Cost & BOQ"],
    cta: "Enter office portal",
  },
  vendor: {
    key: "vendor",
    title: "Vendor portal",
    headline: "Trade partner workspace.",
    subtitle: "Assigned projects only — dual checklists, RFI responses, and site diary fills.",
    demoEmail: "vendor@sharnam.demo",
    allowedRoles: ["vendor"],
    panelClass: "from-[#1a3030] to-[#0a0c0c]",
    points: ["Assigned projects", "Upload drawing revisions", "Dual checklist fills"],
    cta: "Enter vendor portal",
  },
};

export function PortalLoginPage({ portalKey }: { portalKey: keyof typeof PORTAL_LOGINS }) {
  const cfg = PORTAL_LOGINS[portalKey];
  const { user, loading, loginWithToken } = useAuth();
  const [email, setEmail] = useState(cfg.demoEmail);
  const [password, setPassword] = useState("Demo@1234");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/workspace" replace />;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <section
        className={`relative hidden lg:flex flex-col justify-between p-12 text-white overflow-hidden bg-gradient-to-br ${cfg.panelClass}`}
      >
        <div className="absolute inset-0 blueprint-grid opacity-60" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(78,195,224,0.25),transparent_50%)]" />
        <div className="relative z-10">
          <BrandLink to="/login" tagTone="dark" />
          <Link to="/login" className="inline-block mt-8 text-sm text-white/80 hover:text-white underline-offset-4 hover:underline">
            ← All portals
          </Link>
          <div className="mt-8 inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            {cfg.title}
          </div>
          <h1 className="font-display text-5xl xl:text-[3.4rem] mt-5 leading-[1.05] max-w-lg text-white drop-shadow-sm">
            {cfg.headline}
          </h1>
          <p className="mt-5 text-base xl:text-lg text-white/90 max-w-md leading-relaxed">{cfg.subtitle}</p>
        </div>
        <ul className="relative z-10 space-y-2.5 max-w-md">
          {cfg.points.map((p, i) => (
            <li
              key={p}
              className="flex gap-3 rounded-2xl border border-white/20 bg-black/25 backdrop-blur-md px-4 py-3.5 text-sm text-white shadow-lg"
            >
              <span className="font-mono text-brand-glow text-xs mt-0.5">0{i + 1}</span>
              {p}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10 bg-sand">
        <div className="w-full max-w-md rise">
          <div className="lg:hidden mb-8 space-y-4">
            <BrandMark size="lg" tagTone="light" />
            <Link to="/login" className="text-sm text-brand font-medium">
              ← All portals
            </Link>
          </div>
          <h2 className="font-display text-4xl text-ink tracking-tight">Sign in</h2>
          <p className="text-steel-muted mt-2 mb-6 text-sm leading-relaxed">{cfg.subtitle}</p>

          <Card className="!shadow-xl !shadow-steel/10">
            <form
              className="space-y-4"
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
                      allowedRoles: cfg.allowedRoles,
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
              <label className="block text-sm">
                <span className="text-steel-muted text-xs font-mono uppercase tracking-wider">Email</span>
                <Input className="mt-1.5" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
              </label>
              <label className="block text-sm">
                <span className="text-steel-muted text-xs font-mono uppercase tracking-wider">Password</span>
                <Input
                  type="password"
                  className="mt-1.5"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              {error && (
                <p className="text-sm text-danger bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
              )}
              <Button disabled={busy} className="w-full !py-3.5 !text-[15px]">
                {busy ? "Signing in…" : cfg.cta}
              </Button>
              <p className="text-center font-mono text-[11px] text-steel-muted">
                Demo · {cfg.demoEmail} · Demo@1234
              </p>
            </form>
          </Card>
        </div>
      </section>
    </div>
  );
}

export function LoginHubPage() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/workspace" replace />;

  const cards: { key: keyof typeof PORTAL_LOGINS; path: string }[] = [
    { key: "office", path: "/login/office" },
    { key: "site", path: "/login/site" },
    { key: "vendor", path: "/login/vendor" },
    { key: "client", path: "/login/client" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#f3f1ec]">
      <header className="hero-readable relative overflow-hidden">
        <div className="absolute inset-0 blueprint-grid opacity-40" />
        <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-10 py-10 sm:py-14">
          <div className="flex items-center justify-between gap-4">
            <BrandMark size="lg" tagTone="dark" />
            <span className="hidden sm:inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs text-white backdrop-blur">
              PMC field system
            </span>
          </div>

          <div className="mt-12 sm:mt-16 max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-brand-glow mb-4">
              Choose your portal
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-white leading-[1.05] tracking-tight">
              One project spine.
              <span className="block text-brand-glow mt-1">Four working portals.</span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-white/92 leading-relaxed max-w-xl">
              Sharnam office, site engineers, vendors, and clients each get a dedicated login matched to their
              controls — drawings publish stays with the office.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-3 text-sm">
            {["Drawings unlock checklists", "Daily diary", "Cost & reports"].map((t) => (
              <span
                key={t}
                className="rounded-full border border-white/25 bg-black/30 px-3.5 py-1.5 text-white backdrop-blur"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 px-6 sm:px-10 py-10 sm:py-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl text-ink">Portals</h2>
              <p className="text-steel-muted text-sm mt-1">Select who you are to continue</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 lg:gap-5">
            {cards.map(({ key, path }, i) => {
              const c = PORTAL_LOGINS[key];
              return (
                <Link key={key} to={path} className={`rise rise-delay-${Math.min(i + 1, 3)}`}>
                  <div className="portal-card corner-frame surface rounded-2xl p-6 h-full">
                    <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-brand">{c.title}</div>
                    <div className="font-display text-2xl sm:text-[1.65rem] mt-3 text-ink leading-tight">
                      {c.headline}
                    </div>
                    <p className="text-sm text-steel-muted mt-3 leading-relaxed">{c.subtitle}</p>
                    <ul className="mt-5 space-y-1.5">
                      {c.points.map((p) => (
                        <li key={p} className="text-xs text-ink/80 flex gap-2">
                          <span className="text-brand mt-0.5">▸</span>
                          {p}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand">
                      Continue
                      <span className="transition-transform group-hover:translate-x-1">→</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <p className="mt-10 text-center text-xs text-steel-muted font-mono">
            Demo password for all portals · Demo@1234 · Admin uses Office portal
          </p>
        </div>
      </div>

      <footer className="border-t border-line bg-white/70 px-6 py-5">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <BrandMark size="sm" tagTone="light" />
          <p className="text-xs text-steel-muted">Sharnam Project Development Consultants & Co.</p>
        </div>
      </footer>
    </div>
  );
}
