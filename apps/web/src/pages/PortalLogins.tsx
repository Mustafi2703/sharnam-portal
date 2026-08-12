import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import type { AuthUser, RoleKey } from "@sharnam/shared";
import { setActiveWorkspace, clearStoredProjectId, type WorkspaceKey } from "../workspaces";

/** Sharnam login — hub /login · per-portal /login/:key */

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
  policies: string[];
};

export const PORTAL_LOGINS: Record<string, PortalConfig> = {
  master: {
    key: "master", title: "Master", shortLabel: "Master",
    headline: "Set up every project from one desk.",
    subtitle: "Create projects, enable modules, HRM assign, CRM, and master documents.",
    demoEmail: "office@sharnam.demo", allowedRoles: ["admin", "office"],
    points: ["Projects · modules", "Directory · access", "Master documents"],
    cta: "Enter Master", tone: "#1E3A8A", icon: "MS",
    landingPath: "/master", workspaceKey: null, group: "master",
    policies: [],
  },
  office: {
    key: "office", title: "Office", shortLabel: "Office",
    headline: "Full control desk.",
    subtitle: "Master, CRM, HRMS, cost, and every project module.",
    demoEmail: "office@sharnam.demo", allowedRoles: ["office", "admin"],
    points: ["Access & roles", "All modules", "Reports · Audit"],
    cta: "Enter Office", tone: "#0B6A78", icon: "OF",
    landingPath: "/dashboard", workspaceKey: null, group: "role",
    policies: [],
  },
  site: {
    key: "site", title: "Site", shortLabel: "Site",
    headline: "Field tools for site teams.",
    subtitle: "Day logs, checklist fills, photos, and site RFIs.",
    demoEmail: "site@sharnam.demo", allowedRoles: ["site_employee"],
    points: ["Day log", "Checklist fills", "Photos · Site RFI"],
    cta: "Enter Site", tone: "#15803D", icon: "ST",
    landingPath: "/attendance", workspaceKey: "field", group: "role",
    policies: [],
  },
  employee: {
    key: "employee", title: "Employee", shortLabel: "Employee",
    headline: "Your workday desk.",
    subtitle: "Assigned projects, drawings, and self-service.",
    demoEmail: "employee@sharnam.demo", allowedRoles: ["employee", "office"],
    points: ["Projects", "Drawings", "Self-service"],
    cta: "Enter Employee", tone: "#64748B", icon: "EM",
    landingPath: "/dashboard", group: "role",
    policies: [],
  },
  vendor: {
    key: "vendor", title: "Contractor", shortLabel: "Contractor",
    headline: "Trade partner portal.",
    subtitle: "Assigned packages, RFI fills, and site evidence.",
    demoEmail: "vendor@sharnam.demo", allowedRoles: ["vendor"],
    points: ["Assigned projects", "Fill RFIs", "Checklists"],
    cta: "Enter Contractor", tone: "#C45C26", icon: "VN",
    landingPath: "/workspace", workspaceKey: "drawings", group: "role",
    policies: [],
  },
  client: {
    key: "client", title: "Client", shortLabel: "Client",
    headline: "Owner clarity on every sheet.",
    subtitle: "Published GFC, progress, reports, and concerns.",
    demoEmail: "client@sharnam.demo", allowedRoles: ["client"],
    points: ["Published drawings", "Progress", "Concerns"],
    cta: "Enter Client", tone: "#1E40AF", icon: "CL",
    landingPath: "/dashboard", workspaceKey: "progress", group: "role",
    policies: [],
  },
  drawings: {
    key: "drawings", title: "Drawings", shortLabel: "Drawings",
    headline: "GFC register and project Documents.",
    subtitle: "Upload sheets, DMS, Drawing Check Master, Ask.",
    demoEmail: "office@sharnam.demo",
    allowedRoles: ["admin", "office", "employee", "site_employee", "vendor"],
    points: ["GFC register", "Checklist manager", "Ask"],
    cta: "Enter Drawings", tone: "#1D4ED8", icon: "DW",
    landingPath: "/workspace", workspaceKey: "drawings", group: "module",
    policies: [],
  },
  quality: {
    key: "quality", title: "Quality", shortLabel: "Quality",
    headline: "QI, NCR, Cube, and QAP.",
    subtitle: "Separate tools per sheet — inspections and registers.",
    demoEmail: "site@sharnam.demo",
    allowedRoles: ["admin", "office", "employee", "site_employee", "vendor"],
    points: ["QI dashboard", "NCR / CAR", "Cube · QAP"],
    cta: "Enter Quality", tone: "#15803D", icon: "QA",
    landingPath: "/workspace", workspaceKey: "quality", group: "module",
    policies: [],
  },
  comms: {
    key: "comms", title: "Communications", shortLabel: "Comms",
    headline: "Matrix → Agenda → MoM → Follow-up.",
    subtitle: "Meetings, Ask RFI, and Outlook outbox.",
    demoEmail: "office@sharnam.demo",
    allowedRoles: ["admin", "office", "employee", "site_employee"],
    points: ["Matrix", "MoM", "Ask · Outlook"],
    cta: "Enter Comms", tone: "#2563EB", icon: "CM",
    landingPath: "/workspace", workspaceKey: "comms", group: "module",
    policies: [],
  },
  hr: {
    key: "hr", title: "HR admin", shortLabel: "HR",
    headline: "Recruitment · Attendance · Payroll · Audit.",
    subtitle: "Dedicated HRMS desk for HR administrators.",
    demoEmail: "office@sharnam.demo",
    allowedRoles: ["admin", "office"],
    points: ["Recruit → Offer → Onboard", "Geo-attendance · Leave", "Payroll · Audit"],
    cta: "Enter HR admin", tone: "#6D28D9", icon: "HR",
    landingPath: "/hrm", workspaceKey: null, group: "role",
    policies: [],
  },
  field: {
    key: "field", title: "Field", shortLabel: "Field",
    headline: "Day log, photos, site RFIs.",
    subtitle: "Field evidence on the project spine.",
    demoEmail: "site@sharnam.demo",
    allowedRoles: ["admin", "office", "site_employee", "employee", "vendor"],
    points: ["Day log", "Photos", "Field RFIs"],
    cta: "Enter Field", tone: "#DC2626", icon: "FD",
    landingPath: "/workspace", workspaceKey: "field", group: "module",
    policies: [],
  },
};

