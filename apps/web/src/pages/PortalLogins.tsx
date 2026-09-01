import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import type { AuthUser, RoleKey } from "@sharnam/shared";
import { setActiveWorkspace, clearStoredProjectId, type WorkspaceKey } from "../workspaces";
import { HUB_LEFT_BULLETS, HUB_LEFT_TAGLINE, SHARNAM_PORTAL_POLICIES } from "../lib/portalPolicies";

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
    policies: [...SHARNAM_PORTAL_POLICIES, "Master desk configures projects, modules, and global templates."],
  },
  office: {
    key: "office", title: "Office & Admin", shortLabel: "Office & Admin",
    headline: "Office & admin desk",
    subtitle: "CRM, projects, bids, reports, and user access.",
    demoEmail: "office@sharnam.demo", allowedRoles: ["office", "admin"],
    points: ["Full PMC modules", "Master setup & CRM", "Roles & audit"],
    cta: "Sign in", tone: "#0B6A78", icon: "OF",
    landingPath: "/dashboard", workspaceKey: null, group: "role",
    policies: [...SHARNAM_PORTAL_POLICIES, "Admin and office users may assign people and open bids."],
  },
  site: {
    key: "site", title: "Site", shortLabel: "Site",
    headline: "Site field desk",
    subtitle: "Attendance, day logs, checklists, and site RFIs.",
    demoEmail: "site@sharnam.demo", allowedRoles: ["site_employee"],
    points: ["Selfie + GPS check-in", "Day logs & checklists", "Photos & RFIs"],
    cta: "Sign in", tone: "#15803D", icon: "ST",
    landingPath: "/attendance", workspaceKey: "comms", group: "role",
    policies: [...SHARNAM_PORTAL_POLICIES, "Check in with selfie and location before other site tools."],
  },
  employee: {
    key: "employee", title: "Employee", shortLabel: "Employee",
    headline: "Your workday desk.",
    subtitle: "Assigned projects, drawings, and self-service.",
    demoEmail: "employee@sharnam.demo", allowedRoles: ["employee", "office"],
    points: ["Projects", "Drawings", "Self-service"],
    cta: "Enter Employee", tone: "#64748B", icon: "EM",
    landingPath: "/dashboard", group: "role",
    policies: [...SHARNAM_PORTAL_POLICIES],
  },
  vendor: {
    key: "vendor", title: "Vendor", shortLabel: "Vendor",
    headline: "Vendor portal",
    subtitle: "Bid BOQs, RFIs, checklists, and site evidence.",
    demoEmail: "vendor@sharnam.demo", allowedRoles: ["vendor"],
    points: ["Comparative bid BOQs", "RFI responses", "Site checklists"],
    cta: "Sign in", tone: "#C45C26", icon: "VN",
    landingPath: "/crm/vendor-bids", workspaceKey: "drawings", group: "role",
    policies: [...SHARNAM_PORTAL_POLICIES, "Submit BOQs only for packages you are invited to."],
  },
  client: {
    key: "client", title: "Client", shortLabel: "Client",
    headline: "Client portal",
    subtitle: "Published GFC, progress, reports, and concerns.",
    demoEmail: "client@sharnam.demo", allowedRoles: ["client"],
    points: ["Published drawings", "Progress reports", "Raise concerns"],
    cta: "Sign in", tone: "#1E40AF", icon: "CL",
    landingPath: "/dashboard", workspaceKey: "progress", group: "role",
    policies: [...SHARNAM_PORTAL_POLICIES, "Read-only on published GFC unless raising a concern."],
  },
  stakeholder: {
    key: "stakeholder", title: "Stakeholders", shortLabel: "Stakeholders",
    headline: "Stakeholder desk",
    subtitle: "Partner PMC — coordination, GFC review, meetings, RFIs.",
    demoEmail: "pmc@sharnam.demo", allowedRoles: ["employee"],
    points: ["Design coordination", "Meetings & MoM", "GFC · RFI"],
    cta: "Sign in", tone: "#6366F1", icon: "PM",
    landingPath: "/stakeholder", workspaceKey: "drawings", group: "role",
    policies: [
      ...SHARNAM_PORTAL_POLICIES,
      "Access limited to projects you are assigned to.",
      "Comments and RFIs are attributed to your account.",
    ],
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
    policies: [...SHARNAM_PORTAL_POLICIES],
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
    policies: [...SHARNAM_PORTAL_POLICIES],
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
    policies: [...SHARNAM_PORTAL_POLICIES],
  },
  hr: {
    key: "hr", title: "HR Team", shortLabel: "HR Team",
    headline: "HRMS desk",
    subtitle: "Recruitment, attendance, leave, payroll, and letters.",
    demoEmail: "office@sharnam.demo",
    allowedRoles: ["admin", "office"],
    points: ["Recruit to onboard", "Attendance & leave", "Payroll & letters"],
    cta: "Sign in", tone: "#0D9488", icon: "HR",
    landingPath: "/hrm", workspaceKey: null, group: "role",
    policies: [...SHARNAM_PORTAL_POLICIES, "HRMS data is restricted to authorised HR staff."],
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

/** Portals shown on /login hub — single vertical stack */
export const HUB_PORTALS: (keyof typeof PORTAL_LOGINS)[] = [
  "office",
  "hr",
  "stakeholder",
  "vendor",
  "client",
  "site",
];

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
  const base = PORTAL_HERO[key] ?? "/auth/hero-construction-wide.jpg";
  return `${base}?v=12`;
}

