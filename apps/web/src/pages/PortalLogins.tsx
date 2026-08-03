import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import type { AuthUser, RoleKey } from "@sharnam/shared";
import { Button, Input } from "../components/ui";
import { BrandLink, BrandLockup, BRAND_EN, BRAND_HI, BRAND_TAG } from "../components/Brand";
import { MODULE_META, setActiveWorkspace, type WorkspaceKey } from "../workspaces";
import { getColorMode, toggleColorMode } from "../themes";
import { IconMoon, IconSun } from "../components/icons";

export const LOGIN_LANDING_KEY = "sharnam_login_landing";

export type PortalConfig = {
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
  /** Where to land after sign-in */
  landingPath?: string;
  /** Optional workspace focus */
  workspaceKey?: WorkspaceKey | null;
  group: "master" | "module" | "role";
};

export const PORTAL_LOGINS: Record<string, PortalConfig> = {
  master: {
    key: "master",
    title: "Master",
    shortLabel: "Master",
    headline: "Set up every project from one desk.",
    subtitle: "Create projects, HRM assign, CRM, master documents, and choose the right RFI type.",
    demoEmail: "office@sharnam.demo",
    allowedRoles: ["admin", "office"],
    points: ["Create projects", "HRM & directory", "Master documents (DMS)", "PMC · Drawing · QI RFIs"],
    cta: "Enter Master module",
    tone: "#1E3A8A",
    icon: "MS",
    landingPath: "/dashboard",
    workspaceKey: null,
    group: "master",
  },
  drawings: {
    key: "drawings",
    title: "Drawings & Documents",
    shortLabel: "Drawings",
    headline: "GFC register and project Documents.",
    subtitle: "Upload sheets, manage DMS, attach checklists, raise Drawing checklist fill RFIs.",
    demoEmail: "office@sharnam.demo",
    allowedRoles: ["admin", "office", "employee", "site_employee", "vendor"],
    points: ["GFC register", "Documents (DMS)", "Request checklist fill", "Coordination"],
    cta: "Enter Drawings module",
    tone: "#1D4ED8",
    icon: "DW",
    landingPath: "/dashboard",
    workspaceKey: "drawings",
    group: "module",
  },
  quality: {
    key: "quality",
    title: "Quality",
    shortLabel: "Quality",
    headline: "Procore-style QI, Safety, and site checklists.",
    subtitle: "Quality Inspections and Safety are separate. Site checklists stay clear of the QI form.",
    demoEmail: "site@sharnam.demo",
    allowedRoles: ["admin", "office", "employee", "site_employee", "vendor"],
    points: ["Quality Inspections (Procore)", "Safety", "Site checklists", "Request QI fill"],
    cta: "Enter Quality module",
    tone: "#15803D",
    icon: "QA",
    landingPath: "/dashboard",
    workspaceKey: "quality",
    group: "module",
  },
  comms: {
    key: "comms",
    title: "Communications",
    shortLabel: "Comms",
    headline: "Matrix → meeting → Agenda → MoM.",
    subtitle: "Create meetings like real MoM work. Ask (PMC RFI) and Outlook live in this module.",
    demoEmail: "office@sharnam.demo",
    allowedRoles: ["admin", "office", "employee", "site_employee"],
    points: ["Matrix", "Create meeting / MoM", "Ask (PMC RFI)", "Email / Outlook"],
    cta: "Enter Comms module",
    tone: "#2563EB",
    icon: "CM",
    landingPath: "/dashboard",
    workspaceKey: "comms",
    group: "module",
  },
  field: {
    key: "field",
    title: "Field",
    shortLabel: "Field",
    headline: "Day log, photos, site RFIs.",
    subtitle: "Manpower, equipment, and field evidence for the project spine.",
    demoEmail: "site@sharnam.demo",
    allowedRoles: ["admin", "office", "site_employee", "employee", "vendor"],
    points: ["Day log", "Photos", "Field RFIs", "Reports"],
    cta: "Enter Field module",
    tone: "#DC2626",
    icon: "FD",
    landingPath: "/dashboard",
    workspaceKey: "field",
    group: "module",
  },
  office: {
    key: "office",
    title: "Sharnam Office",
    shortLabel: "Office",
    headline: "Full control desk for Sharnam Office.",
    subtitle: "Master setup, access roles, CRM, HRMS, drawings, cost, and every project module — one SAP-style workspace.",
    demoEmail: "office@sharnam.demo",
    allowedRoles: ["office", "admin"],
    points: ["Access & roles control", "CRM bids + HRMS", "All project modules", "Cost · BOQ · Finance"],
    cta: "Enter Sharnam Office",
    tone: "#0B6A78",
    icon: "OF",
    landingPath: "/dashboard",
    workspaceKey: null,
    group: "role",
  },
  site: {
    key: "site",
    title: "Sharnam Site",
    shortLabel: "Site",
    headline: "Field tools for Sharnam site teams.",
    subtitle: "Day logs, checklist fills via RFIs, revisions.",
    demoEmail: "site@sharnam.demo",
    allowedRoles: ["site_employee"],
    points: ["Day log", "Checklist fills", "Revisions", "QI forms"],
    cta: "Enter Sharnam Site",
    tone: "#15803D",
    icon: "ST",
    landingPath: "/dashboard",
    workspaceKey: "field",
    group: "role",
  },
  employee: {
    key: "employee",
    title: "Employee",
    shortLabel: "Employee",
    headline: "Your Sharnam workday desk.",
    subtitle: "Projects, coordination, and self-service across modules.",
    demoEmail: "employee@sharnam.demo",
    allowedRoles: ["employee", "office"],
    points: ["Project modules", "Communications", "HR self-service"],
    cta: "Enter Employee desk",
    tone: "#64748B",
    icon: "EM",
    landingPath: "/dashboard",
    group: "role",
  },
  vendor: {
    key: "vendor",
    title: "Vendor",
    shortLabel: "Vendor",
    headline: "Trade partner on Sharnam projects.",
    subtitle: "Assigned projects — checklist fills when you are the responsible vendor on an RFI.",
    demoEmail: "vendor@sharnam.demo",
    allowedRoles: ["vendor"],
    points: ["Assigned projects", "Fill RFIs", "Photos / dual fills"],
    cta: "Enter Vendor portal",
    tone: "#0F172A",
    icon: "VN",
    landingPath: "/dashboard",
    workspaceKey: "drawings",
    group: "role",
  },
  client: {
    key: "client",
    title: "Client",
    shortLabel: "Client",
    headline: "Owner clarity on every sheet.",
    subtitle: "Published GFC, concerns, and weekly packs — view-oriented client desk.",
    demoEmail: "client@sharnam.demo",
    allowedRoles: ["client"],
    points: ["Drawing visibility", "Raise concerns", "Weekly reports"],
    cta: "Enter Client portal",
    tone: "#1E40AF",
    icon: "CL",
    landingPath: "/dashboard",
    workspaceKey: "drawings",
    group: "role",
  },
};

