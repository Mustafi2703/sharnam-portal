import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import type { AuthUser, RoleKey } from "@sharnam/shared";
import { setActiveWorkspace, clearStoredProjectId, type WorkspaceKey } from "../workspaces";

/**
 * Sharnam login — text + block layout. Hub: /login · Per-portal: /login/:key
 */

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
    policies: [
      "Enable only the modules each project needs",
      "Directory parties before first RFI or meeting",
      "Master documents live in DMS — not email threads",
      "CRM convert → project with packages intact",
      "Access matrix decides who sees Cost vs Field",
      "Seed sheet packs once — then work in the portal",
      "Toggle Drawings / Quality / Field per project charter",
      "HRM assign before vendors get package logins",
      "Module desk landings follow enabled tools only",
      "Archive closed projects — keep audit readable",
    ],
  },
  office: {
    key: "office", title: "Office", shortLabel: "Office",
    headline: "Full control desk.",
    subtitle: "Master, CRM, HRMS, cost, and every project module.",
    demoEmail: "office@sharnam.demo", allowedRoles: ["office", "admin"],
    points: ["Access & roles", "All modules", "Reports · Audit"],
    cta: "Enter Office", tone: "#0B6A78", icon: "OF",
    landingPath: "/dashboard", workspaceKey: null, group: "role",
    policies: [
      "One project spine for office, site, and contractors",
      "Publish GFC before QI and site checklist fills",
      "Cashflow Chart · Forecast · Tracking stay separate tools",
      "DPR / WPR pull live registers — never a second silo",
      "Inspection ≠ Information — label RFIs correctly",
      "Audit trail on uploads, fills, and approvals",
      "Client sees published packs only",
      "Close open RFIs before weekly pack freeze",
      "Measurement books lock before payment advice",
      "Safety NCR and QI NCR never share one register",
      "Teams meetings only — Matrix parties first",
      "Email outbox uses project Outlook settings",
    ],
  },
  site: {
    key: "site", title: "Site", shortLabel: "Site",
    headline: "Field tools for site teams.",
    subtitle: "Day logs, checklist fills, photos, and site RFIs.",
    demoEmail: "site@sharnam.demo", allowedRoles: ["site_employee"],
    points: ["Day log", "Checklist fills", "Photos · Site RFI"],
    cta: "Enter Site", tone: "#15803D", icon: "ST",
    landingPath: "/attendance", workspaceKey: "field", group: "role",
    policies: [
      "Log manpower and weather before leave time",
      "Attach photos to checklist items as required",
      "Use published drawings only for fills",
      "Raise field RFIs with ball-in-court clear",
      "Hindrance logged the same day it occurs",
      "Safety observations same shift — no next-day backlog",
      "NCR / CAR with location and package",
      "Day log closes before shift handover",
      "Equipment idle hours feed the DPR line",
      "Tag photos to date, zone, and package",
      "Request for Inspection needs checklist attached",
      "No fill on superseded revision numbers",
    ],
  },
  employee: {
    key: "employee", title: "Employee", shortLabel: "Employee",
    headline: "Your workday desk.",
    subtitle: "Assigned projects, drawings, and self-service.",
    demoEmail: "employee@sharnam.demo", allowedRoles: ["employee", "office"],
    points: ["Projects", "Drawings", "Self-service"],
    cta: "Enter Employee", tone: "#64748B", icon: "EM",
    landingPath: "/dashboard", group: "role",
    policies: [
      "Work only on projects you are assigned to",
      "Revision control before marking drawings published",
      "Fill requested checklists within the due window",
      "Coordination issues escalate to Ask when stuck",
      "Keep MoM actions owned and dated",
      "Self-service leave / diary stays in HRMS — not Field day log",
      "Do not edit client-published packs",
      "Upload evidence against the named package",
      "Confirm Drawing Check Master before first upload",
      "Respond to ball-in-court within the SLA window",
    ],
  },
  vendor: {
    key: "vendor", title: "Contractor", shortLabel: "Contractor",
    headline: "Trade partner portal.",
    subtitle: "Assigned packages, RFI fills, and site evidence.",
    demoEmail: "vendor@sharnam.demo", allowedRoles: ["vendor"],
    points: ["Assigned projects", "Fill RFIs", "Checklists"],
    cta: "Enter Contractor", tone: "#C45C26", icon: "VN",
    landingPath: "/workspace", workspaceKey: "drawings", group: "role",
    policies: [
      "Respond to inspection requests with checklist + photos",
      "Use only published GFC for execution",
      "Close ball-in-court RFIs with clear answer",
      "Upload evidence against the package named in the ask",
      "Safety NCR corrective action before rework starts",
      "No cross-project data — stay in assigned jobs",
      "Cube / QI fills require published drawing gate",
      "Trade manpower lines match the day log",
      "Do not mark drawings published — PMC owns publish",
      "Package handover checklist before demobilise",
    ],
  },
  client: {
    key: "client", title: "Client", shortLabel: "Client",
    headline: "Owner clarity on every sheet.",
    subtitle: "Published GFC, progress, reports, and concerns.",
    demoEmail: "client@sharnam.demo", allowedRoles: ["client"],
    points: ["Published drawings", "Progress", "Concerns"],
    cta: "Enter Client", tone: "#1E40AF", icon: "CL",
    landingPath: "/dashboard", workspaceKey: "progress", group: "role",
    policies: [
      "View published drawings — upload stays with PMC / design",
      "Civil packs: schedule, procurement, S-curve when shared",
      "Raise concerns as Information or Concern — not edits",
      "DPR / WPR packs are read-only on the client desk",
      "Cost and Finance numbers are view-only unless granted",
      "Meeting MoM and agenda appear after PMC publish",
      "Quality / Safety summaries without changing registers",
      "Progress % comes from approved measurement — not edits",
      "Ask for clarification via portal Concern, not side email",
      "Published GFC revision is the only site truth",
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
    policies: [
      "Drawing Check Master unlocks before upload",
      "Revisions R0–R5 with audit who / when",
      "Publish only when checklist fill is complete",
      "Ask is Request for Information — not inspection",
      "Coordination issues escalate cleanly to Ask",
      "DMS folders mirror package structure",
      "Supersede old revision when R+1 goes live",
      "TL / discipline tags stay consistent on register",
      "Client portal shows published packs only",
      "File name + drawing number must match the sheet",
    ],
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
    policies: [
      "NCR / CAR is its own tool — not buried in QI",
      "Cube register tracks cast / strength / result",
      "QAP Week-50 stays updateable every period",
      "Request for Inspection attaches the checklist",
      "≥3 photos where the template requires them",
      "Published drawing gate before QI create",
      "Close CAR with evidence before re-inspect",
      "Separate Safety NCR from Quality NCR",
      "Hold points cannot skip without office release",
      "Link QI fill RFI when inspection fails",
    ],
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
    policies: [
      "Matrix parties before first meeting or RFI",
      "Agenda generated before MoM starts",
      "Follow-up owns every open MoM action",
      "Meetings are Microsoft Teams only",
      "Ask is Request for Information",
      "Generated MoM reaches client civil when published",
      "Ball-in-court must name one responsible party",
      "Outlook outbox uses project email settings",
      "Do not start MoM without an agenda pack",
      "Close follow-ups before next weekly meeting",
    ],
  },
  hr: {
    key: "hr", title: "HR admin", shortLabel: "HR",
    headline: "Recruitment · Attendance · Payroll · Audit.",
    subtitle: "Dedicated HRMS desk — separate login link for HR administrators.",
    demoEmail: "office@sharnam.demo",
    allowedRoles: ["admin", "office"],
    points: ["Recruit → Offer → Onboard", "Geo-attendance · Leave", "Payroll · Audit"],
    cta: "Enter HR admin", tone: "#6D28D9", icon: "HR",
    landingPath: "/hrm", workspaceKey: null, group: "role",
    policies: [
      "Recruitment log audits every state change",
      "Pre-joining · Onboarding stateful checklists",
      "Attendance requires GPS + project (geo-fence)",
      "Leave pre-approval before payroll cut-off",
      "Payroll compute reads paid days + hikes",
      "Employee documents stay in HR-only folder",
      "Teams meetings link auto on interview panel",
      "Salary discussion visible to HR + Office only",
      "Compensation revisions require two-step approval",
      "Audit timeline exportable per employee",
    ],
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
    policies: [
      "Day log ≠ HRMS personal diary",
      "Manpower / equipment lines feed DPR",
      "Photos tagged to date and package when possible",
      "Field RFIs stay operational — not drawing Ask",
      "Close the log before shift end",
      "Site evidence supports hindrance and safety",
      "Weather and visitor lines stay on the same day card",
      "Hindrance reason codes match DPR categories",
      "No backdated photos without office note",
      "Safety observation same shift as the event",
    ],
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

function portalDisplayName(key: string, shortLabel: string) {
  if (key === "vendor") return "Contractor";
  return shortLabel;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Shared surface primitives
   ═══════════════════════════════════════════════════════════════════════════════ */

function BrandLockup({
  size = "hero",
  context,
}: {
  size?: "hero" | "compact" | "chrome";
  context?: "hub" | "portal";
}) {
  const contextClass = context ? ` brand-lockup--auth-${context}` : "";
  return (
    <div className={`brand-lockup brand-lockup--${size} brand-lockup--logo-only${contextClass}`}>
      <img
        src="/logo-transparent.png?v=4"
        alt="शरणम्"
        className="brand-lockup__mark"
        width={820}
        height={400}
        decoding="sync"
        fetchPriority="high"
      />
    </div>
  );
}

function SignInCard({ cfg, formOnly = false }: { cfg: PortalConfig; formOnly?: boolean }) {
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
    <div className="signin-card signin-card--panel" style={{ ["--card-tone" as string]: cfg.tone } as CSSProperties}>
      <div className="signin-card__accent signin-card__accent--glow" aria-hidden />
      <div className="signin-card__body">
        {!formOnly && (
          <div className="signin-card__head">
            <span className="signin-card__eyebrow">{cfg.shortLabel} portal</span>
          </div>
        )}
        {formOnly ? (
          <>
            <p className="signin-card__portal-name" style={{ color: cfg.tone }}>
              {portalDisplayName(cfg.key, cfg.shortLabel)}
            </p>
            <h2 className="signin-card__title signin-card__title--portal">Sign in</h2>
          </>
        ) : (
          <>
            <h2 className="signin-card__title">{cfg.headline}</h2>
            <p className="signin-card__sub">{cfg.subtitle}</p>
          </>
        )}

        <form className="signin-form" onSubmit={onSubmit}>
          <label className="signin-form__label">
            <span>Email</span>
            <input
              className="signin-form__input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="signin-form__label">
            <span>Password</span>
            <input
              className="signin-form__input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p className="signin-form__error">{error}</p>}
          <button
            type="submit"
            className="signin-form__submit"
            disabled={busy}
          >
            {busy ? "Signing in…" : formOnly ? "Sign in" : cfg.cta}
          </button>
        </form>
      </div>
    </div>
  );
}

function PortalBackLink() {
  return (
    <Link to="/login" className="auth-login__back">
      <span className="auth-login__back-icon" aria-hidden>←</span>
      All portals
    </Link>
  );
}

function PortalTierBadge({ cfg, size = "md" }: { cfg: PortalConfig; size?: "sm" | "md" | "lg" }) {
  return (
    <div
      className={`auth-tier-badge auth-tier-badge--${size}`}
      style={{ ["--portal-tone" as string]: cfg.tone } as CSSProperties}
    >
      <span className="auth-tier-badge__icon" aria-hidden>
        {cfg.icon}
      </span>
      <span className="auth-tier-badge__label">{portalDisplayName(cfg.key, cfg.shortLabel)}</span>
    </div>
  );
}

function PortalPointsList({ points, className = "" }: { points: string[]; className?: string }) {
  return (
    <ul className={`auth-portal__points ${className}`.trim()}>
      {points.map((p) => (
        <li key={p}>
          <span className="auth-portal__points-dot" aria-hidden />
          {p}
        </li>
      ))}
    </ul>
  );
}

function useAuthPageScroll() {
  useEffect(() => {
    document.documentElement.classList.add("is-auth-route");
    document.body.classList.add("is-auth-route");
    return () => {
      document.documentElement.classList.remove("is-auth-route");
      document.body.classList.remove("is-auth-route");
    };
  }, []);
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Per-portal login page
   ═══════════════════════════════════════════════════════════════════════════════ */

export function PortalLoginPage({ portalKey }: { portalKey: keyof typeof PORTAL_LOGINS }) {
  const cfg = PORTAL_LOGINS[portalKey];
  const { user, loading } = useAuth();
  useAuthPageScroll();
  if (!cfg) return <Navigate to="/login" replace />;
  if (!loading && user) return <Navigate to={consumeLoginLanding(cfg.landingPath || "/dashboard")} replace />;

  return (
    <div className="auth-page auth-page--plain auth-page--portal" data-portal={portalKey}>
      <div className="auth-shell auth-shell--portal">
        <div
          className="auth-portal__grid auth-portal__grid--minimal"
          style={{ ["--portal-tone" as string]: cfg.tone } as CSSProperties}
        >
          <aside className="auth-portal__brand">
            <div className="auth-block auth-portal__story">
              <BrandLockup size="hero" context="portal" />
              <PortalTierBadge cfg={cfg} size="lg" />
              <p className="auth-portal__tagline">{cfg.headline}</p>
              <p className="auth-portal__hint">{cfg.subtitle}</p>
              <PortalPointsList points={cfg.points} />
            </div>
            <PortalBackLink />
          </aside>
          <div
            className="auth-portal__signin"
            style={{ ["--portal-tone" as string]: cfg.tone } as CSSProperties}
          >
            <SignInCard cfg={cfg} formOnly />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Landing hub — one screen, no scroll
   ═══════════════════════════════════════════════════════════════════════════════ */

function PortalBentoTile({ cfg }: { cfg: PortalConfig }) {
  return (
    <Link
      to={`/login/${cfg.key}`}
      className="auth-portal-block"
      style={{ ["--portal-tone" as string]: cfg.tone } as CSSProperties}
    >
      <div className="auth-portal-block__bar" aria-hidden />
      <div className="auth-portal-block__icon" aria-hidden>
        {cfg.icon}
      </div>
      <div className="auth-portal-block__body">
        <div className="auth-portal-block__tier">{cfg.shortLabel}</div>
        <div className="auth-portal-block__title">{portalDisplayName(cfg.key, cfg.shortLabel)}</div>
        <p className="auth-portal-block__desc">{cfg.headline}</p>
        <ul className="auth-portal-block__points">
          {cfg.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
      <span className="auth-portal-block__cta" aria-hidden>
        {cfg.cta} →
      </span>
    </Link>
  );
}

export function LoginHubPage() {
  const { user, loading } = useAuth();
  useAuthPageScroll();
  if (!loading && user) return <Navigate to={consumeLoginLanding()} replace />;

  return (
    <div className="auth-page auth-page--plain auth-page--hub">
      <div className="auth-shell auth-shell--hub">
        <header className="auth-hub__mast">
          <BrandLockup size="hero" context="hub" />
          <p className="auth-hub__kicker">Project Management Consultants</p>
          <h1 className="auth-hub__title">Choose your portal</h1>
          <p className="auth-hub__pitch">
            Drawings, quality, site logs, meetings, cost, and reports — one workspace for every role on your project.
          </p>
        </header>

        <section className="auth-hub__blocks" aria-label="Choose your portal">
          <div className="auth-hub__blocks-grid">
            {HUB_PORTALS.map((k) => (
              <PortalBentoTile key={k} cfg={PORTAL_LOGINS[k]} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
