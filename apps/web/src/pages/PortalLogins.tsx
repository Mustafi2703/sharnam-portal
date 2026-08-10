import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import type { AuthUser, RoleKey } from "@sharnam/shared";
import { setActiveWorkspace, clearStoredProjectId, type WorkspaceKey } from "../workspaces";

/**
 * Sharnam login surface — matches the inside "desk" language.
 *
 * Hub (LoginHubPage):           bento of every portal on one screen, no scroll.
 * Portal login (PortalLoginPage): calm single-photo hero + white surface card
 *                                 with a portal-tone accent bar, chip picker at
 *                                 the top so switching to another portal is
 *                                 one click.
 * Shared strips:                 top brand rail with ISO badges + policy ticker
 *                                and a slim trust/version footer.
 */

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
  crane:   { src: "/heroes/sky-01-crane.jpg?v=1",   w: 1920, h: 1080, focus: "50% 72%", label: "Tower crane" },
  frame:   { src: "/heroes/sky-02-frame.jpg?v=1",   w: 1920, h: 1080, focus: "48% 78%", label: "Structure rising" },
  site:    { src: "/heroes/sky-03-site.jpg?v=1",    w: 1920, h: 1080, focus: "50% 70%", label: "Site facade" },
  bim:     { src: "/heroes/sky-04-bim.jpg?v=1",     w: 1920, h: 1080, focus: "50% 68%", label: "Design desk" },
  office:  { src: "/heroes/sky-05-office.jpg?v=1",  w: 1920, h: 1080, focus: "50% 75%", label: "Site overview" },
  field:   { src: "/heroes/sky-06-field.jpg?v=1",   w: 1920, h: 1080, focus: "50% 78%", label: "Field work" },
  quality: { src: "/heroes/sky-07-quality.jpg?v=1", w: 1920, h: 1080, focus: "50% 72%", label: "Quality check" },
  client:  { src: "/heroes/sky-08-client.jpg?v=1",  w: 1920, h: 1080, focus: "50% 70%", label: "Client view" },
  contractor: { src: "/heroes/sky-09-contractor.jpg?v=1", w: 1920, h: 1080, focus: "50% 76%", label: "Trade package" },
  drawings: { src: "/heroes/sky-10-drawings.jpg?v=1", w: 1920, h: 1080, focus: "50% 74%", label: "GFC drawings" },
} as const;

const VIZ_OFFICE   : HeroSlide[] = [H.office,     H.crane,   H.bim,     H.drawings];
const VIZ_SITE     : HeroSlide[] = [H.site,       H.field,   H.crane,   H.frame];
const VIZ_PLAN     : HeroSlide[] = [H.drawings,   H.bim,     H.crane,   H.frame];
const VIZ_FIELD    : HeroSlide[] = [H.field,      H.site,    H.contractor, H.crane];
const VIZ_CLIENT   : HeroSlide[] = [H.client,     H.office,  H.drawings, H.quality];
const VIZ_VENDOR   : HeroSlide[] = [H.contractor, H.field,   H.frame,   H.site];
const VIZ_QUALITY  : HeroSlide[] = [H.quality,    H.site,    H.frame,   H.field];
const VIZ_COMMS    : HeroSlide[] = [H.bim,        H.office,  H.client,  H.drawings];
const VIZ_MASTER   : HeroSlide[] = [H.crane,      H.office,  H.bim,     H.drawings];
const VIZ_EMPLOYEE : HeroSlide[] = [H.bim,        H.drawings, H.office, H.crane];

