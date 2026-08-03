import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import type { AuthUser, RoleKey } from "@sharnam/shared";
import { Button, Input } from "../components/ui";
import { BRAND_EN, BRAND_HI, BRAND_TAG } from "../components/Brand";
import { MODULE_META, setActiveWorkspace, type WorkspaceKey } from "../workspaces";

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
  landingPath?: string;
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
    subtitle: "Master setup, access roles, CRM, HRMS, drawings, cost, and every project module.",
    demoEmail: "office@sharnam.demo",
    allowedRoles: ["office", "admin"],
    points: ["Access & roles", "CRM + HRMS", "All project modules", "Cost · Finance"],
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
    tone: "#C45C26",
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

const HUB_ROLES: (keyof typeof PORTAL_LOGINS)[] = ["office", "site", "vendor", "client", "employee", "master"];

const HERO_SLIDES = [
  { src: "/heroes/site-01.jpg", caption: "Architecture in progress", fallback: "/hero-login-wide.jpg" },
  { src: "/heroes/site-02.jpg", caption: "Active construction site", fallback: "/hero-login.jpg" },
  { src: "/heroes/site-03.jpg", caption: "Structure & steel", fallback: "/hero-login-wide.jpg" },
  { src: "/heroes/site-04.jpg", caption: "Urban skyline delivery", fallback: "/hero-login.jpg" },
  { src: "/heroes/site-05.jpg", caption: "Site engineering desk", fallback: "/hero-login-wide.jpg" },
  { src: "/hero-login-wide.jpg", caption: "Sharnam project delivery", fallback: "/hero-login.jpg" },
];

const HERO_MODULES = (Object.keys(MODULE_META) as WorkspaceKey[]).map((key) => ({
  key,
  ...MODULE_META[key],
}));

function portalDisplayName(key: string, shortLabel: string) {
  if (key === "vendor") return "Contractor";
  if (key === "master") return "Master";
  return shortLabel;
}

/** White plate + S lettermark — brand on hero without full logo art */
function BrandSMark({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`landing-brand ${dark ? "landing-brand--on-dark" : ""}`}>
      <span className="landing-brand__plate" aria-hidden>
        <span className="landing-brand__s">S</span>
      </span>
      <span className="landing-brand__text">
        <span className="landing-brand__name">{BRAND_EN}</span>
        <span className="landing-brand__tag">{BRAND_HI} · PMC</span>
      </span>
    </div>
  );
}

function PortalSignInForm({ cfg, dark }: { cfg: PortalConfig; dark?: boolean }) {
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
      className="space-y-3.5"
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
      <label className="block">
        <span className={`text-[11px] font-semibold tracking-[0.14em] uppercase ${dark ? "text-white/55" : "text-steel-muted"}`}>
          Email
        </span>
        <Input
          className={`mt-1.5 !rounded-lg ${dark ? "landing-input-dark" : ""}`}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
        />
      </label>
      <label className="block">
        <span className={`text-[11px] font-semibold tracking-[0.14em] uppercase ${dark ? "text-white/55" : "text-steel-muted"}`}>
          Password
        </span>
        <Input
          type="password"
          className={`mt-1.5 !rounded-lg ${dark ? "landing-input-dark" : ""}`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </label>
      {error && (
        <p className="text-sm text-red-300 bg-red-500/15 border border-red-400/30 px-3 py-2 rounded-lg">{error}</p>
      )}
      <Button disabled={busy} className="w-full !py-3 !text-[15px] !rounded-lg !font-semibold">
        {busy ? "Signing in…" : "Sign in"}
      </Button>
      <p className={`text-center text-[11px] ${dark ? "text-white/45" : "text-steel-muted"}`}>
        Demo · <span className={dark ? "text-teal-200/90" : "text-brand"}>Demo@1234</span>
      </p>
    </form>
  );
}

