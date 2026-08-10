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
 * Portal login (PortalLoginPage): DeskStage on the left (a live mock of the
 *                                 inside desk in that portal's tone — no photo
 *                                 dependency, works in dark mode) + a paper
 *                                 sign-in card on the right (a real inside
 *                                 surface card with tone accent bar).
 * Shared strips:                 top brand rail with ISO badges + policy ticker
 *                                and a slim trust/version footer.
 *
 * There is no portal switcher chip row on the per-portal page — each portal
 * has its own permanent link. To switch, use "← All portals" back to the hub.
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
    <div className={`brand-lockup brand-lockup--${size} brand-lockup--logo-only`}>
      <img
        src="/logo.png"
        alt="Portal"
        className="brand-lockup__mark"
        width={820}
        height={400}
        decoding="sync"
        fetchPriority="high"
      />
    </div>
  );
}

function TopStrip() {
  return (
    <header className="auth-strip auth-strip--minimal">
      <div className="auth-strip__inner auth-strip__inner--center">
        <Link to="/login" className="auth-strip__brand auth-strip__brand--logo-only" aria-label="Home">
          <img src="/logo.png" alt="" width={160} height={78} className="auth-strip__logo" />
        </Link>
        <div className="auth-strip__iso" aria-label="Standards">
          {ISO_BADGES.map((b) => (
            <span key={b.code} className="auth-strip__iso-chip" title={b.label}>
              {b.code}
            </span>
          ))}
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

/* Portal picker retired — each portal has its own permanent link. To switch
   portals from the per-portal page, use "← All portals" back to the hub. */

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
        <div className="signin-card__logo-wrap">
          <img src="/logo.png" alt="" className="signin-card__logo" width={120} height={58} />
        </div>
        <div className="signin-card__head">
          <span className="signin-card__eyebrow">{cfg.shortLabel} portal</span>
        </div>

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
   Desk stage — pure CSS/SVG mock of the inside desk in the portal's tone.
   No photo dependency — reads well in light OR dark mode. Shows the client
   exactly what shape the portal takes once they sign in.
   ═══════════════════════════════════════════════════════════════════════════════ */

type DeskSample = {
  code: string;
  name: string;
  eyebrow: string;
  stats: { label: string; value: string }[];
  tools: { icon: string; label: string }[];
  activity: string[];
};

/**
 * Curated single image per portal — used as the small "site image" card
 * inside the desk mock. Mirrors the "Insert Site Image Here" slide from
 * the SPDC WPR pack. A tone-tinted overlay makes it read the same in
 * dark mode without swapping the asset.
 */
const PORTAL_IMAGE: Record<string, { src: string; caption: string; focus: string }> = {
  office:   { src: "/heroes/sky-05-office.jpg?v=1",     caption: "Site overview · this week",       focus: "50% 74%" },
  site:     { src: "/heroes/sky-03-site.jpg?v=1",       caption: "Wing B · slab pour cleared",      focus: "50% 70%" },
  vendor:   { src: "/heroes/sky-09-contractor.jpg?v=1", caption: "Package · trade partner",          focus: "50% 72%" },
  client:   { src: "/heroes/sky-08-client.jpg?v=1",     caption: "Project handover view",            focus: "50% 68%" },
  employee: { src: "/heroes/sky-04-bim.jpg?v=1",        caption: "My desk · design coordination",    focus: "50% 68%" },
  master:   { src: "/heroes/sky-01-crane.jpg?v=1",      caption: "Portfolio · construction in flight", focus: "50% 68%" },
  hr:       { src: "/heroes/sky-05-office.jpg?v=1",     caption: "People · Sharnam office",          focus: "50% 68%" },
  drawings: { src: "/heroes/sky-10-drawings.jpg?v=1",   caption: "GFC · A-04 R2 published",          focus: "50% 68%" },
  quality:  { src: "/heroes/sky-07-quality.jpg?v=1",    caption: "QAP · cube crushing register",     focus: "50% 68%" },
  comms:    { src: "/heroes/sky-04-bim.jpg?v=1",        caption: "Coordination · weekly meeting",    focus: "50% 68%" },
  field:    { src: "/heroes/sky-06-field.jpg?v=1",      caption: "Field · manpower closed",          focus: "50% 68%" },
};

const DESK_SAMPLES: Record<string, DeskSample> = {
  office: {
    code: "SPDC-DEMO-01",
    name: "Arvind Worker Dormitory · Santej",
    eyebrow: "Office · Full control",
    stats: [
      { label: "Open RFIs", value: "12" },
      { label: "Drawings published", value: "48" },
      { label: "SPI", value: "0.96" },
    ],
    tools: [
      { icon: "DR", label: "Drawings" },
      { icon: "QI", label: "Quality" },
      { icon: "CO", label: "Comms" },
      { icon: "FN", label: "Finance" },
      { icon: "PR", label: "Progress" },
      { icon: "AU", label: "Audit" },
    ],
    activity: [
      "GFC · A-04 R2 published",
      "DPR / CIVIL – 27 uploaded",
      "COP-19 approved · Viatrix",
      "Toolbox talk logged · 32 attended",
    ],
  },
  site: {
    code: "SPDC-DEMO-01",
    name: "Site logbook · Wing B slab pour",
    eyebrow: "Site · Field tools",
    stats: [
      { label: "Manpower", value: "184" },
      { label: "Equipment", value: "11" },
      { label: "Site RFIs", value: "3" },
    ],
    tools: [
      { icon: "DL", label: "Day log" },
      { icon: "CL", label: "Checklists" },
      { icon: "PH", label: "Photos" },
      { icon: "SR", label: "Site RFI" },
      { icon: "HP", label: "Hindrance" },
      { icon: "SF", label: "Safety" },
    ],
    activity: [
      "Manpower closed at shift end",
      "Wing B slab · pour cleared",
      "Photo album tagged · 22 photos",
      "Hindrance · water · resolved",
    ],
  },
  vendor: {
    code: "SPDC-DEMO-01",
    name: "Trade partner · Bhavna Infra",
    eyebrow: "Contractor · Package view",
    stats: [
      { label: "My RFIs", value: "5" },
      { label: "Open bills", value: "2" },
      { label: "Ball-in-court", value: "3" },
    ],
    tools: [
      { icon: "PK", label: "Packages" },
      { icon: "RF", label: "Fill RFI" },
      { icon: "CH", label: "Checklists" },
      { icon: "MB", label: "MB" },
      { icon: "RA", label: "RA bill" },
      { icon: "PH", label: "Photos" },
    ],
    activity: [
      "RA-04 submitted · under review",
      "Cube crushing register updated",
      "Checklist · masonry L4 filled",
    ],
  },
  client: {
    code: "SPDC-DEMO-01",
    name: "Client dashboard · Arvind Ltd.",
    eyebrow: "Client · Read-only pack",
    stats: [
      { label: "Progress", value: "62%" },
      { label: "Milestones", value: "18/24" },
      { label: "Concerns", value: "2" },
    ],
    tools: [
      { icon: "DR", label: "GFC drawings" },
      { icon: "PG", label: "Progress" },
      { icon: "CN", label: "Concerns" },
      { icon: "WP", label: "WPR pack" },
      { icon: "DP", label: "DPR pack" },
      { icon: "SF", label: "Safety" },
    ],
    activity: [
      "WPR-50 pack published",
      "Milestone · Slab F4 · complete",
      "Concern raised · P4 opening dim",
    ],
  },
  employee: {
    code: "MY DESK",
    name: "Employee workday",
    eyebrow: "Employee · Self-service",
    stats: [
      { label: "Assigned RFIs", value: "4" },
      { label: "Fills due", value: "6" },
      { label: "Leave bal", value: "8" },
    ],
    tools: [
      { icon: "PJ", label: "Projects" },
      { icon: "DR", label: "Drawings" },
      { icon: "LV", label: "Leave" },
      { icon: "AT", label: "Attendance" },
      { icon: "PS", label: "Payslip" },
      { icon: "DO", label: "Docs" },
    ],
    activity: [
      "QI checklist · slab F3 filled",
      "Payslip · Aug · generated",
      "Leave · Fri · pre-approved",
    ],
  },
  master: {
    code: "MASTER",
    name: "Master · Portfolio setup",
    eyebrow: "Master · Setup desk",
    stats: [
      { label: "Projects", value: "6" },
      { label: "Users", value: "128" },
      { label: "Templates", value: "42" },
    ],
    tools: [
      { icon: "PR", label: "Projects" },
      { icon: "MD", label: "Modules" },
      { icon: "US", label: "Access" },
      { icon: "TP", label: "Templates" },
      { icon: "CR", label: "CRM" },
      { icon: "AD", label: "Audit" },
    ],
    activity: [
      "Project · SPDC-DEMO-02 · created",
      "Roles matrix · updated",
      "Communication matrix · seeded",
    ],
  },
  hr: {
    code: "HR ADMIN",
    name: "HRMS · Sharnam people desk",
    eyebrow: "HR admin · scoped desk",
    stats: [
      { label: "Head-count", value: "146" },
      { label: "Open req", value: "7" },
      { label: "Payslips", value: "146" },
    ],
    tools: [
      { icon: "RC", label: "Recruit" },
      { icon: "OB", label: "Onboard" },
      { icon: "AT", label: "Attend" },
      { icon: "LV", label: "Leave" },
      { icon: "PR", label: "Payroll" },
      { icon: "AU", label: "Audit" },
    ],
    activity: [
      "Offer · Sr QC · sent",
      "Attendance · 96% today",
      "Pay hike · 4 approved",
    ],
  },
  drawings: {
    code: "DRAWINGS",
    name: "GFC register · Drawing Check",
    eyebrow: "Drawings · GFC & DMS",
    stats: [
      { label: "Sheets", value: "212" },
      { label: "Rev cycles", value: "68" },
      { label: "Ask RFIs", value: "9" },
    ],
    tools: [
      { icon: "RG", label: "Register" },
      { icon: "PC", label: "Pre-check" },
      { icon: "UP", label: "Upload" },
      { icon: "CO", label: "Coord" },
      { icon: "DM", label: "DMS" },
      { icon: "AK", label: "Ask" },
    ],
    activity: [
      "R2 · A-04 · published to client",
      "Pre-check checklist filled",
      "Coordination · MEP vs slab",
    ],
  },
  quality: {
    code: "QUALITY",
    name: "QI · NCR · Cube · QAP",
    eyebrow: "Quality · Registers",
    stats: [
      { label: "QI open", value: "14" },
      { label: "NCR open", value: "3" },
      { label: "Cubes", value: "88" },
    ],
    tools: [
      { icon: "QI", label: "QI board" },
      { icon: "NC", label: "NCR / CAR" },
      { icon: "CU", label: "Cube" },
      { icon: "QP", label: "QAP" },
      { icon: "RF", label: "QI RFI" },
      { icon: "CH", label: "Checklists" },
    ],
    activity: [
      "QI · L4 slab · passed",
      "Cube · CI-32 · 24.6 MPa",
      "QAP · Week 50 · updated",
    ],
  },
  comms: {
    code: "COMMS",
    name: "Matrix · Agenda · MoM",
    eyebrow: "Communications",
    stats: [
      { label: "Matrix rows", value: "26" },
      { label: "Open MoMs", value: "4" },
      { label: "Ask RFIs", value: "7" },
    ],
    tools: [
      { icon: "MA", label: "Matrix" },
      { icon: "AG", label: "Agenda" },
      { icon: "MM", label: "MoM" },
      { icon: "AK", label: "Ask" },
      { icon: "OL", label: "Outlook" },
      { icon: "FU", label: "Follow-up" },
    ],
    activity: [
      "Weekly meeting · agenda ready",
      "MoM · W49 · signed off",
      "Ask · GFC clarification opened",
    ],
  },
  field: {
    code: "FIELD",
    name: "Day log · Photos · Site RFI",
    eyebrow: "Field · Site evidence",
    stats: [
      { label: "Manpower", value: "184" },
      { label: "Photos today", value: "26" },
      { label: "Site RFIs", value: "5" },
    ],
    tools: [
      { icon: "DL", label: "Day log" },
      { icon: "MP", label: "Manpower" },
      { icon: "EQ", label: "Equipment" },
      { icon: "PH", label: "Photos" },
      { icon: "SR", label: "Site RFI" },
      { icon: "HP", label: "Hindrance" },
    ],
    activity: [
      "Day log · closed 18:20",
      "Photos · Wing B · 12 tagged",
      "Hindrance · water · closed",
    ],
  },
};

function DeskStage({ portalKey, tone, icon }: { portalKey: string; tone: string; icon: string }) {
  const sample = DESK_SAMPLES[portalKey] || DESK_SAMPLES.office;
  const img = PORTAL_IMAGE[portalKey] || PORTAL_IMAGE.office;
  return (
    <aside
      className="desk-stage"
      aria-hidden
      style={{ ["--stage-tone" as string]: tone } as CSSProperties}
    >
      <div className="desk-stage__grid" />
      <div className="desk-stage__wash" />

      <div className="desk-stage__chrome">
        <span className="desk-stage__dot desk-stage__dot--r" />
        <span className="desk-stage__dot desk-stage__dot--y" />
        <span className="desk-stage__dot desk-stage__dot--g" />
        <span className="desk-stage__chrome-url">sharnam-portal · {portalKey}</span>
      </div>

      <div className="desk-stage__desk">
        <header className="desk-stage__page-head">
          <div className="desk-stage__head-left">
            <span className="desk-stage__eyebrow">{sample.eyebrow}</span>
            <h3 className="desk-stage__title">{sample.name}</h3>
            <span className="desk-stage__code">{sample.code}</span>
          </div>
          <div className="desk-stage__icon" aria-hidden>{icon}</div>
        </header>

        <div className="desk-stage__stats">
          {sample.stats.map((s) => (
            <div key={s.label} className="desk-stage__stat">
              <div className="desk-stage__stat-val">{s.value}</div>
              <div className="desk-stage__stat-lbl">{s.label}</div>
            </div>
          ))}
        </div>

        {/*
         * "Site image" card — mirrors the WPR slide 6 pattern
         * ("Insert Site Image Here"). One curated photo per portal,
         * placed inside the desk mock. A tone-tinted overlay + a soft
         * gradient at the bottom carry the image cleanly into dark mode.
         */}
        <figure
          className="desk-stage__photo"
          style={{
            backgroundImage: `url(${img.src})`,
            backgroundPosition: img.focus,
          }}
        >
          <div className="desk-stage__photo-scrim" />
          <figcaption className="desk-stage__photo-caption">
            <span className="desk-stage__photo-eyebrow">Site image · this week</span>
            <span className="desk-stage__photo-text">{img.caption}</span>
          </figcaption>
        </figure>

        <div className="desk-stage__tools">
          {sample.tools.map((t) => (
            <div key={t.label} className="desk-stage__tool">
              <span className="desk-stage__tool-icon">{t.icon}</span>
              <span className="desk-stage__tool-label">{t.label}</span>
            </div>
          ))}
        </div>

        <div className="desk-stage__activity" aria-label="Recent activity">
          <div className="desk-stage__activity-head">Recent activity</div>
          <ul className="desk-stage__activity-list">
            {sample.activity.map((a) => (
              <li key={a} className="desk-stage__activity-row">
                <span className="desk-stage__activity-dot" />
                {a}
              </li>
            ))}
          </ul>
        </div>
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

  const hero = PORTAL_IMAGE[String(portalKey)] || PORTAL_IMAGE.office;

  return (
    <div className="auth-page" data-portal={portalKey}>
      <TopStrip />
      <main className="auth-page__body">
        <section
          className="auth-hero auth-hero--visual-only"
          style={{ ["--hero-tone" as string]: cfg.tone } as CSSProperties}
        >
          <img className="auth-hero__img" src={hero.src} alt="" loading="eager" />
          <div className="auth-hero__scrim" />
        </section>
        <section className="auth-page__panel">
          <div className="auth-page__panel-inner">
            <div className="auth-page__crumb">
              <Link to="/login" className="auth-page__back">← All portals</Link>
            </div>
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
    "ISO 9001 · Quality management on every inspection register",
    "ISO 45001 · Safety NCR and HIRA kept separate from QI",
    "ISO 14001 · Environmental records in HSE folders",
    "GFC publish gate before checklist fills and QI create",
    "Drawing Check · Site Execution · QI · Safety — four checklist families",
    "DMS folders mirror PMC ISO Rev 02 · 100 folders · 127 subjects",
    "Field RFI · Ask RFI · Inspection RFI are three distinct tools",
    "Every upload and fill writes to the audit trail",
  ];

  return (
    <div className="auth-page auth-page--hub">
      <TopStrip />
      <section className="auth-hub__hero" aria-hidden>
        <img className="auth-hub__hero-img" src="/heroes/sky-01-crane.jpg?v=2" alt="" />
        <div className="auth-hub__hero-scrim" />
      </section>
      <main className="auth-hub">
        <section className="auth-hub__masthead auth-hub__masthead--overlay auth-hub__masthead--centered">
          <BrandLockup size="hero" />
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
