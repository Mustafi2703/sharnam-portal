import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import type { AuthUser, RoleKey } from "@sharnam/shared";
import { Badge, Button, Card, Input } from "../components/ui";

type PortalConfig = {
  key: string;
  title: string;
  headline: string;
  subtitle: string;
  demoEmail: string;
  allowedRoles: RoleKey[];
  accent: string;
  points: string[];
};

export const PORTAL_LOGINS: Record<string, PortalConfig> = {
  client: {
    key: "client",
    title: "Client portal",
    headline: "See progress without the site noise.",
    subtitle: "Approved checklists, diaries, and weekly reports for your project.",
    demoEmail: "client@sharnam.demo",
    allowedRoles: ["client"],
    accent: "from-sky-500/25",
    points: ["Published drawings visibility", "Approved QA trail", "Weekly report pack"],
  },
  site: {
    key: "site",
    title: "Site employee portal",
    headline: "Log the day. Fill checklists when drawings are live.",
    subtitle: "Field crew access — diary, gated checklists, photos.",
    demoEmail: "site@sharnam.demo",
    allowedRoles: ["site_employee"],
    accent: "from-amber-500/20",
    points: ["Daily diary", "Drawing-gated checklists", "Yes / No / N.A. forms"],
  },
  employee: {
    key: "employee",
    title: "Employee portal",
    headline: "Office & field staff workspace.",
    subtitle: "Cross-functional employee seat for projects, CRM, and coordination.",
    demoEmail: "employee@sharnam.demo",
    allowedRoles: ["employee", "office"],
    accent: "from-emerald-500/20",
    points: ["Project modules", "Communications", "HR self-service"],
  },
  office: {
    key: "office",
    title: "Office portal",
    headline: "Publish drawings. Review. Cost. Communicate.",
    subtitle: "PMC office — unlock the site gate and run the project spine.",
    demoEmail: "office@sharnam.demo",
    allowedRoles: ["office", "admin"],
    accent: "from-cyan-400/25",
    points: ["Drawing publish", "Checklist review", "Cost & BOQ"],
  },
};

export function PortalLoginPage({ portalKey }: { portalKey: keyof typeof PORTAL_LOGINS }) {
  const cfg = PORTAL_LOGINS[portalKey];
  const { user, loading, loginWithToken } = useAuth();
  const [email, setEmail] = useState(cfg.demoEmail);
  const [password, setPassword] = useState("Demo@1234");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <section className={`relative hidden lg:flex flex-col justify-between p-12 surface-dark blueprint-grid overflow-hidden`}>
        <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_20%_15%,var(--tw-gradient-from),transparent_55%)] ${cfg.accent}`} />
        <div className="relative">
          <Link to="/login" className="text-white/50 text-sm hover:text-white transition">
            ← All portals
          </Link>
          <Badge tone="brand">
            {cfg.title}
          </Badge>
          <h1 className="font-display text-5xl xl:text-6xl mt-5 leading-[0.98] max-w-lg">{cfg.headline}</h1>
          <p className="mt-5 text-lg text-white/70 max-w-md leading-relaxed">{cfg.subtitle}</p>
        </div>
        <ul className="relative space-y-2 max-w-md">
          {cfg.points.map((p, i) => (
            <li key={p} className="flex gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85">
              <span className="font-mono text-brand-glow text-xs mt-0.5">0{i + 1}</span>
              {p}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md rise">
          <div className="lg:hidden mb-6">
            <Link to="/login" className="text-sm text-brand">
              ← All portals
            </Link>
            <div className="font-display text-3xl mt-3">शरणम्</div>
            <p className="text-steel-muted text-sm">{cfg.title}</p>
          </div>
          <h2 className="font-display text-4xl text-ink">Sign in</h2>
          <p className="text-steel-muted mt-2 mb-6 text-sm">{cfg.subtitle}</p>

          <Card>
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
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button disabled={busy} className="w-full !py-3">
                {busy ? "Signing in…" : `Enter ${cfg.title.toLowerCase()}`}
              </Button>
              <p className="text-center font-mono text-[11px] text-steel-muted">
                Demo: {cfg.demoEmail} · Demo@1234
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
  if (!loading && user) return <Navigate to="/" replace />;

  const cards: { key: keyof typeof PORTAL_LOGINS; path: string }[] = [
    { key: "client", path: "/login/client" },
    { key: "site", path: "/login/site" },
    { key: "employee", path: "/login/employee" },
    { key: "office", path: "/login/office" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="surface-dark blueprint-grid px-6 py-10 sm:px-10">
        <div className="max-w-5xl mx-auto">
          <div className="font-display text-4xl sm:text-5xl">शरणम्</div>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.28em] text-white/45">Site Command</p>
          <h1 className="font-display text-3xl sm:text-4xl mt-8 text-white/95 max-w-xl leading-tight">
            Choose your portal
          </h1>
          <p className="mt-3 text-white/60 max-w-lg">
            Separate entry for clients, site crew, employees, and office — so each login matches how people work.
          </p>
        </div>
      </header>

      <div className="flex-1 px-6 py-10 sm:px-10">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-2 gap-4">
          {cards.map(({ key, path }, i) => {
            const c = PORTAL_LOGINS[key];
            return (
              <Link key={key} to={path} className={`rise rise-delay-${Math.min(i + 1, 3)}`}>
                <Card className="h-full hover:border-brand/40 transition group">
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand">{c.title}</div>
                  <div className="font-display text-2xl mt-2 group-hover:text-brand-dark transition">{c.headline}</div>
                  <p className="text-sm text-steel-muted mt-2 leading-relaxed">{c.subtitle}</p>
                  <div className="mt-5 text-sm font-medium text-brand">Continue →</div>
                </Card>
              </Link>
            );
          })}
        </div>
        <p className="max-w-5xl mx-auto mt-8 text-center text-xs text-steel-muted font-mono">
          Admin uses Office portal · password Demo@1234 for all demos
        </p>
      </div>
    </div>
  );
}