function portalDisplayName(key: string, shortLabel: string) {
  if (key === "vendor") return "Vendor";
  if (key === "stakeholder") return "Stakeholders";
  if (key === "office") return "Office & Admin";
  if (key === "hr") return "HR Team";
  return shortLabel;
}

function BrandMark({ showTagline = true }: { showTagline?: boolean }) {
  return (
    <div className="auth-brand auth-brand--center">
      <img
        src="/logo-transparent.png?v=10"
        alt="शरणम् — Sharnam Project Management Consultants"
        className="auth-brand__logo auth-brand__logo--hero"
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

function AuthBulletList({ items, className = "" }: { items: readonly string[]; className?: string }) {
  return (
    <ul className={`auth-bullets ${className}`.trim()}>
      {items.slice(0, 3).map((p) => (
        <li key={p}>{p}</li>
      ))}
    </ul>
  );
}

function AuthBrandPanel({ tagline, bullets }: { tagline: string; bullets: readonly string[] }) {
  return (
    <div className="auth-brand-panel">
      <BrandMark />
      <p className="auth-brand-panel__copy">{tagline}</p>
      <AuthBulletList items={bullets} className="auth-bullets--panel" />
    </div>
  );
}

function AuthLeftPanel({ cfg }: { cfg: PortalConfig }) {
  return (
    <AuthBrandPanel
      tagline={cfg.subtitle}
      bullets={cfg.points.slice(0, 3)}
    />
  );
}

function AuthFuturisticBackdrop() {
  return (
    <div className="auth-fx" aria-hidden>
      <div className="auth-fx__mesh" />
      <div className="auth-fx__grid" />
      <div className="auth-fx__orb auth-fx__orb--a" />
      <div className="auth-fx__orb auth-fx__orb--b" />
      <div className="auth-fx__orb auth-fx__orb--c" />
    </div>
  );
}

function SignInCard({ cfg }: { cfg: PortalConfig }) {
  const { loginWithToken } = useAuth();
  const [email, setEmail] = useState(cfg.demoEmail);
  const [password, setPassword] = useState("Demo@1234");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

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
    <div className="auth-signin auth-signin--solo auth-signin--futura" style={{ ["--portal-accent" as string]: cfg.tone } as CSSProperties}>
      <div className="auth-signin__mark">
        <img
          src="/logo-transparent.png?v=10"
          alt="शरणम्"
          className="auth-signin__mark-logo"
          width={168}
          height={81}
          decoding="async"
        />
      </div>
      <div className="auth-signin__badge auth-signin__badge--futura">
        <span className="auth-signin__badge-icon" aria-hidden>{cfg.icon}</span>
        <span>{portalDisplayName(cfg.key, cfg.shortLabel)}</span>
      </div>
      <h2 className="auth-signin__title">Sign in</h2>

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
            <span className="flex items-center justify-between">
              <span>Password</span>
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="text-[10px] uppercase tracking-wide opacity-70 hover:opacity-100"
                tabIndex={-1}
                aria-label={showPwd ? "Hide password" : "Show password"}
              >
                {showPwd ? "Hide" : "Show"}
              </button>
            </span>
            <input
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyUp={(e) => setCapsLock(e.getModifierState && e.getModifierState("CapsLock"))}
              autoComplete="current-password"
              required
              placeholder={showPwd ? "your password" : "••••••••"}
            />
            {capsLock && (
              <span className="text-[10px] mt-1 text-amber-700">Caps Lock is on</span>
            )}
          </label>
          {error && <p className="auth-signin__error" role="alert">{error}</p>}
          <button type="submit" className="auth-signin__submit" disabled={busy}>
            {busy ? "Signing in…" : cfg.cta}
          </button>
        </form>
    </div>
  );
}

function AuthMobileNav({ backTo }: { backTo?: string }) {
  if (!backTo) return null;
  return (
    <nav className="auth-mobile-nav" aria-label="Login navigation">
      <Link to={backTo} className="auth-mobile-nav__back">
        ← All portals
      </Link>
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
      className="auth-layout auth-layout--portal auth-layout--futura"
      data-portal={portalKey}
      style={{ ["--portal-accent" as string]: cfg.tone } as CSSProperties}
    >
      <AuthFuturisticBackdrop />
      <AuthMobileNav backTo="/login" />
      <aside className="auth-layout__brand auth-layout__brand--portal auth-layout__brand--futura">
        <AuthLeftPanel cfg={cfg} />
        <Link to="/login" className="auth-layout__back">
          ← All portals
        </Link>
      </aside>
      <main className="auth-layout__main auth-layout__main--portal auth-layout__main--futura">
        <div className="auth-mobile-brand auth-mobile-brand--portal">
          <AuthBrandPanel tagline={cfg.subtitle} bullets={cfg.points.slice(0, 3)} />
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
      className="auth-hub-card auth-hub-card--futura"
      style={{ ["--portal-accent" as string]: cfg.tone } as CSSProperties}
    >
      <span className="auth-hub-card__icon auth-hub-card__icon--futura" aria-hidden>{cfg.icon}</span>
      <div className="auth-hub-card__body">
        <span className="auth-hub-card__label">{portalDisplayName(cfg.key, cfg.shortLabel)}</span>
        <span className="auth-hub-card__hint">{cfg.subtitle}</span>
      </div>
      <span className="auth-hub-card__arrow auth-hub-card__arrow--futura" aria-hidden>→</span>
    </Link>
  );
}

export function LoginHubPage() {
  const { user, loading } = useAuth();
  useAuthPageScroll();
  if (!loading && user) return <Navigate to={consumeLoginLanding()} replace />;

  return (
    <div
      className="auth-layout auth-layout--hub auth-layout--futura"
      style={{ ["--portal-accent" as string]: "#0B6A78" } as CSSProperties}
    >
      <AuthFuturisticBackdrop />
      <AuthMobileNav />
      <aside className="auth-layout__brand auth-layout__brand--hub auth-layout__brand--futura">
        <AuthBrandPanel tagline={HUB_LEFT_TAGLINE} bullets={HUB_LEFT_BULLETS} />
      </aside>
      <main className="auth-layout__main auth-layout__main--hub auth-layout__main--futura">
        <div className="auth-mobile-brand auth-mobile-brand--hub">
          <AuthBrandPanel tagline={HUB_LEFT_TAGLINE} bullets={HUB_LEFT_BULLETS} />
        </div>
        <header className="auth-hub__header auth-hub__header--futura">
          <h1 className="auth-hub__title">Choose your portal</h1>
        </header>
        <div className="auth-hub__stack">
          {HUB_PORTALS.map((k) => (
            <PortalHubCard key={k} cfg={PORTAL_LOGINS[k]} />
          ))}
        </div>
      </main>
    </div>
  );
}

export function DynamicPortalLoginRoute() {
  const { portalKey } = useParams();
  if (!portalKey || !(portalKey in PORTAL_LOGINS)) return <Navigate to="/login" replace />;
  return <PortalLoginPage portalKey={portalKey as keyof typeof PORTAL_LOGINS} />;
}
