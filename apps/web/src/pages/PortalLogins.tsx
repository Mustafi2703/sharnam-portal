import { useEffect, useRef, useState } from "react";
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

/** High-res project / building slides — focus points keep subjects centered */
const HERO_SLIDES = [
  { src: "/heroes/site-02.jpg", w: 2400, h: 1600, focus: "52% 42%", label: "Site works" },
  { src: "/heroes/site-03.jpg", w: 2400, h: 1590, focus: "48% 38%", label: "Structure" },
  { src: "/heroes/site-04.jpg", w: 2400, h: 1600, focus: "50% 45%", label: "Facade" },
  { src: "/heroes/site-01.jpg", w: 2400, h: 1350, focus: "50% 40%", label: "Campus" },
  { src: "/hero-login.jpg", w: 1920, h: 1080, focus: "45% 35%", label: "Skyline" },
];

const HERO_POLICIES = [
  "Published GFC drawings before site execution",
  "Revision control with full audit trail",
  "Quality & safety checklists on every package",
  "Project-scoped access for office, site & contractors",
  "Client clarity on concerns, RFIs and progress",
  "Cost, cashflow and measurement on one spine",
];

const HERO_MS = 7000;

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
  const [dir, setDir] = useState<"next" | "prev">("next");
  const [paused, setPaused] = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const touchX = useRef<number | null>(null);

  const goTo = (index: number, direction: "next" | "prev" = "next") => {
    setDir(direction);
    setSlide((index + HERO_SLIDES.length) % HERO_SLIDES.length);
    setProgressKey((k) => k + 1);
  };

  useEffect(() => {
    if (paused) return;
    const t = window.setInterval(() => {
      setDir("next");
      setSlide((s) => (s + 1) % HERO_SLIDES.length);
      setProgressKey((k) => k + 1);
    }, HERO_MS);
    return () => window.clearInterval(t);
  }, [paused, progressKey]);

  useEffect(() => {
    const t = window.setInterval(() => setPolicy((p) => (p + 1) % HERO_POLICIES.length), 3800);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goTo(slide + 1, "next");
      if (e.key === "ArrowLeft") goTo(slide - 1, "prev");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slide]);

  function onMove(e: React.MouseEvent<HTMLElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * 14;
    const y = ((e.clientY - r.top) / r.height - 0.5) * 10;
    setParallax({ x, y });
  }

  return (
    <aside
      className={`auth-hero ${paused ? "is-paused" : ""}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        setPaused(false);
        setParallax({ x: 0, y: 0 });
      }}
      onMouseMove={onMove}
      onTouchStart={(e) => {
        touchX.current = e.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        touchX.current = null;
        if (start == null || end == null) return;
        const d = end - start;
        if (Math.abs(d) < 48) return;
        if (d < 0) goTo(slide + 1, "next");
        else goTo(slide - 1, "prev");
      }}
    >
      <div
        className="auth-hero__stage"
        style={{ transform: `translate3d(${parallax.x}px, ${parallax.y}px, 0) scale(1.04)` }}
      >
        {HERO_SLIDES.map((s, i) => {
          const active = i === slide;
          return (
            <div
              key={s.src}
              className={`auth-hero__frame ${active ? "is-active" : ""} ${active ? `is-${dir}` : ""}`}
            >
              <img
                key={active ? `live-${progressKey}` : s.src}
                src={s.src}
                alt={s.label}
                width={s.w}
                height={s.h}
                sizes="(max-width: 900px) 100vw, 58vw"
                className={`auth-hero__img ${active ? "is-ken" : ""}`}
                style={{ objectPosition: s.focus }}
                decoding={i === 0 ? "sync" : "async"}
                fetchPriority={i === 0 ? "high" : "low"}
                loading={i === 0 ? "eager" : "lazy"}
              />
            </div>
          );
        })}
      </div>
      <div className="auth-hero__veil" aria-hidden />
      <div className="auth-hero__grain" aria-hidden />
      <div className="auth-hero__shine" aria-hidden />

      <div className="auth-hero__center">
        <img
          src="/logo.png"
          alt="शरणम्"
          className="auth-hero__logo"
          width={640}
          height={312}
          decoding="sync"
          fetchPriority="high"
        />
        <p className="auth-hero__name">Sharnam</p>
        <p className="auth-hero__trade">Project Management Consultants</p>

        <div className="auth-hero__policies" aria-live="polite">
          {HERO_POLICIES.map((text, i) => (
            <p key={text} className={`auth-hero__policy ${i === policy ? "is-on" : ""}`}>
              <span className="auth-hero__bullet" aria-hidden />
              {text}
            </p>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="auth-hero__nav auth-hero__nav--prev"
        aria-label="Previous photo"
        onClick={() => goTo(slide - 1, "prev")}
      >
        ‹
      </button>
      <button
        type="button"
        className="auth-hero__nav auth-hero__nav--next"
        aria-label="Next photo"
        onClick={() => goTo(slide + 1, "next")}
      >
        ›
      </button>

      <div className="auth-hero__footer">
        <p className="auth-hero__caption">
          <span className="auth-hero__caption-idx">
            {String(slide + 1).padStart(2, "0")} / {String(HERO_SLIDES.length).padStart(2, "0")}
          </span>
          {HERO_SLIDES[slide].label}
        </p>
        <div className="auth-hero__dots" role="tablist" aria-label="Project photos">
          {HERO_SLIDES.map((s, i) => (
            <button
              key={s.src}
              type="button"
              aria-label={s.label}
              aria-selected={i === slide}
              className={`auth-hero__dot ${i === slide ? "is-on" : ""}`}
              onClick={() => goTo(i, i > slide ? "next" : "prev")}
            />
          ))}
        </div>
        <div className="auth-hero__progress" aria-hidden>
          <span key={progressKey} className={`auth-hero__progress-bar ${paused ? "is-paused" : ""}`} />
        </div>
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
      <div className="auth-card__brand">
        <img src="/logo.png" alt="शरणम्" className="auth-card__logo" width={280} height={136} />
        <div className="auth-card__brand-copy">
          <p className="auth-card__brand-name">Sharnam</p>
          <p className="auth-card__firm">Project Management Consultants</p>
        </div>
      </div>

      <div className="auth-card__body">
        <p className="auth-card__welcome">Sign in</p>
        <p className="auth-card__hint">Use your portal credentials to enter the desk.</p>

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