export function consumeLoginLanding(fallback = "/dashboard") {
  try {
    const path = localStorage.getItem(LOGIN_LANDING_KEY);
    if (path) {
      localStorage.removeItem(LOGIN_LANDING_KEY);
      return path;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export const HUB_PORTALS: (keyof typeof PORTAL_LOGINS)[] = ["office", "site", "vendor", "client"];

/** Cinematic hero per portal — each login gets a distinct construction / PMC photo */
const PORTAL_HERO: Record<string, string> = {
  hub: "/auth/hero-hub.jpg",
  master: "/auth/hero-master.jpg",
  office: "/auth/hero-office.jpg",
  site: "/auth/hero-site.jpg",
  employee: "/auth/hero-employee.jpg",
  vendor: "/auth/hero-vendor.jpg",
  client: "/auth/hero-client.jpg",
  drawings: "/auth/hero-drawings.jpg",
  quality: "/auth/hero-quality.jpg",
  comms: "/auth/hero-comms.jpg",
  hr: "/auth/hero-hr.jpg",
  field: "/auth/hero-field.jpg",
};

function portalHero(key: string) {
  return PORTAL_HERO[key] ?? "/auth/hero-construction-wide.jpg";
}

function portalDisplayName(key: string, shortLabel: string) {
  if (key === "vendor") return "Contractor";
  return shortLabel;
}

function AuthLogo({ size = "md" }: { size?: "xs" | "sm" | "md" | "lg" }) {
  const widths = { xs: 132, sm: 168, md: 240, lg: 360 };
  return (
    <div className={`auth-logo auth-logo--${size}`}>
      <img
        src="/logo-transparent.png?v=9"
        alt="शरणम्"
        className="auth-logo__img"
        width={widths[size]}
        height={Math.round(widths[size] * 0.48)}
        decoding="async"
      />
    </div>
  );
}

function AuthScene() {
  return (
    <div className="auth-scene" aria-hidden>
      <div className="auth-scene__photo" />
      <div className="auth-scene__shade" />
    </div>
  );
}

function BrandMark({ showTagline = true }: { showTagline?: boolean }) {
  return (
    <div className="auth-brand">
      <img
        src="/logo-transparent.png?v=9"
        alt="शरणम् — Sharnam Project Management Consultants"
        className="auth-brand__logo"
        width={820}
        height={400}
        decoding="async"
        fetchPriority="high"
      />
      {showTagline ? (
        <p className="auth-brand__tagline">Project Management Consultants</p>
      ) : null}
    </div>
  );
}

function SignInCard({ cfg }: { cfg: PortalConfig }) {
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await api<{ token: string; user: AuthUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          password,
          allowedRoles: cfg.allowedRoles,
          portal: cfg.key,
        }),
      });
      const dest = cfg.landingPath || "/dashboard";
      try {
        localStorage.setItem(LOGIN_LANDING_KEY, dest);
        clearStoredProjectId();
        if (cfg.workspaceKey) setActiveWorkspace(cfg.workspaceKey);
        else setActiveWorkspace(null);
      } catch {
        /* ignore */
      }
      loginWithToken(data.token, data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setBusy(false);
    }
  }

  return (
    <div className="auth-signin" style={{ ["--portal-accent" as string]: cfg.tone } as CSSProperties}>
      <div className="auth-signin__badge">
        <span className="auth-signin__badge-icon" aria-hidden>{cfg.icon}</span>
        <span>{portalDisplayName(cfg.key, cfg.shortLabel)} portal</span>
      </div>
      <h2 className="auth-signin__title">Sign in</h2>
      <p className="auth-signin__sub">{cfg.subtitle}</p>

      <form className="auth-signin__form" onSubmit={onSubmit}>
        <label className="auth-signin__field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            placeholder="you@company.com"
          />
        </label>
        <label className="auth-signin__field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            placeholder="••••••••"
          />
        </label>
        {error && <p className="auth-signin__error" role="alert">{error}</p>}
        <button type="submit" className="auth-signin__submit" disabled={busy}>
          {busy ? "Signing in…" : cfg.cta}
        </button>
      </form>

      <p className="auth-signin__demo">
        Demo: <strong>{cfg.demoEmail}</strong> · password <strong>Demo@1234</strong>
      </p>
    </div>
  );
}