export const PORTAL_LOGINS: Record<string, PortalConfig> = {
  master: {
    key: "master", title: "Master", shortLabel: "Master",
    headline: "Set up every project from one desk.",
    subtitle: "Create projects, enable modules, HRM assign, CRM, and master documents.",
    demoEmail: "office@sharnam.demo", allowedRoles: ["admin", "office"],
    points: ["Projects · modules", "Directory · access", "Master documents"],
    cta: "Enter Master", tone: "#1E3A8A", icon: "MS",
    landingPath: "/master", workspaceKey: null, group: "master", heroes: VIZ_MASTER,
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
    landingPath: "/dashboard", workspaceKey: null, group: "role", heroes: VIZ_OFFICE,
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
    landingPath: "/workspace", workspaceKey: "field", group: "role", heroes: VIZ_SITE,
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
    landingPath: "/dashboard", group: "role", heroes: VIZ_EMPLOYEE,
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
    landingPath: "/workspace", workspaceKey: "drawings", group: "role", heroes: VIZ_VENDOR,
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
    landingPath: "/dashboard", workspaceKey: "progress", group: "role", heroes: VIZ_CLIENT,
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
    landingPath: "/workspace", workspaceKey: "drawings", group: "module", heroes: VIZ_PLAN,
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
    landingPath: "/workspace", workspaceKey: "quality", group: "module", heroes: VIZ_QUALITY,
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
    landingPath: "/workspace", workspaceKey: "comms", group: "module", heroes: VIZ_COMMS,
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
    landingPath: "/hrm", workspaceKey: null, group: "role", heroes: VIZ_OFFICE,
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
    landingPath: "/workspace", workspaceKey: "field", group: "module", heroes: VIZ_FIELD,
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

const HUB_ROLES: (keyof typeof PORTAL_LOGINS)[]    = ["office", "site", "vendor", "client", "employee", "master", "hr"];
const MODULE_LOGINS: (keyof typeof PORTAL_LOGINS)[] = ["drawings", "quality", "comms", "field"];

const ISO_BADGES = [
  { code: "ISO 9001",  label: "Quality Management" },
  { code: "ISO 45001", label: "Occupational Health & Safety" },
  { code: "ISO 14001", label: "Environmental Management" },
  { code: "ISO 19650", label: "BIM & Information Management" },
  { code: "ISO 21502", label: "Project Management" },
];

function portalDisplayName(key: string, shortLabel: string) {
  if (key === "vendor") return "Contractor";
  return shortLabel;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Shared surface primitives
   ═══════════════════════════════════════════════════════════════════════════════ */

function BrandLockup({ size = "hero" }: { size?: "hero" | "compact" | "chrome" }) {
  return (
    <div className={`brand-lockup brand-lockup--${size}`}>
      <img
        src="/logo.png"
        alt="शरणम्"
        className="brand-lockup__mark"
        width={820}
        height={400}
        decoding="sync"
        fetchPriority="high"
      />
      {size !== "chrome" && (
        <div className="brand-lockup__type" lang="hi">
          <span className="brand-lockup__hi">शरणम्</span>
          <span className="brand-lockup__latin">Sharnam</span>
        </div>
      )}
    </div>
  );
}

function TopStrip() {
  return (
    <header className="auth-strip">
      <div className="auth-strip__inner">
        <Link to="/login" className="auth-strip__brand" aria-label="Sharnam home">
          <img src="/logo.png" alt="Sharnam" width={140} height={68} className="auth-strip__logo" />
          <div className="auth-strip__brand-text">
            <span className="auth-strip__brand-en">Sharnam</span>
            <span className="auth-strip__brand-sub">Project Management Consultants</span>
          </div>
        </Link>
        <div className="auth-strip__iso" aria-label="Standards">
          {ISO_BADGES.map((b) => (
            <span key={b.code} className="auth-strip__iso-chip" title={b.label}>
              {b.code}
            </span>
          ))}
        </div>
        <div className="auth-strip__rev">
          <span className="auth-strip__rev-tag">PMC ISO Rev 02</span>
          <span className="auth-strip__rev-sep" aria-hidden>·</span>
          <span className="auth-strip__rev-ver">v0.5 · Aug 2026</span>
        </div>
      </div>
    </header>
  );
}

function PolicyTicker({ policies }: { policies: string[] }) {
  // Duplicate the array so the marquee wraps seamlessly.
  const doubled = [...policies, ...policies];
  return (
    <div className="auth-ticker" aria-label="Portal standards">
      <span className="auth-ticker__label">Standards</span>
      <div className="auth-ticker__track">
        <ul className="auth-ticker__list">
          {doubled.map((text, i) => (
            <li key={`${text}-${i}`} className="auth-ticker__item">
              <span className="auth-ticker__dot" aria-hidden />
              {text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TrustFooter({ policies }: { policies: string[] }) {
  return (
    <footer className="auth-trust">
      <PolicyTicker policies={policies} />
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Portal picker chip row — used on per-portal login pages
   ═══════════════════════════════════════════════════════════════════════════════ */

function PortalPicker({ active }: { active: string }) {
  return (
    <nav className="portal-picker" aria-label="Portal logins">
      <div className="portal-picker__group">
        <span className="portal-picker__label">User portals</span>
        <div className="portal-picker__row">
          {HUB_ROLES.map((key) => {
            const p = PORTAL_LOGINS[key];
            const on = active === key;
            return (
              <Link
                key={key}
                to={`/login/${key}`}
                className={`portal-picker__chip ${on ? "is-on" : ""}`}
                style={
                  on
                    ? ({ ["--chip-tone" as string]: p.tone } as CSSProperties)
                    : undefined
                }
                aria-current={on ? "page" : undefined}
              >
                <span className="portal-picker__chip-icon">{p.icon}</span>
                {portalDisplayName(key, p.shortLabel)}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="portal-picker__group">
        <span className="portal-picker__label">Module desks</span>
        <div className="portal-picker__row">
          {MODULE_LOGINS.map((key) => {
            const p = PORTAL_LOGINS[key];
            const on = active === key;
            return (
              <Link
                key={key}
                to={`/login/${key}`}
                className={`portal-picker__chip portal-picker__chip--mod ${on ? "is-on" : ""}`}
                style={
                  on
                    ? ({ ["--chip-tone" as string]: p.tone } as CSSProperties)
                    : undefined
                }
                aria-current={on ? "page" : undefined}
              >
                <span className="portal-picker__chip-icon">{p.icon}</span>
                {p.shortLabel}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Sign-in card
   ═══════════════════════════════════════════════════════════════════════════════ */

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
    <div className="signin-card" style={{ ["--card-tone" as string]: cfg.tone } as CSSProperties}>
      <div className="signin-card__accent" aria-hidden />
      <div className="signin-card__body">
        <div className="signin-card__head">
          <span className="signin-card__eyebrow">{portalDisplayName(cfg.key, cfg.shortLabel)} login</span>
          <span className="signin-card__href">/login/{cfg.key}</span>
        </div>
        <h1 className="signin-card__title">{cfg.headline}</h1>
        <p className="signin-card__sub">{cfg.subtitle}</p>

        <ul className="signin-card__points">
          {cfg.points.map((p) => (
            <li key={p}>
              <span className="signin-card__points-dot" aria-hidden />
              {p}
            </li>
          ))}
        </ul>

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
            {busy ? "Signing in…" : cfg.cta}
          </button>
          <p className="signin-form__hint">Demo · Demo@1234</p>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Hero panel — subdued single image with gentle Ken Burns
   ═══════════════════════════════════════════════════════════════════════════════ */

function HeroPanel({ heroes }: { heroes: HeroSlide[] }) {
  const [slide, setSlide] = useState(0);
  const slides = heroes.length ? heroes : [H.crane];

  useEffect(() => {
    const t = window.setInterval(() => setSlide((s) => (s + 1) % slides.length), 7500);
    return () => window.clearInterval(t);
  }, [slides.length]);

  return (
    <aside className="hero-panel" aria-hidden>
      <div className="hero-panel__stage">
        {slides.map((s, i) => (
          <img
            key={s.src}
            src={s.src}
            alt=""
            width={s.w}
            height={s.h}
            sizes="(max-width: 900px) 100vw, 60vw"
            className={`hero-panel__img ${i === slide ? "is-active" : ""}`}
            style={{ objectPosition: s.focus }}
            decoding={i === 0 ? "sync" : "async"}
            fetchPriority={i === 0 ? "high" : "low"}
            loading={i === 0 ? "eager" : "lazy"}
          />
        ))}
        <div className="hero-panel__veil" aria-hidden />
      </div>
      <div className="hero-panel__brand">
        <BrandLockup size="hero" />
      </div>
      <div className="hero-panel__dots" role="tablist" aria-label="Photos">
        {slides.map((s, i) => (
          <button
            key={s.src}
            type="button"
            aria-label={s.label}
            className={`hero-panel__dot ${i === slide ? "is-on" : ""}`}
            onClick={() => setSlide(i)}
          />
        ))}
      </div>
    </aside>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Per-portal login page
   ═══════════════════════════════════════════════════════════════════════════════ */

export function PortalLoginPage({ portalKey }: { portalKey: keyof typeof PORTAL_LOGINS }) {
  const cfg = PORTAL_LOGINS[portalKey];
  const { user, loading } = useAuth();
  if (!cfg) return <Navigate to="/login" replace />;
  if (!loading && user) return <Navigate to={consumeLoginLanding(cfg.landingPath || "/dashboard")} replace />;

  return (
    <div className="auth-page" data-portal={portalKey}>
      <TopStrip />
      <main className="auth-page__body">
        <HeroPanel heroes={cfg.heroes} />
        <section className="auth-page__panel">
          <div className="auth-page__panel-inner">
            <div className="auth-page__crumb">
              <Link to="/login" className="auth-page__back">← All portals</Link>
            </div>
            <PortalPicker active={portalKey} />
            <SignInCard cfg={cfg} />
          </div>
        </section>
      </main>
      <TrustFooter policies={cfg.policies} />
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
      className="bento-tile"
      style={{ ["--tile-tone" as string]: cfg.tone } as CSSProperties}
    >
      <div className="bento-tile__accent" aria-hidden />
      <div className="bento-tile__head">
        <span className="bento-tile__icon">{cfg.icon}</span>
        <span className="bento-tile__href">/login/{cfg.key}</span>
      </div>
      <div className="bento-tile__title">{portalDisplayName(cfg.key, cfg.shortLabel)}</div>
      <p className="bento-tile__headline">{cfg.headline}</p>
      <ul className="bento-tile__points">
        {cfg.points.map((p) => (
          <li key={p}>
            <span className="bento-tile__points-dot" aria-hidden />
            {p}
          </li>
        ))}
      </ul>
      <div className="bento-tile__cta">
        <span>{cfg.cta}</span>
        <span aria-hidden>→</span>
      </div>
    </Link>
  );
}

function ModuleChip({ cfg }: { cfg: PortalConfig }) {
  return (
    <Link
      to={`/login/${cfg.key}`}
      className="module-chip"
      style={{ ["--chip-tone" as string]: cfg.tone } as CSSProperties}
    >
      <span className="module-chip__icon">{cfg.icon}</span>
      <div className="module-chip__body">
        <div className="module-chip__title">{cfg.shortLabel}</div>
        <div className="module-chip__sub">{cfg.headline}</div>
      </div>
    </Link>
  );
}

export function LoginHubPage() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to={consumeLoginLanding()} replace />;

  // Compose a rich policy stream for the ticker so the client sees active standards.
  const policies = [
    "Every project is set up from Master · then modules open per charter.",
    "GFC publish gate before checklist fills and QI create.",
    "Safety NCR and QI NCR live in their own registers — never merged.",
    "Client sees published packs · never live drafts.",
    "Every mutation is written to the audit trail with who / when.",
    "DMS folders mirror PMC ISO Rev 02 · 100 folders · 127 subjects.",
    "Field RFI · Ask RFI · Inspection RFI are three distinct tools.",
    "Cashflow Chart · Forecast · Tracking stay separate to preserve intent.",
  ];

  return (
    <div className="auth-page auth-page--hub">
      <TopStrip />
      <main className="auth-hub">
        <section className="auth-hub__masthead">
          <BrandLockup size="hero" />
          <p className="auth-hub__tag">
            Project Management Consultants · ISO-aligned · DMS · PMC portal
          </p>
        </section>

        <section className="auth-hub__bento" aria-label="Choose your portal">
          <header className="auth-hub__section-head">
            <h2 className="auth-hub__section-title">User portals</h2>
            <span className="auth-hub__section-hint">Each user type has its own login link</span>
          </header>
          <div className="auth-hub__grid">
            {HUB_ROLES.map((k) => (
              <PortalBentoTile key={k} cfg={PORTAL_LOGINS[k]} />
            ))}
          </div>
        </section>

        <section className="auth-hub__modules" aria-label="Module desks">
          <header className="auth-hub__section-head">
            <h2 className="auth-hub__section-title">Module desks</h2>
            <span className="auth-hub__section-hint">Open a single tool — for demos and reviews</span>
          </header>
          <div className="auth-hub__mods">
            {MODULE_LOGINS.map((k) => (
              <ModuleChip key={k} cfg={PORTAL_LOGINS[k]} />
            ))}
          </div>
        </section>
      </main>
      <TrustFooter policies={policies} />
    </div>
  );
}
