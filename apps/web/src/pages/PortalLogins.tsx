import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import type { AuthUser, RoleKey } from "@sharnam/shared";
import { Button, Input } from "../components/ui";
import { BrandLink, BrandLockup, BRAND_EN, BRAND_HI, BRAND_TAG } from "../components/Brand";
import { setActiveWorkspace, type WorkspaceKey } from "../workspaces";

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
  /** Where to land after sign-in */
  landingPath?: string;
  /** Optional workspace focus */
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
    headline: "Full office spine — same as Master tools.",
    subtitle: "Upload drawings, assign checklists, cost, and project control.",
    demoEmail: "office@sharnam.demo",
    allowedRoles: ["office", "admin"],
    points: ["Master setup", "All modules", "Cost & BOQ", "Publishing"],
    cta: "Enter Sharnam Office",
    tone: "#1D4ED8",
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
    tone: "#0F172A",
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

  return (
    <form
      className="space-y-3"
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
      <label className="block text-sm">
        <span className="text-steel-muted text-xs font-semibold uppercase tracking-wider">Email</span>
        <Input className="mt-1.5" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
      </label>
      <label className="block text-sm">
        <span className="text-steel-muted text-xs font-semibold uppercase tracking-wider">Password</span>
        <Input
          type="password"
          className="mt-1.5"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </label>
      {error && <p className="text-sm text-danger bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>}
      <Button disabled={busy} className="w-full !py-3 !text-[15px] !rounded-xl">
        {busy ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-[11px] text-steel-muted leading-snug">{cfg.demoEmail}</p>
    </form>
  );
}

const HUB_ROLES: (keyof typeof PORTAL_LOGINS)[] = ["office", "site", "vendor", "client"];

function ConstructionHeroPanel({
  title,
  subtitle,
  points,
}: {
  title: string;
  subtitle: string;
  points?: string[];
}) {
  return (
    <aside className="relative hidden lg:flex h-full min-h-0 flex-col justify-end overflow-hidden text-white">
      <img
        src="/hero-login.jpg"
        alt="Modern construction project"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(165deg, rgba(15,118,110,0.55) 0%, rgba(18,110,130,0.5) 50%, rgba(26,29,38,0.78) 100%)",
        }}
      />
      <div className="relative z-10 p-6 xl:p-8 max-w-md">
        <p className="text-[11px] uppercase tracking-[0.2em] text-amber-200 font-semibold">
          {BRAND_HI} · Construction PMC
        </p>
        <h1 className="font-display text-2xl xl:text-[1.75rem] tracking-tight mt-2.5 leading-[1.2]">{title}</h1>
        <p className="mt-2.5 text-[13px] text-white/88 leading-relaxed">{subtitle}</p>
        {points && points.length > 0 && (
          <ul className="mt-4 space-y-1.5 border-t border-white/20 pt-3">
            {points.map((p) => (
              <li key={p} className="text-[12px] text-white/90 flex gap-2">
                <span className="text-amber-300 shrink-0">▸</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

export function PortalLoginPage({ portalKey }: { portalKey: keyof typeof PORTAL_LOGINS }) {
  const cfg = PORTAL_LOGINS[portalKey];
  const { user, loading } = useAuth();
  if (!cfg) return <Navigate to="/login" replace />;
  if (!loading && user) return <Navigate to={consumeLoginLanding()} replace />;

  return (
    <div className="login-shell grid lg:grid-cols-[minmax(0,0.9fr)_minmax(380px,1.1fr)]">
      <ConstructionHeroPanel title={cfg.headline} subtitle={cfg.subtitle} points={cfg.points} />
      <section className="login-panel flex flex-col h-full border-l border-line">
        <header className="px-6 pt-5 pb-2 flex items-center justify-between shrink-0">
          <BrandLink to="/login" tagTone="light" />
          <Link to="/login" className="text-sm font-semibold text-brand">
            All portals
          </Link>
        </header>
        <div className="flex-1 flex items-center px-6 pb-8">
          <div className="w-full max-w-[400px] mx-auto">
            <BrandLockup className="mb-6 lg:hidden" />
            <p className="text-[11px] uppercase tracking-[0.18em] text-brand font-semibold mb-1">{BRAND_EN}</p>
            <h2 className="font-display text-3xl text-ink tracking-tight">{cfg.title}</h2>
            <p className="text-steel-muted mt-2 mb-5 text-[15px] leading-relaxed">{cfg.subtitle}</p>
            <PortalSignInForm cfg={cfg} />
          </div>
        </div>
      </section>
    </div>
  );
}

/** Sign-in focused — narrower hero, larger form typography */
export function LoginHubPage() {
  const { user, loading } = useAuth();
  const [active, setActive] = useState<keyof typeof PORTAL_LOGINS>("office");

  if (!loading && user) return <Navigate to={consumeLoginLanding()} replace />;

  const cfg = PORTAL_LOGINS[active];

  return (
    <div className="login-shell flex flex-col lg:grid lg:grid-cols-[minmax(0,0.85fr)_minmax(400px,1.15fr)]">
      <div className="lg:hidden relative h-[18vw] min-h-[76px] max-h-[100px] overflow-hidden shrink-0">
        <img src="/hero-login.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f766e]/90 to-[#126e82]/45" />
        <div className="relative z-10 h-full flex flex-col justify-end px-4 pb-2.5 text-white">
          <p className="text-[9px] uppercase tracking-[0.2em] text-amber-200 font-semibold">{BRAND_HI} · PMC</p>
          <p className="font-display text-base leading-tight">Construction delivery portal</p>
        </div>
      </div>

      <ConstructionHeroPanel
        title="Built for construction delivery"
        subtitle="Drawings, quality, field, and communications — aligned across teams."
        points={[
          "Dashboard for RFIs, Comms, and logs",
          "One module at a time",
          "Office · Site · Contractor · Client",
        ]}
      />

      <section id="signin" className="login-panel flex flex-col h-full min-h-0 lg:border-l border-line">
        <div className="flex-1 flex flex-col justify-center px-5 sm:px-8 py-5 sm:py-6">
          <div className="w-full max-w-[400px] mx-auto">
            <BrandLockup />

            <p className="mt-5 text-sm text-steel-muted">
              Demo password <span className="font-semibold text-brand">Demo@1234</span>
            </p>

            <div className="mt-5">
              <p className="text-[11px] uppercase tracking-[0.16em] text-brand font-semibold mb-2.5">Sign in as</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {HUB_ROLES.map((key) => {
                  const role = PORTAL_LOGINS[key];
                  const selected = active === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActive(key)}
                      className={`login-role-btn ${selected ? "is-on" : ""}`}
                    >
                      <div className={`text-[15px] font-semibold ${selected ? "text-brand" : "text-ink"}`}>
                        {role.shortLabel === "Vendor" ? "Contractor" : role.shortLabel}
                      </div>
                    </button>
                  );
                })}
              </div>

              <p className="text-sm text-steel-muted mb-4 leading-relaxed">{cfg.subtitle}</p>
              <PortalSignInForm cfg={cfg} />
            </div>
          </div>
        </div>

        <footer className="shrink-0 px-5 sm:px-8 py-3 border-t border-line flex items-center justify-between gap-2 bg-brand-soft/40">
          <p className="text-xs text-steel-muted">© {new Date().getFullYear()} {BRAND_EN}</p>
          <p className="text-[11px] text-brand font-semibold">{BRAND_HI}</p>
        </footer>
      </section>
    </div>
  );
}