function AuthMobileNav({ backTo, logoSize = "sm" }: { backTo?: string; logoSize?: "xs" | "sm" | "md" }) {
  return (
    <nav className={`auth-mobile-nav${backTo ? "" : " auth-mobile-nav--center"}`} aria-label="Login navigation">
      {backTo ? (
        <Link to={backTo} className="auth-mobile-nav__back">
          ← All portals
        </Link>
      ) : null}
      <AuthLogo size={logoSize} />
    </nav>
  );
}

function useAuthPageScroll() {
  useEffect(() => {
    document.documentElement.classList.add("is-auth-route");
    document.body.classList.add("is-auth-route");
    document.documentElement.style.colorScheme = "light";
    return () => {
      document.documentElement.classList.remove("is-auth-route");
      document.body.classList.remove("is-auth-route");
      document.documentElement.style.colorScheme = "";
    };
  }, []);
}

export function PortalLoginPage({ portalKey }: { portalKey: keyof typeof PORTAL_LOGINS }) {
  const cfg = PORTAL_LOGINS[portalKey];
  const { user, loading } = useAuth();
  useAuthPageScroll();
  if (!cfg) return <Navigate to="/login" replace />;
  if (!loading && user) return <Navigate to={consumeLoginLanding(cfg.landingPath || "/dashboard")} replace />;

  return (
    <div
      className="auth-layout auth-layout--portal"
      data-portal={portalKey}
      style={
        {
          ["--portal-accent" as string]: cfg.tone,
          ["--auth-hero" as string]: `url(${portalHero(portalKey)})`,
        } as CSSProperties
      }
    >
      <AuthScene />
      <AuthMobileNav backTo="/login" />
      <aside
        className="auth-layout__brand auth-layout__brand--portal"
      >
        <BrandMark showTagline={false} />
        <div className="auth-layout__portal-intro">
          <span className="auth-layout__portal-chip">{cfg.icon}</span>
          <h1 className="auth-layout__portal-headline">{cfg.headline}</h1>
          <p className="auth-layout__portal-sub">{cfg.subtitle}</p>
          <ul className="auth-layout__portal-points">
            {cfg.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
        <Link to="/login" className="auth-layout__back">
          ← All portals
        </Link>
      </aside>
      <main className="auth-layout__main auth-layout__main--portal">
        <div className="auth-mobile-intro auth-mobile-intro--portal">
          <span className="auth-layout__portal-chip">{cfg.icon}</span>
          <h1 className="auth-layout__portal-headline">{cfg.headline}</h1>
          <p className="auth-layout__portal-sub">{cfg.subtitle}</p>
        </div>
        <SignInCard cfg={cfg} />
      </main>
    </div>
  );
}

function PortalHubCard({ cfg }: { cfg: PortalConfig }) {
  return (
    <Link
      to={`/login/${cfg.key}`}
      className="auth-hub-card"
      style={{ ["--portal-accent" as string]: cfg.tone } as CSSProperties}
    >
      <span className="auth-hub-card__icon" aria-hidden>{cfg.icon}</span>
      <div className="auth-hub-card__body">
        <span className="auth-hub-card__label">{portalDisplayName(cfg.key, cfg.shortLabel)}</span>
        <span className="auth-hub-card__headline">{cfg.headline}</span>
        <span className="auth-hub-card__hint">{cfg.points[0]}</span>
      </div>
      <span className="auth-hub-card__arrow" aria-hidden>→</span>
    </Link>
  );
}

export function LoginHubPage() {
  const { user, loading } = useAuth();
  useAuthPageScroll();
  if (!loading && user) return <Navigate to={consumeLoginLanding()} replace />;

  return (
    <div
      className="auth-layout auth-layout--hub"
      style={
        {
          ["--portal-accent" as string]: "#0B6A78",
          ["--auth-hero" as string]: `url(${portalHero("hub")})`,
        } as CSSProperties
      }
    >
      <AuthScene />
      <AuthMobileNav logoSize="md" />
      <aside className="auth-layout__brand auth-layout__brand--hub">
        <BrandMark />
        <p className="auth-layout__hero-copy">
          Drawings, quality, site logs, meetings, cost, and reports — one workspace for every role on your project.
        </p>
      </aside>
      <main className="auth-layout__main auth-layout__main--hub">
        <header className="auth-hub__header">
          <h1 className="auth-hub__title">Choose your portal</h1>
          <p className="auth-hub__sub">Select the desk that matches your role on the project.</p>
        </header>
        <div className="auth-hub__grid">
          {HUB_PORTALS.map((k) => (
            <PortalHubCard key={k} cfg={PORTAL_LOGINS[k]} />
          ))}
        </div>
      </main>
    </div>
  );
}
