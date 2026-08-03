import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import type { AuthUser, RoleKey } from "@sharnam/shared";
import { setActiveWorkspace, clearStoredProjectId, type WorkspaceKey } from "../workspaces";

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
    points: ["Create projects", "HRM & directory", "Master documents (DMS)"],
    cta: "Enter Master",
    tone: "#1E3A8A",
    icon: "MS",
    landingPath: "/dashboard",
    workspaceKey: null,
    group: "master",
  },
  drawings: {
    key: "drawings",
    title: "Drawings",
    shortLabel: "Drawings",
    headline: "GFC register and project Documents.",
    subtitle: "Upload sheets, manage DMS, attach checklists.",
    demoEmail: "office@sharnam.demo",
    allowedRoles: ["admin", "office", "employee", "site_employee", "vendor"],
    points: ["GFC register", "Documents (DMS)"],
    cta: "Enter Drawings",
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
    headline: "Quality inspections and site checklists.",
    subtitle: "QI, Safety, and site checklists.",
    demoEmail: "site@sharnam.demo",
    allowedRoles: ["admin", "office", "employee", "site_employee", "vendor"],
    points: ["Quality Inspections", "Safety"],
    cta: "Enter Quality",
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
    headline: "Matrix → meeting → MoM.",
    subtitle: "Meetings, Ask RFI, and Outlook.",
    demoEmail: "office@sharnam.demo",
    allowedRoles: ["admin", "office", "employee", "site_employee"],
    points: ["Matrix", "MoM"],
    cta: "Enter Comms",
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
    subtitle: "Field evidence for the project spine.",
    demoEmail: "site@sharnam.demo",
    allowedRoles: ["admin", "office", "site_employee", "employee", "vendor"],
    points: ["Day log", "Photos"],
    cta: "Enter Field",
    tone: "#DC2626",
    icon: "FD",
    landingPath: "/dashboard",
    workspaceKey: "field",
    group: "module",
  },
  office: {
    key: "office",
    title: "Office",
    shortLabel: "Office",
    headline: "Full control desk.",
    subtitle: "Master, CRM, HRMS, cost, and every module.",
    demoEmail: "office@sharnam.demo",
    allowedRoles: ["office", "admin"],
    points: ["Access & roles", "All modules"],
    cta: "Enter Office",
    tone: "#0B6A78",
    icon: "OF",
    landingPath: "/dashboard",
    workspaceKey: null,
    group: "role",
  },
  site: {
    key: "site",
    title: "Site",
    shortLabel: "Site",
    headline: "Field tools for site teams.",
    subtitle: "Day logs, checklist fills, revisions.",
    demoEmail: "site@sharnam.demo",
    allowedRoles: ["site_employee"],
    points: ["Day log", "Checklist fills"],
    cta: "Enter Site",
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
    headline: "Your workday desk.",
    subtitle: "Projects and self-service.",
    demoEmail: "employee@sharnam.demo",
    allowedRoles: ["employee", "office"],
    points: ["Projects", "Self-service"],
    cta: "Enter Employee",
    tone: "#64748B",
    icon: "EM",
    landingPath: "/dashboard",
    group: "role",
  },
  vendor: {
    key: "vendor",
    title: "Contractor",
    shortLabel: "Contractor",
    headline: "Trade partner portal.",
    subtitle: "Assigned projects and RFI fills.",
    demoEmail: "vendor@sharnam.demo",
    allowedRoles: ["vendor"],
    points: ["Assigned projects", "Fill RFIs"],
    cta: "Enter Contractor",
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
    subtitle: "Published GFC and concerns.",
    demoEmail: "client@sharnam.demo",
    allowedRoles: ["client"],
    points: ["Drawings", "Concerns"],
    cta: "Enter Client",
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

/** Project / building slides — brighter site photography */
const HERO_SLIDES = [
  { src: "/heroes/site-06.jpg", w: 2400, h: 1597, focus: "50% 38%" },
  { src: "/heroes/site-02.jpg", w: 2400, h: 1600, focus: "50% 40%" },
  { src: "/heroes/site-08.jpg", w: 2400, h: 1590, focus: "52% 42%" },
  { src: "/heroes/site-03.jpg", w: 2400, h: 1600, focus: "48% 35%" },
  { src: "/heroes/site-07.jpg", w: 2400, h: 1600, focus: "50% 28%" },
  { src: "/heroes/site-01.jpg", w: 2400, h: 1350, focus: "50% 38%" },
];

const HERO_POLICIES = [
  "Published GFC before site execution",
  "Revision control with full audit trail",
  "Quality & safety checklists on every package",
  "Project-scoped access for office, site & contractors",
];

function portalDisplayName(key: string, shortLabel: string) {
  if (key === "vendor") return "Contractor";
  return shortLabel;
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

  async function onSubmit(e: React.FormEvent) {
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
      try {
        localStorage.setItem(LOGIN_LANDING_KEY, cfg.landingPath || "/dashboard");
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
    <form className="auth-form" onSubmit={onSubmit}>
      <label className="auth-form__label">
        Email
        <input
          className="auth-form__input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
      </label>
      <label className="auth-form__label">
        Password
        <input
          className="auth-form__input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      {error && <p className="auth-form__error">{error}</p>}
      <button type="submit" className="auth-form__submit" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

function HeroStage() {
  const [slide, setSlide] = useState(0);
  const [policy, setPolicy] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setSlide((s) => (s + 1) % HERO_SLIDES.length), 6000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setPolicy((p) => (p + 1) % HERO_POLICIES.length), 4000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <aside className="auth-hero">
      <div className="auth-hero__stage">
        {HERO_SLIDES.map((s, i) => (
          <img
            key={s.src}
            src={s.src}
            alt=""
            width={s.w}
            height={s.h}
            sizes="(max-width: 900px) 100vw, 60vw"
            className={`auth-hero__img ${i === slide ? "is-active" : ""}`}
            style={{ objectPosition: s.focus }}
            decoding={i === 0 ? "sync" : "async"}
            fetchPriority={i === 0 ? "high" : "low"}
            loading={i === 0 ? "eager" : "lazy"}
          />
        ))}
        <div className="auth-hero__veil" aria-hidden />
      </div>

      <div className="auth-hero__center">
        <div className="auth-hero__brand">
          <img
            src="/logo.png"
            alt="शरणम्"
            className="auth-hero__logo"
            width={720}
            height={350}
            decoding="sync"
            fetchPriority="high"
          />
          <p className="auth-hero__name">Sharnam</p>
          <p className="auth-hero__trade">Project Management Consultants</p>
        </div>

        <div className="auth-hero__policies" aria-live="polite">
          {HERO_POLICIES.map((text, i) => (
            <p key={text} className={`auth-hero__policy ${i === policy ? "is-on" : ""}`}>
              <span className="auth-hero__bullet" aria-hidden />
              {text}
            </p>
          ))}
        </div>
      </div>

      <div className="auth-hero__dots" role="tablist" aria-label="Project photos">
        {HERO_SLIDES.map((s, i) => (
          <button
            key={s.src}
            type="button"
            aria-label={`Photo ${i + 1}`}
            className={`auth-hero__dot ${i === slide ? "is-on" : ""}`}
            onClick={() => setSlide(i)}
          />
        ))}
      </div>
    </aside>
  );
}

function AuthCard({
  active,
  onChange,
  backLink,
}: {
  active: keyof typeof PORTAL_LOGINS;
  onChange?: (key: keyof typeof PORTAL_LOGINS) => void;
  backLink?: boolean;
}) {
  const cfg = PORTAL_LOGINS[active];
  return (
    <div className="auth-card">
      <img src="/logo.png" alt="शरणम्" className="auth-card__logo" width={420} height={205} />
      <p className="auth-card__firm">Project Management Consultants</p>

      <p className="auth-card__welcome">Sign in</p>

      {backLink && (
        <Link to="/login" className="auth-card__back">
          ← All portals
        </Link>
      )}

      {onChange ? (
        <label className="auth-card__field">
          <span>Portal</span>
          <select
            className="auth-card__select"
            value={active}
            onChange={(e) => onChange(e.target.value as keyof typeof PORTAL_LOGINS)}
          >
            {HUB_ROLES.map((key) => (
              <option key={key} value={key}>
                {portalDisplayName(key, PORTAL_LOGINS[key].shortLabel)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="auth-card__portal">{cfg.title}</p>
      )}

      <PortalSignInForm cfg={cfg} />
    </div>
  );
}

export function PortalLoginPage({ portalKey }: { portalKey: keyof typeof PORTAL_LOGINS }) {
  const cfg = PORTAL_LOGINS[portalKey];
  const { user, loading } = useAuth();
  if (!cfg) return <Navigate to="/login" replace />;
  if (!loading && user) return <Navigate to={consumeLoginLanding()} replace />;

  return (
    <div className="auth-shell">
      <HeroStage />
      <section className="auth-side">
        <AuthCard active={portalKey} backLink />
      </section>
    </div>
  );
}

/** Premium sign-in — logo once, one tagline, compact hero, no chrome nav */
export function LoginHubPage() {
  const { user, loading } = useAuth();
  const [active, setActive] = useState<keyof typeof PORTAL_LOGINS>("office");

  if (!loading && user) return <Navigate to={consumeLoginLanding()} replace />;

  return (
    <div className="auth-shell">
      <HeroStage />
      <section className="auth-side">
        <AuthCard active={active} onChange={setActive} />
      </section>
    </div>
  );
}
