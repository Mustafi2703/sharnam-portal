import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import type { AuthUser, RoleKey } from "@sharnam/shared";
import { setActiveWorkspace, clearStoredProjectId, type WorkspaceKey } from "../workspaces";
import { HUB_POLICIES, SHARNAM_PORTAL_POLICIES } from "../lib/portalPolicies";

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
    key: "office", title: "Office", shortLabel: "Office",
    headline: "Full control desk.",
    subtitle: "Master, CRM, HRMS, cost, and every project module.",
    demoEmail: "office@sharnam.demo", allowedRoles: ["office", "admin"],
    points: ["Access & roles", "All modules", "Reports · Audit"],
    cta: "Enter Office", tone: "#0B6A78", icon: "OF",
    landingPath: "/dashboard", workspaceKey: null, group: "role",
    policies: [...SHARNAM_PORTAL_POLICIES, "Office users may assign people to projects and open comparative bids."],
  },
  site: {
    key: "site", title: "Site", shortLabel: "Site",
    headline: "Field tools for site teams.",
    subtitle: "Day logs, checklist fills, photos, and site RFIs.",
    demoEmail: "site@sharnam.demo", allowedRoles: ["site_employee"],
    points: ["Day log", "Checklist fills", "Photos · Site RFI"],
    cta: "Enter Site", tone: "#15803D", icon: "ST",
    landingPath: "/attendance", workspaceKey: "comms", group: "role",
    policies: [...SHARNAM_PORTAL_POLICIES, "Check in with selfie and location before using other site tools."],
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
    key: "vendor", title: "Contractor", shortLabel: "Contractor",
    headline: "Trade partner portal.",
    subtitle: "Fill bid BOQs online, RFIs, and site evidence.",
    demoEmail: "vendor@sharnam.demo", allowedRoles: ["vendor"],
    points: ["My bid uploads", "Fill RFIs", "Checklists"],
    cta: "Enter Contractor", tone: "#C45C26", icon: "VN",
    landingPath: "/crm/vendor-bids", workspaceKey: "drawings", group: "role",
    policies: [...SHARNAM_PORTAL_POLICIES, "Submit BOQs only for packages you are invited to — comparative data is confidential."],
  },
  client: {
    key: "client", title: "Client", shortLabel: "Client",
    headline: "Owner clarity on every sheet.",
    subtitle: "Published GFC, progress, reports, and concerns.",
    demoEmail: "client@sharnam.demo", allowedRoles: ["client"],
    points: ["Published drawings", "Progress", "Concerns"],
    cta: "Enter Client", tone: "#1E40AF", icon: "CL",
    landingPath: "/dashboard", workspaceKey: "progress", group: "role",
    policies: [...SHARNAM_PORTAL_POLICIES, "Client view is read-only on published GFC and reports unless raising a concern."],
  },
  stakeholder: {
    key: "stakeholder", title: "Stakeholders", shortLabel: "Partner PMC",
    headline: "Partner PMC & consultant desk.",
    subtitle: "External PMC firms — coordination, GFC review, meetings, and RFIs on assigned projects.",
    demoEmail: "pmc@sharnam.demo", allowedRoles: ["employee", "office"],
    points: ["Design coordination", "Meetings · MoM", "GFC · Ask RFI"],
    cta: "Enter Partner desk", tone: "#6366F1", icon: "PM",
    landingPath: "/stakeholder", workspaceKey: "drawings", group: "role",
    policies: [
      ...SHARNAM_PORTAL_POLICIES,
      "Partner PMC access is limited to projects you are explicitly assigned to.",
      "Coordination comments and RFIs are attributed and visible to the delivery team.",
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
    key: "hr", title: "HRMS", shortLabel: "HRMS",
    headline: "Dedicated HRMS desk.",
    subtitle: "Separate login for HR team — recruitment, attendance, payroll, and appointment letters.",
    demoEmail: "office@sharnam.demo",
    allowedRoles: ["admin", "office"],
    points: ["Recruit → Offer → Onboard", "Geo-attendance · Leave", "Payroll · Letters"],
    cta: "Enter HRMS", tone: "#0D9488", icon: "HR",
    landingPath: "/hrm", workspaceKey: null, group: "role",
    policies: [...SHARNAM_PORTAL_POLICIES, "HRMS data — payroll, offers, attendance — is restricted to authorised HR staff."],
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

export const HUB_PORTALS: (keyof typeof PORTAL_LOGINS)[] = [
  "office",
  "hr",
  "stakeholder",
  "site",
  "vendor",
  "client",
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
  if (key === "vendor") return "Contractor";
  if (key === "stakeholder") return "Partner PMC";
  return shortLabel;
}

function AuthLogo({ size = "md" }: { size?: "xs" | "sm" | "md" | "lg" }) {
  const widths = { xs: 132, sm: 168, md: 240, lg: 360 };
  return (
    <div className={`auth-logo auth-logo--${size}`}>
      <img
        src="/logo-transparent.png?v=10"
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
        src="/logo-transparent.png?v=10"
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
      <div className="auth-brand__accent" aria-hidden />
    </div>
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

function AuthLeftPanel({ cfg, policies }: { cfg: PortalConfig; policies: readonly string[] }) {
  return (
    <div className="auth-left-panel auth-left-panel--futura">
      <p className="auth-fx__eyebrow">Sharnam secure portal</p>
      <span className="auth-layout__portal-chip auth-layout__portal-chip--futura">{cfg.icon}</span>
      <h1 className="auth-layout__portal-headline">{cfg.headline}</h1>
      <p className="auth-layout__portal-sub">{cfg.subtitle}</p>
      <ul className="auth-layout__portal-points auth-layout__portal-points--futura">
        {cfg.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <div className="auth-policies auth-policies--futura">
        <p className="auth-policies__title">Portal policies</p>
        <ul className="auth-policies__list">
          {policies.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
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
    <div className="auth-signin auth-signin--split auth-signin--futura" style={{ ["--portal-accent" as string]: cfg.tone } as CSSProperties}>
      <div className="auth-signin__main">
        <div className="auth-signin__badge auth-signin__badge--futura">
          <span className="auth-signin__badge-icon" aria-hidden>{cfg.icon}</span>
          <span>{portalDisplayName(cfg.key, cfg.shortLabel)} portal</span>
        </div>
        <h2 className="auth-signin__title">Authenticate</h2>
        <p className="auth-signin__sub">Secure access · encrypted session · audit trail enabled</p>

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

        <p className="auth-signin__demo">
          Demo: <strong>{cfg.demoEmail}</strong> · password <strong>Demo@1234</strong>
        </p>
        <div className="auth-policies auth-policies--mobile">
          <p className="auth-policies__title">Policies</p>
          <ul className="auth-policies__list">
            {(cfg.policies.length ? cfg.policies : SHARNAM_PORTAL_POLICIES).slice(0, 3).map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="auth-signin__brand auth-signin__brand--futura">
        <div className="auth-signin__logo-ring">
          <AuthLogo size="md" />
        </div>
        <p className="auth-signin__brand-tag">शरणम्</p>
        <p className="auth-signin__brand-sub">Project Management Consultants</p>
        <div className="auth-brand__accent auth-brand__accent--futura" aria-hidden />
      </div>
    </div>
  );
}

function AuthMobileNav({
  backTo,
  logoSize = "sm",
}: {
  backTo?: string;
  logoSize?: "xs" | "sm" | "md";
}) {
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

  const policies = cfg.policies.length ? cfg.policies : SHARNAM_PORTAL_POLICIES;

  return (
    <div
      className="auth-layout auth-layout--portal auth-layout--futura"
      data-portal={portalKey}
      style={{ ["--portal-accent" as string]: cfg.tone } as CSSProperties}
    >
      <AuthFuturisticBackdrop />
      <AuthMobileNav backTo="/login" />
      <aside className="auth-layout__brand auth-layout__brand--portal auth-layout__brand--futura">
        <AuthLeftPanel cfg={cfg} policies={policies} />
        <Link to="/login" className="auth-layout__back">
          ← All portals
        </Link>
      </aside>
      <main className="auth-layout__main auth-layout__main--portal auth-layout__main--futura">
        <div className="auth-mobile-intro auth-mobile-intro--portal auth-mobile-intro--futura">
          <span className="auth-layout__portal-chip">{cfg.icon}</span>
          <h1 className="auth-layout__portal-headline">{cfg.headline}</h1>
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
        <span className="auth-hub-card__headline">{cfg.headline}</span>
        <span className="auth-hub-card__hint">{cfg.points[0]}</span>
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
      <AuthMobileNav logoSize="md" />
      <aside className="auth-layout__brand auth-layout__brand--hub auth-layout__brand--futura">
        <BrandMark />
        <p className="auth-layout__hero-copy auth-layout__hero-copy--futura">
          Enterprise PMC workspace — drawings, quality, site execution, cost, CRM, and stakeholder collaboration in one secure portal.
        </p>
        <div className="auth-policies auth-policies--hub auth-policies--futura">
          <p className="auth-policies__title">Portal policies</p>
          <ul className="auth-policies__list">
            {HUB_POLICIES.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      </aside>
      <main className="auth-layout__main auth-layout__main--hub auth-layout__main--futura">
        <header className="auth-hub__header auth-hub__header--futura">
          <p className="auth-fx__eyebrow auth-fx__eyebrow--hub">Select access lane</p>
          <h1 className="auth-hub__title">Choose your portal</h1>
          <p className="auth-hub__sub">Office · HR · Partner PMC · Site · Contractor · Client</p>
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

export function DynamicPortalLoginRoute() {
  const { portalKey } = useParams();
  if (!portalKey || !(portalKey in PORTAL_LOGINS)) return <Navigate to="/login" replace />;
  return <PortalLoginPage portalKey={portalKey as keyof typeof PORTAL_LOGINS} />;
}
