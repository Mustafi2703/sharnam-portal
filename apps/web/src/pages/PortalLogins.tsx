import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import type { AuthUser, RoleKey } from "@sharnam/shared";
import { setActiveWorkspace, clearStoredProjectId, type WorkspaceKey } from "../workspaces";

export const LOGIN_LANDING_KEY = "sharnam_login_landing";

type HeroSlide = { src: string; w: number; h: number; focus: string; label: string };

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
  heroes: HeroSlide[];
  policies: string[];
};

const H = {
  crane: { src: "/heroes/viz-crane.jpg", w: 1920, h: 1280, focus: "55% 40%", label: "Tower crane" },
  frame: { src: "/heroes/viz-frame.jpg", w: 1920, h: 1280, focus: "48% 42%", label: "Structure rising" },
  cad: { src: "/heroes/viz-cad.jpg", w: 1920, h: 1280, focus: "50% 45%", label: "BIM overlay" },
  lift: { src: "/heroes/viz-lift.jpg", w: 1920, h: 1280, focus: "52% 40%", label: "Facade lift" },
} as const;

const VIZ_SET: HeroSlide[] = [H.crane, H.frame, H.cad, H.lift];
const VIZ_SITE: HeroSlide[] = [H.frame, H.lift, H.crane, H.cad];
const VIZ_PLAN: HeroSlide[] = [H.cad, H.crane, H.frame, H.lift];
const VIZ_FIELD: HeroSlide[] = [H.lift, H.frame, H.crane, H.cad];

