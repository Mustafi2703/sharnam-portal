import { useEffect, useState, type MouseEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import type { AuthUser, RoleKey } from "@sharnam/shared";
import { Button, Card, Input } from "../components/ui";
import { BrandLink, BrandMark, BRAND_EN, BRAND_HI, BRAND_TAG } from "../components/Brand";
import { THEME_OPTIONS } from "../themes";

type PortalConfig = {
  key: string;
  title: string;
  shortLabel: string;
  headline: string;
  subtitle: string;
  demoEmail: string;
  allowedRoles: RoleKey[];
  points: string[];
  cta: string;
  tone: string;
  icon: string;
};

export const PORTAL_LOGINS: Record<string, PortalConfig> = {
  client: {
    key: "client",
    title: "Client",
    shortLabel: "Client",
    headline: "Owner clarity on every sheet.",
    subtitle: "Published GFC, approved QA, and weekly packs — view-only client desk.",
    demoEmail: "client@sharnam.demo",
    allowedRoles: ["client"],
    points: ["Drawing visibility", "Raise concerns", "Weekly reports"],
    cta: "Enter Client portal",
    tone: "#0B6A78",
    icon: "CL",
  },
  site: {
    key: "site",
    title: "Sharnam Site",
    shortLabel: "Site",
    headline: "Field tools for Sharnam site teams.",
    subtitle: "Day logs, Final Index fills against published drawings + revisions.",
    demoEmail: "site@sharnam.demo",
    allowedRoles: ["site_employee"],
    points: ["Upload revisions", "Drawing-gated checklists", "Employee day log"],
    cta: "Enter Sharnam Site",
    tone: "#E4632A",
    icon: "ST",
  },
  employee: {
    key: "employee",
    title: "Employee",
    shortLabel: "Employee",
    headline: "Your Sharnam workday desk.",
    subtitle: "Projects, coordination, and self-service across the spine.",
    demoEmail: "employee@sharnam.demo",
    allowedRoles: ["employee", "office"],
    points: ["Project modules", "Communications", "HR self-service"],
    cta: "Enter Employee desk",
    tone: "#C24D1A",
    icon: "EM",
  },
  office: {
    key: "office",
    title: "Sharnam Office",
    shortLabel: "Office",
    headline: "Run the Sharnam project spine.",
    subtitle: "Upload drawings, publish GFC, assign checklist types, unlock site fills.",
    demoEmail: "office@sharnam.demo",
    allowedRoles: ["office", "admin"],
    points: ["Upload & publish drawings", "Assign checklist types", "Cost & BOQ"],
    cta: "Enter Sharnam Office",
    tone: "#E4632A",
    icon: "OF",
  },
  vendor: {
    key: "vendor",
    title: "Vendor",
    shortLabel: "Vendor",
    headline: "Trade partner on Sharnam projects.",
    subtitle: "Assigned projects — dual checklists, RFIs, and field fills.",
    demoEmail: "vendor@sharnam.demo",
    allowedRoles: ["vendor"],
    points: ["Assigned projects", "Revision upload", "Dual checklist fills"],
    cta: "Enter Vendor portal",
    tone: "#1C4A5A",
    icon: "VN",
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

function PortalSignInForm({ cfg }: { cfg: PortalConfig }) {
  const { loginWithToken } = useAuth();
  const [email, setEmail] = useState(cfg.demoEmail);
  const [password, setPassword] = useState("Demo@1234");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEmail(cfg.demoEmail);
    setPassword("Demo@1234");
    setError("");
  }, [cfg.key, cfg.demoEmail]);

  return (
    <Card className="brand-frame !rounded-xl !p-6">
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
        {error && <p className="text-sm text-danger bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>}
        <Button disabled={busy} className="w-full !py-3.5 !text-[15px]" style={{ background: cfg.tone }}>
          {busy ? "Signing in…" : cfg.cta}
        </Button>
        <p className="text-center font-mono text-[11px] text-steel-muted">
          Demo · {cfg.demoEmail} · Demo@1234
        </p>
      </form>
    </Card>
  );
}

export function PortalLoginPage({ portalKey }: { portalKey: keyof typeof PORTAL_LOGINS }) {
  const cfg = PORTAL_LOGINS[portalKey];
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/workspace" replace />;

  return (
    <div className="min-h-screen flex flex-col bg-sand">
      <header className="sticky top-0 z-40 bg-white border-b border-line">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between gap-3">
          <BrandLink to="/login" tagTone="light" />
          <Link to="/login" className="text-xs font-medium text-steel-muted hover:text-brand">
            All portals
          </Link>
        </div>
      </header>

      <div className="flex-1 grid lg:grid-cols-[1.05fr_0.95fr] max-w-6xl mx-auto w-full">
        <aside className="hidden lg:flex m-6 rounded-2xl border border-line bg-white p-8 flex-col justify-between">
          <div>
            <span
              className="inline-flex h-14 w-14 items-center justify-center rounded-xl text-white font-display text-lg"
              style={{ background: cfg.tone }}
            >
              {cfg.icon}
            </span>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-brand mt-6">
              {BRAND_HI} · {cfg.title}
            </p>
            <h1 className="font-display text-4xl mt-3 leading-tight text-ink">{cfg.headline}</h1>
            <p className="mt-3 text-sm text-steel-muted max-w-sm leading-relaxed">{cfg.subtitle}</p>
            <ul className="mt-6 space-y-2">
              {cfg.points.map((p) => (
                <li key={p} className="text-sm flex gap-2 text-ink">
                  <span className="text-brand">▸</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <BrandMark size="sm" tagTone="light" />
        </aside>

        <section className="flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md rise">
            <div className="lg:hidden mb-6">
              <BrandMark size="lg" tagTone="light" />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-brand mb-2">{BRAND_EN} sign in</p>
            <h2 className="font-display text-3xl text-ink tracking-tight">{cfg.title}</h2>
            <p className="text-steel-muted mt-2 mb-6 text-sm leading-relaxed">{cfg.subtitle}</p>
            <PortalSignInForm cfg={cfg} />
          </div>
        </section>
      </div>
    </div>
  );
}

const HUB_PORTALS: (keyof typeof PORTAL_LOGINS)[] = ["office", "site", "vendor", "client"];

/** Designed landing — logo, portal doors, indoor login (no raw photo modules) */
export function LoginHubPage() {
  const { user, loading } = useAuth();
  const spotlight = useSpotlight();
  const [active, setActive] = useState<keyof typeof PORTAL_LOGINS>("office");
  const [showDoor, setShowDoor] = useState(true);

  if (!loading && user) return <Navigate to="/workspace" replace />;

  const cfg = PORTAL_LOGINS[active];

  const modules = [
    { name: "Drawings & GFC", blurb: "Upload · register · publish gate", accent: "#E4632A", icon: "DWG" },
    { name: "Final Index", blurb: "Checklist types per drawing for engineers", accent: "#0B6A78", icon: "FI" },
    { name: "Quality Inspections", blurb: "QI templates separate from site fills", accent: "#2F6F4E", icon: "QI" },
    { name: "Cost & cashflow", blurb: "Measurement sheet + periods", accent: "#3D4450", icon: "₹" },
    { name: "Meetings & DPR", blurb: "Matrix, MoM, daily reports", accent: "#C24D1A", icon: "MTG" },
    { name: "RFIs & day log", blurb: "Queries, manpower, photos", accent: "#1C4A5A", icon: "FLD" },
  ];

  function openPortal(key: keyof typeof PORTAL_LOGINS) {
    setActive(key);
    setShowDoor(true);
  }

  return (
    <div className="min-h-screen bg-sand text-ink">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-line">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
          <BrandMark size="md" tagTone="light" />
          <div className="flex items-center gap-2 sm:gap-3">
            <a href="#portals" className="hidden sm:inline text-sm text-steel-muted hover:text-brand font-medium">
              Portals
            </a>
            <a href="#modules" className="hidden md:inline text-sm text-steel-muted hover:text-brand font-medium">
              Modules
            </a>
            <Link to="/login/office">
              <Button type="button" className="!text-xs !py-2">
                Open Sharnam
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-line bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(228,99,42,0.12),transparent_50%),radial-gradient(ellipse_at_80%_100%,rgba(11,106,120,0.1),transparent_45%)]" />
        <div className="relative max-w-6xl mx-auto px-5 py-14 sm:py-20 grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
          <div className="rise space-y-6">
            <div className="logo-plate brand-frame rounded-2xl bg-white border border-line p-4 sm:p-5 inline-block shadow-sm">
              <img src="/logo.png" alt={`${BRAND_HI} ${BRAND_EN}`} className="h-16 sm:h-20 w-auto object-contain" />
            </div>
            <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-brand">
              {BRAND_HI} · {BRAND_TAG}
            </p>
            <h1 className="font-display text-5xl sm:text-6xl tracking-tight leading-[0.95]">
              <span className="text-brand">{BRAND_EN}</span>
            </h1>
            <p className="text-base sm:text-lg text-steel-muted max-w-md leading-relaxed">
              Procore-style PMC spine — upload drawings, assign checklist types per sheet, engineer fills, client view.
              Designed UI for every module.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button type="button" className="!px-5 !py-3" onClick={() => openPortal("office")}>
                Enter Sharnam Office
              </Button>
              <Button type="button" variant="secondary" className="!px-5 !py-3" onClick={() => openPortal("client")}>
                Client portal
              </Button>
            </div>
            <p className="text-xs font-mono text-steel-muted">Demo password · Demo@1234</p>
          </div>

          <Card className="rise rise-delay-1 !p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-line bg-procore-navy text-white flex justify-between items-center">
              <span className="text-sm font-semibold">{BRAND_EN} · Product preview</span>
              <span className="text-[10px] font-mono text-white/70">Designed chrome</span>
            </div>
            <div className="grid grid-cols-3 gap-px bg-line">
              {[
                ["Upload", "Drawing"],
                ["Assign", "Checklist"],
                ["Fill", "Per sheet"],
                ["Gate", "Published"],
                ["Client", "View only"],
                ["Actions", "Right panel"],
              ].map(([k, v]) => (
                <div key={k} className="bg-white p-4 min-h-[84px]">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-steel-muted">{k}</div>
                  <div className="font-display text-base mt-2 text-ink">{v}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section id="portals" className="max-w-6xl mx-auto px-5 py-12">
        <div className="rounded-2xl border border-line bg-white overflow-hidden shadow-sm">
          <div className="px-6 sm:px-8 pt-8 pb-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-brand mb-2">Step indoors</p>
            <h2 className="font-display text-2xl sm:text-3xl">Choose your Sharnam login</h2>
            <p className="text-sm text-steel-muted mt-2 max-w-xl">
              Sharnam Office · Sharnam Site · Vendor · Client — designed doors, not photo cards.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 px-4 sm:px-6 pb-6">
            {HUB_PORTALS.map((key, i) => {
              const p = PORTAL_LOGINS[key];
              const selected = active === key && showDoor;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => openPortal(key)}
                  onMouseMove={spotlight}
                  className={`spotlight text-left rounded-xl border p-4 transition rise rise-delay-${Math.min(i + 1, 4)} ${
                    selected ? "border-brand ring-2 ring-brand/25 bg-brand-soft/30" : "border-line hover:border-brand/40 bg-white"
                  }`}
                >
                  <span
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white text-xs font-display"
                    style={{ background: p.tone }}
                  >
                    {p.icon}
                  </span>
                  <div className="font-display text-lg mt-3">{p.title}</div>
                  <p className="text-xs text-steel-muted mt-1.5 line-clamp-2 leading-relaxed">{p.subtitle}</p>
                  <div className="mt-3 text-xs font-semibold text-brand">{selected ? "Open below ↓" : "Open door →"}</div>
                </button>
              );
            })}
          </div>

          <div id="indoor-login" className="grid lg:grid-cols-[1fr_0.95fr] border-t border-line">
            <div className="p-8 sm:p-10 bg-sand/50 border-b lg:border-b-0 lg:border-r border-line">
              <span
                className="inline-flex h-12 w-12 items-center justify-center rounded-xl text-white font-display"
                style={{ background: cfg.tone }}
              >
                {cfg.icon}
              </span>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-brand mt-5">Indoor desk</p>
              <h3 className="font-display text-3xl mt-2">{cfg.title}</h3>
              <p className="mt-3 text-sm text-steel-muted max-w-sm leading-relaxed">{cfg.headline}</p>
              <ul className="mt-5 space-y-2">
                {cfg.points.map((pt) => (
                  <li key={pt} className="text-sm flex gap-2 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                    {pt}
                  </li>
                ))}
              </ul>
              <Link to={`/login/${cfg.key}`} className="mt-6 inline-flex text-sm font-medium text-brand hover:underline">
                Full-page {cfg.shortLabel} login →
              </Link>
            </div>
            <div className="p-6 sm:p-8 flex flex-col justify-center">
              <div className="rise" key={cfg.key}>
                <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-brand mb-2">Sign in · {cfg.shortLabel}</p>
                <h3 className="font-display text-2xl mb-1">{cfg.title}</h3>
                <p className="text-sm text-steel-muted mb-5">{cfg.subtitle}</p>
                <PortalSignInForm cfg={cfg} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="modules" className="max-w-6xl mx-auto px-5 pb-12">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-mark mb-2">After you sign in</p>
        <h2 className="font-display text-2xl sm:text-3xl mb-6">Designed modules</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((m, i) => (
            <button
              key={m.name}
              type="button"
              onClick={() => openPortal("office")}
              className={`text-left rounded-xl border border-line bg-white p-5 hover:border-brand/40 transition rise rise-delay-${Math.min(i + 1, 4)}`}
            >
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-white text-[10px] font-display"
                style={{ background: m.accent }}
              >
                {m.icon}
              </span>
              <div className="font-display text-lg mt-3">{m.name}</div>
              <p className="text-sm text-steel-muted mt-1.5 leading-relaxed">{m.blurb}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-white">
        <div className="max-w-6xl mx-auto px-5 py-10">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-brand mb-2">Eight UI options</p>
              <h2 className="font-display text-2xl">Theme swatches A–H</h2>
            </div>
            <p className="text-xs text-steel-muted">Apply inside the app after login · /themes</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {THEME_OPTIONS.map((t) => (
              <div key={t.id} className="rounded-xl border border-line overflow-hidden bg-sand/40">
                <div className="h-10" style={{ background: t.vars["--color-brand"] }} />
                <div className="p-2.5">
                  <div className="text-xs font-display">{t.letter} · {t.name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-line bg-white">
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-wrap items-center justify-between gap-4">
          <BrandMark size="sm" tagTone="light" />
          <p className="text-xs text-steel-muted">
            © {BRAND_EN} · {BRAND_TAG}
          </p>
        </div>
      </footer>
    </div>
  );
}
