import { useState, type MouseEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import type { AuthUser, RoleKey } from "@sharnam/shared";
import { Badge, Button, Card, Input } from "../components/ui";
import { BrandHero, BrandLink, BrandMark } from "../components/Brand";

type PortalConfig = {
  key: string;
  title: string;
  headline: string;
  subtitle: string;
  demoEmail: string;
  allowedRoles: RoleKey[];
  image: string;
  points: string[];
  cta: string;
};

export const PORTAL_LOGINS: Record<string, PortalConfig> = {
  client: {
    key: "client",
    title: "Client",
    headline: "Clarity for owners.",
    subtitle: "Published drawings, approved QA, and weekly packs — without site noise.",
    demoEmail: "client@sharnam.demo",
    allowedRoles: ["client"],
    image: "/media/portal-client.jpg",
    points: ["Drawing visibility", "Approved QA trail", "Weekly reports"],
    cta: "Enter client portal",
  },
  site: {
    key: "site",
    title: "Site",
    headline: "Built for the field.",
    subtitle: "Day logs, Final Index fills, and GFC revisions once drawings publish.",
    demoEmail: "site@sharnam.demo",
    allowedRoles: ["site_employee"],
    image: "/media/portal-site.jpg",
    points: ["Upload revisions", "Drawing-gated checklists", "Employee day log"],
    cta: "Enter site portal",
  },
  employee: {
    key: "employee",
    title: "Employee",
    headline: "Your workday desk.",
    subtitle: "Projects, coordination, and self-service across the spine.",
    demoEmail: "employee@sharnam.demo",
    allowedRoles: ["employee", "office"],
    image: "/media/portal-office.jpg",
    points: ["Project modules", "Communications", "HR self-service"],
    cta: "Enter employee portal",
  },
  office: {
    key: "office",
    title: "Office",
    headline: "Run the project spine.",
    subtitle: "Publish GFC, review QA, cost, and keep the site unlocked.",
    demoEmail: "office@sharnam.demo",
    allowedRoles: ["office", "admin"],
    image: "/media/portal-office.jpg",
    points: ["Drawing publish", "Checklist review", "Cost & BOQ"],
    cta: "Enter office portal",
  },
  vendor: {
    key: "vendor",
    title: "Vendor",
    headline: "Trade partner workspace.",
    subtitle: "Assigned projects — dual checklists, RFIs, and field fills.",
    demoEmail: "vendor@sharnam.demo",
    allowedRoles: ["vendor"],
    image: "/media/portal-vendor.jpg",
    points: ["Assigned projects", "Revision upload", "Dual checklist fills"],
    cta: "Enter vendor portal",
  },
};

function useSpotlight() {
  return (e: MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
}

export function PortalLoginPage({ portalKey }: { portalKey: keyof typeof PORTAL_LOGINS }) {
  const cfg = PORTAL_LOGINS[portalKey];
  const { user, loading, loginWithToken } = useAuth();
  const [email, setEmail] = useState(cfg.demoEmail);
  const [password, setPassword] = useState("Demo@1234");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const onMove = useSpotlight();

  if (!loading && user) return <Navigate to="/workspace" replace />;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <section
        className="relative hidden lg:flex flex-col justify-between p-10 xl:p-14 text-white overflow-hidden"
        onMouseMove={onMove}
      >
        <img src={cfg.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-black/90 via-black/70 to-black/50" />
        <div className="absolute inset-0 spotlight" />
        <div className="absolute inset-0 blueprint-grid opacity-30" />
        <div className="relative z-10">
          <BrandLink to="/login" tagTone="dark" />
          <Link to="/login" className="inline-block mt-8 text-sm text-white/70 hover:text-white underline-offset-4 hover:underline">
            ← All portals
          </Link>
          <div className="mt-10 construction-chip">{cfg.title} portal</div>
          <h1 className="font-display text-5xl xl:text-6xl mt-5 leading-[1.02] max-w-lg text-white">{cfg.headline}</h1>
          <p className="mt-5 text-base text-white/80 max-w-md leading-relaxed">{cfg.subtitle}</p>
        </div>
        <ul className="relative z-10 space-y-2 max-w-md">
          {cfg.points.map((p, i) => (
            <li
              key={p}
              className={`rise rise-delay-${Math.min(i + 1, 3)} flex gap-3 border border-white/15 bg-black/40 backdrop-blur-md px-4 py-3 text-sm text-white`}
            >
              <span className="font-mono text-[10px] text-white/50 mt-0.5">0{i + 1}</span>
              {p}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10 bg-sand">
        <div className="w-full max-w-md rise">
          <div className="lg:hidden mb-8 space-y-4">
            <BrandMark size="lg" tagTone="light" />
            <Link to="/login" className="text-sm font-semibold underline underline-offset-4">
              ← All portals
            </Link>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-steel-muted mb-2">{cfg.title}</p>
          <h2 className="font-display text-4xl text-ink tracking-tight">Sign in</h2>
          <p className="text-steel-muted mt-2 mb-6 text-sm leading-relaxed">{cfg.subtitle}</p>

          <Card className="brand-frame !rounded-none">
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
                <Input className="mt-1.5 !rounded-none" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
              </label>
              <label className="block text-sm">
                <span className="text-steel-muted text-xs font-mono uppercase tracking-wider">Password</span>
                <Input
                  type="password"
                  className="mt-1.5 !rounded-none"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              {error && <p className="text-sm text-danger bg-red-50 border border-red-100 px-3 py-2">{error}</p>}
              <Button disabled={busy} className="w-full !py-3.5 !text-[15px] !rounded-none">
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
  const onMove = useSpotlight();
  if (!loading && user) return <Navigate to="/workspace" replace />;

  const cards: { key: keyof typeof PORTAL_LOGINS; path: string }[] = [
    { key: "office", path: "/login/office" },
    { key: "site", path: "/login/site" },
    { key: "vendor", path: "/login/vendor" },
    { key: "client", path: "/login/client" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-black text-white">
      {/* Full-bleed hero — brand first, one CTA stack */}
      <header className="relative min-h-[88vh] flex flex-col justify-end overflow-hidden" onMouseMove={onMove}>
        <img src="/media/hero-site.jpg" alt="" className="absolute inset-0 w-full h-full object-cover scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/40" />
        <div className="absolute inset-0 spotlight" />
        <div className="absolute inset-0 blueprint-grid opacity-25" />

        <div className="relative z-10 max-w-6xl mx-auto w-full px-6 sm:px-10 pb-14 pt-10">
          <BrandHero className="rise mb-10 sm:mb-14" />
          <div className="max-w-2xl rise rise-delay-1">
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-[1.02] text-white">
              Construction command
              <span className="block text-white/55 mt-1">built around the site.</span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-white/75 leading-relaxed max-w-xl">
              GFC drawings, Final Index fills, quality inspections, and day logs — office and field in one spine.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {["Steel & site", "GFC publish", "QA gate", "Live day log"].map((t) => (
                <span key={t} className="construction-chip">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      <section className="bg-[#0f0f0f] px-6 sm:px-10 py-14">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40 mb-2">Enter</p>
              <h2 className="font-display text-3xl sm:text-4xl text-white">Choose your portal</h2>
            </div>
            <p className="text-sm text-white/45 max-w-xs">Interactive tiles — hover to lift the site photo, click to sign in.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 lg:gap-5">
            {cards.map(({ key, path }, i) => {
              const c = PORTAL_LOGINS[key];
              return (
                <Link key={key} to={path} className={`group media-tile interactive-lift rise rise-delay-${Math.min(i + 1, 4)} h-[280px] sm:h-[300px] border border-white/10`}>
                  <img src={c.image} alt="" />
                  <div className="media-veil" />
                  <div className="absolute inset-0 p-6 flex flex-col justify-end z-10">
                    <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/60">{c.title}</div>
                    <div className="font-display text-2xl sm:text-3xl text-white mt-2 leading-tight">{c.headline}</div>
                    <p className="text-sm text-white/70 mt-2 line-clamp-2">{c.subtitle}</p>
                    <div className="mt-4 text-sm font-semibold text-white inline-flex items-center gap-2 group-hover:gap-3 transition-all">
                      Continue <span aria-hidden>→</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <p className="mt-10 text-center text-xs text-white/35 font-mono">Demo password · Demo@1234 · Admin uses Office</p>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-black px-6 py-6">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <BrandMark size="sm" tagTone="dark" />
          <p className="text-xs text-white/40">Sharnam Project Development Consultants & Co.</p>
        </div>
      </footer>
    </div>
  );
}