export const PORTAL_LOGINS: Record<string, PortalConfig> = {
  master: {
    key: "master",
    title: "Master",
    shortLabel: "Master",
    headline: "Set up every project from one desk.",
    subtitle: "Create projects, enable modules, HRM assign, CRM, and master documents.",
    demoEmail: "office@sharnam.demo",
    allowedRoles: ["admin", "office"],
    points: ["Create projects", "Module toggles", "Directory"],
    cta: "Enter Master",
    tone: "#1E3A8A",
    icon: "MS",
    landingPath: "/master",
    workspaceKey: null,
    group: "master",
    heroes: VIZ_PLAN,
    policies: [
      "Enable only the modules each project needs",
      "Directory parties before first RFI or meeting",
      "Master documents live in DMS — not email threads",
      "CRM convert → project with packages intact",
      "Access matrix decides who sees Cost vs Field",
      "Seed sheet packs once — then work in the portal",
    ],
  },
  office: {
    key: "office",
    title: "Office",
    shortLabel: "Office",
    headline: "Full control desk.",
    subtitle: "Master, CRM, HRMS, cost, and every project module.",
    demoEmail: "office@sharnam.demo",
    allowedRoles: ["office", "admin"],
    points: ["Access & roles", "All modules", "Reports"],
    cta: "Enter Office",
    tone: "#0B6A78",
    icon: "OF",
    landingPath: "/dashboard",
    workspaceKey: null,
    group: "role",
    heroes: VIZ_SET,
    policies: [
      "One project spine for office, site, and contractors",
      "Publish GFC before QI and site checklist fills",
      "Cashflow Chart · Forecast · Tracking stay separate tools",
      "DPR / WPR pull live registers — never a second silo",
      "Inspection ≠ Information — label RFIs correctly",
      "Audit trail on uploads, fills, and approvals",
      "Client sees published packs only",
      "Close open RFIs before weekly pack freeze",
    ],
  },
  site: {
    key: "site",
    title: "Site",
    shortLabel: "Site",
    headline: "Field tools for site teams.",
    subtitle: "Day logs, checklist fills, photos, and site RFIs.",
    demoEmail: "site@sharnam.demo",
    allowedRoles: ["site_employee"],
    points: ["Day log", "Checklist fills", "Photos"],
    cta: "Enter Site",
    tone: "#15803D",
    icon: "ST",
    landingPath: "/workspace",
    workspaceKey: "field",
    group: "role",
    heroes: VIZ_SITE,
    policies: [
      "Log manpower and weather before leave time",
      "Attach photos to checklist items as required",
      "Use published drawings only for fills",
      "Raise field RFIs with ball-in-court clear",
      "Hindrance logged the same day it occurs",
      "Safety observations same shift — no next-day backlog",
      "NCR / CAR with location and package",
    ],
  },
  employee: {
    key: "employee",
    title: "Employee",
    shortLabel: "Employee",
    headline: "Your workday desk.",
    subtitle: "Assigned projects, drawings, and self-service.",
    demoEmail: "employee@sharnam.demo",
    allowedRoles: ["employee", "office"],
    points: ["Projects", "Drawings", "Self-service"],
    cta: "Enter Employee",
    tone: "#64748B",
    icon: "EM",
    landingPath: "/dashboard",
    group: "role",
    heroes: VIZ_PLAN,
    policies: [
      "Work only on projects you are assigned to",
      "Revision control before marking drawings published",
      "Fill requested checklists within the due window",
      "Coordination issues escalate to Ask when stuck",
      "Keep MoM actions owned and dated",
      "Self-service leave / diary stays in HRMS — not Field day log",
    ],
  },
  vendor: {
    key: "vendor",
    title: "Contractor",
    shortLabel: "Contractor",
    headline: "Trade partner portal.",
    subtitle: "Assigned packages, RFI fills, and site evidence.",
    demoEmail: "vendor@sharnam.demo",
    allowedRoles: ["vendor"],
    points: ["Assigned projects", "Fill RFIs", "Checklists"],
    cta: "Enter Contractor",
    tone: "#C45C26",
    icon: "VN",
    landingPath: "/workspace",
    workspaceKey: "drawings",
    group: "role",
    heroes: VIZ_FIELD,
    policies: [
      "Respond to inspection requests with checklist + photos",
      "Use only published GFC for execution",
      "Close ball-in-court RFIs with clear answer",
      "Upload evidence against the package named in the ask",
      "Safety NCR corrective action before rework starts",
      "No cross-project data — stay in assigned jobs",
    ],
  },
  client: {
    key: "client",
    title: "Client",
    shortLabel: "Client",
    headline: "Owner clarity on every sheet.",
    subtitle: "Published GFC, progress, reports, and concerns.",
    demoEmail: "client@sharnam.demo",
    allowedRoles: ["client"],
    points: ["Published drawings", "Progress", "Concerns"],
    cta: "Enter Client",
    tone: "#1E40AF",
    icon: "CL",
    landingPath: "/dashboard",
    workspaceKey: "progress",
    group: "role",
    heroes: VIZ_SET,
    policies: [
      "View published drawings — upload stays with PMC / design",
      "Civil packs: schedule, procurement, S-curve when shared",
      "Raise concerns as Information or Concern — not edits",
      "DPR / WPR packs are read-only on the client desk",
      "Cost and Finance numbers are view-only unless granted",
      "Meeting MoM and agenda appear after PMC publish",
      "Quality / Safety summaries without changing registers",
    ],
  },
  drawings: {
    key: "drawings",
    title: "Drawings",
    shortLabel: "Drawings",
    headline: "GFC register and project Documents.",
    subtitle: "Upload sheets, DMS, Drawing Check Master, Ask.",
    demoEmail: "office@sharnam.demo",
    allowedRoles: ["admin", "office", "employee", "site_employee", "vendor"],
    points: ["GFC register", "Checklist manager", "Ask"],
    cta: "Enter Drawings",
    tone: "#1D4ED8",
    icon: "DW",
    landingPath: "/workspace",
    workspaceKey: "drawings",
    group: "module",
    heroes: VIZ_PLAN,
    policies: [
      "Drawing Check Master unlocks before upload",
      "Revisions R0–R5 with audit who / when",
      "Publish only when checklist fill is complete",
      "Ask is Request for Information — not inspection",
      "Coordination issues escalate cleanly to Ask",
      "DMS folders mirror package structure",
    ],
  },
  quality: {
    key: "quality",
    title: "Quality",
    shortLabel: "Quality",
    headline: "QI, NCR, Cube, and QAP.",
    subtitle: "Separate tools per sheet — inspections and registers.",
    demoEmail: "site@sharnam.demo",
    allowedRoles: ["admin", "office", "employee", "site_employee", "vendor"],
    points: ["QI dashboard", "NCR / CAR", "Cube"],
    cta: "Enter Quality",
    tone: "#15803D",
    icon: "QA",
    landingPath: "/workspace",
    workspaceKey: "quality",
    group: "module",
    heroes: VIZ_SITE,
    policies: [
      "NCR / CAR is its own tool — not buried in QI",
      "Cube register tracks cast / strength / result",
      "QAP Week-50 stays updateable every period",
      "Request for Inspection attaches the checklist",
      "≥3 photos where the template requires them",
      "Published drawing gate before QI create",
    ],
  },
  comms: {
    key: "comms",
    title: "Communications",
    shortLabel: "Comms",
    headline: "Matrix → Agenda → MoM → Follow-up.",
    subtitle: "Meetings, Ask RFI, and Outlook outbox.",
    demoEmail: "office@sharnam.demo",
    allowedRoles: ["admin", "office", "employee", "site_employee"],
    points: ["Matrix", "MoM", "Ask"],
    cta: "Enter Comms",
    tone: "#2563EB",
    icon: "CM",
    landingPath: "/workspace",
    workspaceKey: "comms",
    group: "module",
    heroes: VIZ_PLAN,
    policies: [
      "Matrix parties before first meeting or RFI",
      "Agenda generated before MoM starts",
      "Follow-up owns every open MoM action",
      "Meetings are Microsoft Teams only",
      "Ask is Request for Information",
      "Generated MoM reaches client civil when published",
    ],
  },
  field: {
    key: "field",
    title: "Field",
    shortLabel: "Field",
    headline: "Day log, photos, site RFIs.",
    subtitle: "Field evidence on the project spine.",
    demoEmail: "site@sharnam.demo",
    allowedRoles: ["admin", "office", "site_employee", "employee", "vendor"],
    points: ["Day log", "Photos", "Field RFIs"],
    cta: "Enter Field",
    tone: "#DC2626",
    icon: "FD",
    landingPath: "/workspace",
    workspaceKey: "field",
    group: "module",
    heroes: VIZ_FIELD,
    policies: [
      "Day log ≠ HRMS personal diary",
      "Manpower / equipment lines feed DPR",
      "Photos tagged to date and package when possible",
      "Field RFIs stay operational — not drawing Ask",
      "Close the log before shift end",
      "Site evidence supports hindrance and safety",
    ],
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

function portalDisplayName(key: string, shortLabel: string) {
  if (key === "vendor") return "Contractor";
  return shortLabel;
}

function chipOnStyle(tone: string): CSSProperties {
  return {
    borderColor: tone,
    background: `${tone}18`,
    color: tone,
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
        {busy ? "Signing in…" : cfg.cta}
      </button>
    </form>
  );
}

function HeroStage({ heroes, policies, trade }: { heroes: HeroSlide[]; policies: string[]; trade: string }) {
  const [slide, setSlide] = useState(0);
  const [policy, setPolicy] = useState(0);
  const slideKey = heroes.map((s) => s.src).join("|") || H.crane.src;
  const policyKey = policies.join("|");
  const slides = heroes.length ? heroes : [H.crane];
  const lines = policies.length ? policies : ["Plan · execute · verify on one spine"];

  useEffect(() => {
    setSlide(0);
    setPolicy(0);
  }, [slideKey, policyKey]);

  useEffect(() => {
    const t = window.setInterval(() => setSlide((s) => (s + 1) % slides.length), 6000);
    return () => window.clearInterval(t);
  }, [slideKey, slides.length]);

  useEffect(() => {
    const t = window.setInterval(() => setPolicy((p) => (p + 1) % lines.length), 3800);
    return () => window.clearInterval(t);
  }, [policyKey, lines.length]);

  return (
    <aside className="auth-hero">
      <div className="auth-hero__stage">
        {slides.map((s, i) => (
          <img
            key={s.src}
            src={s.src}
            alt=""
            width={s.w}
            height={s.h}
            sizes="(max-width: 900px) 100vw, 62vw"
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
        <img
          src="/logo.png"
          alt="शरणम्"
          className="auth-hero__logo"
          width={820}
          height={400}
          decoding="sync"
          fetchPriority="high"
        />
        <p className="auth-hero__name">Sharnam</p>
        <p className="auth-hero__trade">{trade}</p>

        <div className="auth-hero__policies" aria-live="polite">
          {lines.map((text, i) => (
            <p key={text} className={`auth-hero__policy ${i === policy ? "is-on" : ""}`}>
              <span className="auth-hero__bullet" aria-hidden />
              {text}
            </p>
          ))}
        </div>
      </div>

      <div className="auth-hero__dots" role="tablist" aria-label="Portal photos">
        {slides.map((s, i) => (
          <button
            key={s.src}
            type="button"
            aria-label={s.label}
            className={`auth-hero__dot ${i === slide ? "is-on" : ""}`}
            onClick={() => setSlide(i)}
          />
        ))}
      </div>
    </aside>
  );
}

function PortalPicker({
  active,
  onPick,
}: {
  active: keyof typeof PORTAL_LOGINS;
  onPick?: (key: keyof typeof PORTAL_LOGINS) => void;
}) {
  return (
    <div className="auth-portals">
      <p className="auth-portals__label">Sign in as</p>
      <div className="auth-portals__row">
        {HUB_ROLES.map((key) => {
          const p = PORTAL_LOGINS[key];
          const on = active === key;
          if (onPick) {
            return (
              <button
                key={key}
                type="button"
                className={`auth-portals__chip ${on ? "is-on" : ""}`}
                style={on ? chipOnStyle(p.tone) : undefined}
                onClick={() => onPick(key)}
              >
                {portalDisplayName(key, p.shortLabel)}
              </button>
            );
          }
          return (
            <Link
              key={key}
              to={`/login/${key}`}
              className={`auth-portals__chip ${on ? "is-on" : ""}`}
              style={on ? chipOnStyle(p.tone) : undefined}
            >
              {portalDisplayName(key, p.shortLabel)}
            </Link>
          );
        })}
      </div>
    </div>
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
    <div className="auth-card" key={cfg.key}>
      <img src="/logo.png" alt="शरणम्" className="auth-card__logo" width={420} height={205} />
      <p className="auth-card__firm">Project Management Consultants</p>

      <p className="auth-card__welcome">{cfg.title}</p>
      <p className="auth-card__sub">{cfg.subtitle}</p>

      {backLink && (
        <Link to="/login" className="auth-card__back">
          ← All portals
        </Link>
      )}

      <PortalPicker active={active} onPick={onChange} />

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
      <HeroStage heroes={cfg.heroes} policies={cfg.policies} trade={cfg.headline} />
      <section className="auth-side">
        <AuthCard active={portalKey} backLink />
      </section>
    </div>
  );
}

/** Hub login — pick user type, then sign in */
export function LoginHubPage() {
  const { user, loading } = useAuth();
  const [active, setActive] = useState<keyof typeof PORTAL_LOGINS>("office");
  const cfg = PORTAL_LOGINS[active];

  if (!loading && user) return <Navigate to={consumeLoginLanding()} replace />;

  return (
    <div className="auth-shell">
      <HeroStage key={cfg.key} heroes={cfg.heroes} policies={cfg.policies} trade={cfg.headline} />
      <section className="auth-side">
        <AuthCard active={active} onChange={setActive} />
      </section>
    </div>
  );
}