function HeroCarousel({ className = "" }: { className?: string }) {
  const [slide, setSlide] = useState(0);
  const [moduleIdx, setModuleIdx] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => {
      setSlide((s) => (s + 1) % HERO_SLIDES.length);
      setModuleIdx((m) => (m + 1) % HERO_MODULES.length);
    }, 5200);
    return () => window.clearInterval(t);
  }, []);

  const current = HERO_SLIDES[slide];
  const activeMod = HERO_MODULES[moduleIdx];

  return (
    <div className={`landing-hero ${className}`}>
      <div className="landing-hero__stage" aria-hidden>
        {HERO_SLIDES.map((s, i) => (
          <img
            key={s.src}
            src={s.src}
            alt=""
            className={`landing-hero__img ${i === slide ? "is-active" : ""}`}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = s.fallback;
            }}
          />
        ))}
        <div className="landing-hero__veil" />
      </div>

      <header className="landing-hero__top">
        <BrandSMark />
        <span className="landing-hero__pill">Project delivery · PMC</span>
      </header>

      <div className="landing-hero__modules">
        {HERO_MODULES.map((m, i) => {
          const on = i === moduleIdx;
          return (
            <span
              key={m.key}
              className={`landing-mod-chip ${on ? "is-on" : ""}`}
              style={{
                ["--chip-accent" as string]: m.accent,
                ["--chip-soft" as string]: m.soft,
              }}
            >
              <span className="landing-mod-chip__dot" style={{ background: m.accent }} />
              {m.title}
            </span>
          );
        })}
      </div>

      <div className="landing-hero__copy">
        <p className="landing-hero__eyebrow">{current.caption}</p>
        <h1 className="landing-hero__title">
          Every portal.
          <br />
          One {BRAND_EN}.
        </h1>
        <p className="landing-hero__sub">
          Office, Site, Contractor, Client, Employee, and Master — pick your desk and sign in.
        </p>
        <p className="landing-hero__mod-hint">
          Now featuring <strong style={{ color: activeMod.accent }}>{activeMod.title}</strong>
          <span> — {activeMod.desc.split(",")[0]}</span>
        </p>
        <div className="landing-hero__dots" role="tablist" aria-label="Project slides">
          {HERO_SLIDES.map((s, i) => (
            <button
              key={s.src}
              type="button"
              aria-label={`Slide ${i + 1}`}
              className={`landing-hero__dot ${i === slide ? "is-on" : ""}`}
              onClick={() => setSlide(i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PortalLoginPage({ portalKey }: { portalKey: keyof typeof PORTAL_LOGINS }) {
  const cfg = PORTAL_LOGINS[portalKey];
  const { user, loading } = useAuth();
  if (!cfg) return <Navigate to="/login" replace />;
  if (!loading && user) return <Navigate to={consumeLoginLanding()} replace />;

  return (
    <div className="landing-shell">
      <HeroCarousel className="hidden lg:block" />
      <section className="landing-panel">
        <div className="landing-panel__inner">
          <Link to="/login" className="landing-panel__back">
            ← All portals
          </Link>
          <div className="landing-panel__logo-wrap">
            <img src="/logo.png" alt={BRAND_EN} className="landing-panel__logo" />
          </div>
          <h2 className="landing-panel__title">{cfg.title}</h2>
          <p className="landing-panel__sub">{cfg.subtitle}</p>
          <PortalSignInForm cfg={cfg} dark />
        </div>
      </section>
    </div>
  );
}

/** Modern landing — rotating project heroes + calm dark login desk */
export function LoginHubPage() {
  const { user, loading } = useAuth();
  const [active, setActive] = useState<keyof typeof PORTAL_LOGINS>("office");

  if (!loading && user) return <Navigate to={consumeLoginLanding()} replace />;

  const cfg = PORTAL_LOGINS[active];

  return (
    <div className="landing-shell">
      <div className="landing-shell__mobile-hero lg:hidden">
        <HeroCarousel />
      </div>

      <HeroCarousel className="hidden lg:block" />

      <section id="signin" className="landing-panel">
        <div className="landing-panel__scroll">
          <div className="landing-panel__inner">
            <div className="landing-panel__logo-wrap">
              <img src="/logo.png" alt={`${BRAND_HI} ${BRAND_EN}`} className="landing-panel__logo" />
            </div>
            <p className="landing-panel__brand-label">{BRAND_EN}</p>
            <p className="landing-panel__brand-hi">{BRAND_HI}</p>
            <p className="landing-panel__lede">{BRAND_TAG}</p>

            <label className="landing-panel__field">
              <span className="landing-panel__field-label">Login type</span>
              <select
                className="landing-panel__select"
                value={active}
                onChange={(e) => setActive(e.target.value as keyof typeof PORTAL_LOGINS)}
              >
                {HUB_ROLES.map((key) => (
                  <option key={key} value={key}>
                    {portalDisplayName(key, PORTAL_LOGINS[key].shortLabel)}
                  </option>
                ))}
              </select>
            </label>

            <div className="landing-panel__pills" role="tablist" aria-label="Choose portal">
              {HUB_ROLES.map((key) => {
                const on = active === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    className={`landing-pill ${on ? "is-on" : ""}`}
                    onClick={() => setActive(key)}
                  >
                    {portalDisplayName(key, PORTAL_LOGINS[key].shortLabel)}
                  </button>
                );
              })}
            </div>

            <div className="landing-panel__form-card">
              <p className="landing-panel__form-eyebrow">{cfg.title}</p>
              <p className="landing-panel__form-hint">{cfg.points[0]}</p>
              <PortalSignInForm cfg={cfg} dark />
            </div>
          </div>
        </div>

        <footer className="landing-panel__foot">
          <span>
            © {new Date().getFullYear()} {BRAND_EN}
          </span>
          <span>{BRAND_HI}</span>
        </footer>
      </section>
    </div>
  );
}