export function consumeLoginLanding() {
  try {
    const path = localStorage.getItem(LOGIN_LANDING_KEY) || "/dashboard";
    localStorage.removeItem(LOGIN_LANDING_KEY);
    return path;
  } catch {
    return "/workspace";
  }
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
    <form
      className="space-y-3"
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
          try {
            localStorage.setItem(LOGIN_LANDING_KEY, cfg.landingPath || "/dashboard");
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
      <label className="block text-sm">
        <span className="text-steel-muted text-xs font-semibold uppercase tracking-wider">Email</span>
        <Input className="mt-1.5" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
      </label>
      <label className="block text-sm">
        <span className="text-steel-muted text-xs font-semibold uppercase tracking-wider">Password</span>
        <Input
          type="password"
          className="mt-1.5"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </label>
      {error && (
        <p className="text-sm text-danger bg-[color-mix(in_srgb,var(--color-danger)_12%,var(--color-paper))] border border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)] px-3 py-2 rounded-lg">
          {error}
        </p>
      )}
      <Button disabled={busy} className="w-full !py-3 !text-[15px] !rounded-xl">
        {busy ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-[11px] text-steel-muted leading-snug">{cfg.demoEmail}</p>
    </form>
  );
}

const HUB_ROLES: (keyof typeof PORTAL_LOGINS)[] = ["office", "site", "vendor", "client", "employee", "master"];

const PORTAL_ACCENTS: Record<string, string> = {
  office: "#0B6A78",
  site: "#15803D",
  vendor: "#C45C26",
  client: "#1E40AF",
  employee: "#64748B",
  master: "#1C222B",
};

function portalDisplayName(key: string, shortLabel: string) {
  if (key === "vendor") return "Contractor";
  if (key === "master") return "Master";
  return shortLabel;
}

const HERO_MODULES = (Object.keys(MODULE_META) as WorkspaceKey[]).map((key) => ({
  key,
  ...MODULE_META[key],
}));

function ConstructionHeroPanel({
  title,
  subtitle,
  points,
  badge = `${BRAND_HI} · Construction PMC`,
  imageSrc = "/hero-login-wide.jpg",
  showModules = false,
}: {
  title: string;
  subtitle: string;
  points?: string[];
  badge?: string;
  imageSrc?: string;
  showModules?: boolean;
}) {
  return (
    <aside className="hero-3d relative hidden lg:flex h-full min-h-0 flex-col justify-end overflow-hidden text-white">
      <div className="hero-3d__stage" aria-hidden>
        <img
          src={imageSrc}
          alt=""
          className="hero-3d__photo"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = "/hero-login.jpg";
          }}
        />
        <div className="hero-3d__veil" />
        <div className="hero-3d__orb hero-3d__orb--a" />
        <div className="hero-3d__orb hero-3d__orb--b" />
        <div className="hero-3d__grid" />
      </div>

      <div className="absolute top-0 left-0 right-0 p-6 xl:p-8 flex items-start justify-between gap-4 z-20">
        <span className="hero-3d__logo-plate inline-flex rounded-xl bg-white/95 p-2.5 shadow-xl">
          <img src="/logo.png" alt={BRAND_EN} className="h-10 w-auto object-contain" />
        </span>
        <span className="rounded-full border border-white/25 bg-black/35 backdrop-blur px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] font-semibold text-teal-100">
          All portals · One brand
        </span>
      </div>

      {showModules && (
        <div className="hero-3d__modules absolute inset-x-0 top-[22%] bottom-[42%] px-6 xl:px-8 z-10 pointer-events-none">
          <div className="hero-3d__deck">
            {HERO_MODULES.map((m, i) => (
              <div
                key={m.key}
                className="hero-3d__card"
                style={{
                  ["--card-accent" as string]: m.accent,
                  ["--card-glow" as string]: m.glow,
                  ["--card-delay" as string]: `${i * 0.08}s`,
                  ["--card-y" as string]: `${(i % 3) * 8 - 8}px`,
                  ["--card-rot" as string]: `${(i % 2 === 0 ? -1 : 1) * (4 + (i % 3))}deg`,
                }}
              >
                <span className="hero-3d__card-icon" style={{ background: m.accent }}>
                  {m.icon}
                </span>
                <span className="hero-3d__card-title">{m.title}</span>
                <span className="hero-3d__card-tools">
                  {m.desc.split(",")[0]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="relative z-20 p-6 xl:p-10 max-w-xl hero-3d__copy">
        <p className="text-[11px] uppercase tracking-[0.22em] text-teal-200 font-semibold">{badge}</p>
        <h1 className="font-display text-3xl xl:text-[2.35rem] tracking-tight mt-3 leading-[1.12] text-white">
          {title}
        </h1>
        <p className="mt-3 text-[15px] text-white/90 leading-relaxed">{subtitle}</p>
        {points && points.length > 0 && (
          <ul className="mt-6 space-y-2.5 border-t border-white/20 pt-4">
            {points.map((p) => (
              <li key={p} className="text-[13px] text-white/92 flex gap-2.5">
                <span className="text-[#C45C26] shrink-0 font-bold">▸</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

export function PortalLoginPage({ portalKey }: { portalKey: keyof typeof PORTAL_LOGINS }) {
  const cfg = PORTAL_LOGINS[portalKey];
  const { user, loading } = useAuth();
  if (!cfg) return <Navigate to="/login" replace />;
  if (!loading && user) return <Navigate to={consumeLoginLanding()} replace />;

  return (
    <div className="login-shell grid lg:grid-cols-[minmax(0,0.9fr)_minmax(380px,1.1fr)]">
      <ConstructionHeroPanel title={cfg.headline} subtitle={cfg.subtitle} points={cfg.points} imageSrc="/hero-login-wide.jpg" />
      <section className="login-panel flex flex-col h-full border-l border-line">
        <header className="px-6 pt-5 pb-2 flex items-center justify-between shrink-0">
          <BrandLink to="/login" tagTone="light" />
          <Link to="/login" className="text-sm font-semibold text-brand">
            All portals
          </Link>
        </header>
        <div className="flex-1 flex items-center px-6 pb-8">
          <div className="w-full max-w-[400px] mx-auto">
            <BrandLockup className="mb-6 lg:hidden" />
            <p className="text-[11px] uppercase tracking-[0.18em] text-brand font-semibold mb-1">{BRAND_EN}</p>
            <h2 className="font-display text-3xl text-ink tracking-tight">{cfg.title}</h2>
            <p className="text-steel-muted mt-2 mb-5 text-[15px] leading-relaxed">{cfg.subtitle}</p>
            <PortalSignInForm cfg={cfg} />
          </div>
        </div>
      </section>
    </div>
  );
}

/** Landing + sign-in — all Sharnam portals, logo-matched hero */
export function LoginHubPage() {
  const { user, loading } = useAuth();
  const [active, setActive] = useState<keyof typeof PORTAL_LOGINS>("office");
  const [mode, setMode] = useState(() => getColorMode());

  if (!loading && user) return <Navigate to={consumeLoginLanding()} replace />;

  const cfg = PORTAL_LOGINS[active];
  const dark = mode === "dark";

  function flipTheme() {
    setMode(toggleColorMode());
  }

  return (
    <div className="login-shell flex flex-col lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
      <div className="lg:hidden relative h-[34vw] min-h-[140px] max-h-[220px] overflow-hidden shrink-0">
        <img
          src="/hero-login-wide.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = "/hero-login.jpg";
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(180deg, rgba(11,106,120,0.3) 0%, rgba(10,12,15,0.88) 100%)",
          }}
        />
        <div className="relative z-10 h-full flex flex-col justify-between px-4 py-3.5 text-white">
          <span className="inline-flex self-start rounded-md bg-white/95 p-1.5">
            <img src="/logo.png" alt="" className="h-8 w-auto" />
          </span>
          <div>
            <p className="text-[9px] uppercase tracking-[0.2em] text-teal-200 font-semibold">{BRAND_HI} · PMC</p>
            <p className="font-display text-xl leading-tight">Every portal. One Sharnam.</p>
          </div>
        </div>
      </div>

      <ConstructionHeroPanel
        title="Every Sharnam portal. One delivery spine."
        subtitle="Office, Site, Contractor, Client, Employee, and Master — sign in with the desk that matches your role."
        points={[
          "Office — full control: Master, CRM, HRMS, Access, Audit",
          "Site · Field · Quality · Safety · Day log",
          "Contractor fills · Client civil view · Employee self-service",
        ]}
        badge={`${BRAND_HI} · शरणम् Project Development Consultants`}
        imageSrc="/hero-login-wide.jpg"
        showModules
      />

      <section id="signin" className="login-panel flex flex-col h-full min-h-0 lg:border-l border-line overflow-hidden">
        <div className="shrink-0 px-5 sm:px-7 pt-4 flex items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-brand font-semibold hidden sm:block">
            Choose your portal
          </p>
          <button
            type="button"
            onClick={flipTheme}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-sand px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand hover:text-brand ml-auto"
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dark ? <IconSun size={14} /> : <IconMoon size={14} />}
            {dark ? "Light" : "Dark"}
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-7 py-3 sm:py-4">
          <div className="w-full max-w-[440px] mx-auto">
            <BrandLockup compact />

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5 perspective-login">
              {HUB_ROLES.map((key, i) => {
                const role = PORTAL_LOGINS[key];
                const selected = active === key;
                const accent = PORTAL_ACCENTS[key] || "#0B6A78";
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActive(key)}
                    className={`login-portal-3d relative overflow-hidden rounded-xl border text-left transition ${
                      selected ? "is-on border-transparent" : "border-line hover:border-brand/40"
                    }`}
                    style={{
                      minHeight: 78,
                      ["--portal-accent" as string]: accent,
                      animationDelay: `${i * 0.05}s`,
                    }}
                  >
                    <span
                      className="absolute inset-0 opacity-95"
                      style={{
                        background: `linear-gradient(145deg, ${accent} 0%, #12161c 100%)`,
                      }}
                    />
                    <span
                      className="absolute inset-0 opacity-30 bg-cover bg-center mix-blend-overlay"
                      style={{ backgroundImage: "url(/hero-login-wide.jpg)" }}
                    />
                    <span className="login-portal-3d__shine" aria-hidden />
                    <span className="relative z-10 block p-2.5 text-white">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-white/75">
                        Portal
                      </span>
                      <span className="block text-[14px] font-semibold leading-tight mt-0.5">
                        {portalDisplayName(key, role.shortLabel)}
                      </span>
                    </span>
                    {selected && (
                      <span className="absolute top-2 right-2 z-10 h-2.5 w-2.5 rounded-full bg-[#C45C26] ring-2 ring-white/80 login-live-dot" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {HERO_MODULES.map((m) => (
                <span
                  key={m.key}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border border-line"
                  style={{ background: m.soft, color: m.ink, borderColor: `${m.accent}33` }}
                  title={m.desc}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.accent }} />
                  {m.title}
                </span>
              ))}
            </div>

            <div className="login-card mt-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-brand font-semibold">{cfg.title}</p>
                  <p className="text-sm text-steel-muted mt-1 leading-relaxed">{cfg.subtitle}</p>
                </div>
              </div>
              <p className="text-xs text-steel-muted mb-3">
                Demo password <span className="font-semibold text-brand">Demo@1234</span>
              </p>
              <ul className="mb-4 space-y-1">
                {cfg.points.slice(0, 3).map((p) => (
                  <li key={p} className="text-xs text-ink flex gap-2">
                    <span className="text-brand font-bold">·</span>
                    {p}
                  </li>
                ))}
              </ul>
              <PortalSignInForm cfg={cfg} />
              <p className="mt-3 text-center text-[11px] text-steel-muted">
                Or open{" "}
                <Link to={`/login/${cfg.key}`} className="text-brand font-semibold">
                  dedicated {portalDisplayName(cfg.key, cfg.shortLabel)} page
                </Link>
              </p>
            </div>
          </div>
        </div>

        <footer className="shrink-0 px-5 sm:px-7 py-3 border-t border-line flex items-center justify-between gap-2">
          <p className="text-xs text-steel-muted">
            © {new Date().getFullYear()} {BRAND_EN} · {BRAND_TAG}
          </p>
          <p className="text-[11px] text-brand font-semibold shrink-0">{BRAND_HI}</p>
        </footer>
      </section>
    </div>
  );
}
