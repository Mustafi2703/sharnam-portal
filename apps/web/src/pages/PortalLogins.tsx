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
      className="space-y-4"
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
      <Button disabled={busy} className="w-full !py-3.5 !text-[15px]">
        {busy ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-[11px] text-steel-muted">
        Demo · {cfg.demoEmail} · Demo@1234
      </p>
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
    <aside className="relative hidden lg:flex min-h-screen flex-col justify-end overflow-hidden text-white">
      <img
        src="/hero-login.jpg"
        alt="Modern construction project"
        className="absolute inset-0 h-full w-full object-cover scale-[1.02]"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(160deg, rgba(17,19,24,0.45) 0%, rgba(26,29,38,0.62) 40%, rgba(15,118,110,0.55) 100%)",
        }}
      />
      <div className="relative z-10 p-10 xl:p-14 max-w-xl">
        <p className="text-[11px] uppercase tracking-[0.28em] text-teal-200/95 font-semibold">
          {BRAND_HI} · Construction PMC
        </p>
        <h1 className="font-display text-4xl xl:text-5xl tracking-tight mt-4 leading-[1.1]">{title}</h1>
        <p className="mt-4 text-base text-slate-100/90 leading-relaxed">{subtitle}</p>
        {points && points.length > 0 && (
          <ul className="mt-8 space-y-2.5 border-t border-white/20 pt-6">
            {points.map((p) => (
              <li key={p} className="text-sm text-slate-50/95 flex gap-2.5">
                <span className="text-teal-300 mt-0.5 shrink-0">▸</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-10 text-xs text-white/50">{BRAND_TAG}</p>
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
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_0.95fr] bg-white">
      <ConstructionHeroPanel title={cfg.headline} subtitle={cfg.subtitle} points={cfg.points} />

      <section className="flex flex-col min-h-screen bg-white">
        <header className="px-6 sm:px-10 pt-6 flex items-center justify-between">
          <BrandLink to="/login" tagTone="light" />
          <Link to="/login" className="text-xs font-medium text-steel-muted hover:text-brand">
            All portals
          </Link>
        </header>
        <div className="flex-1 flex items-center justify-center px-6 sm:px-10 py-10">
          <div className="w-full max-w-sm">
            <BrandLockup className="mb-8 lg:hidden" />
            <p className="text-[11px] uppercase tracking-[0.22em] text-steel-muted font-semibold mb-2">
              {BRAND_EN} sign in
            </p>
            <h2 className="font-display text-3xl text-ink tracking-tight">{cfg.title}</h2>
            <p className="text-steel-muted mt-2 mb-6 text-sm leading-relaxed">{cfg.subtitle}</p>
            <PortalSignInForm cfg={cfg} />
          </div>
        </div>
      </section>
    </div>
  );
}

/** Professional construction landing — left hero image, right interactive white login */
export function LoginHubPage() {
  const { user, loading } = useAuth();
  const [active, setActive] = useState<keyof typeof PORTAL_LOGINS>("office");
  const [emailFocused, setEmailFocused] = useState(false);

  if (!loading && user) return <Navigate to={consumeLoginLanding()} replace />;

  const cfg = PORTAL_LOGINS[active];

  return (
    <div className="min-h-screen flex flex-col lg:grid lg:grid-cols-[1.1fr_0.9fr] bg-[#f7f8fa] text-ink">
      <div className="lg:hidden relative h-40 overflow-hidden shrink-0">
        <img src="/hero-login.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[#1a1d26]/75" />
        <div className="relative z-10 h-full flex flex-col justify-end p-5 text-white">
          <p className="text-[10px] uppercase tracking-[0.24em] text-teal-200 font-semibold">
            {BRAND_HI} · Construction PMC
          </p>
          <p className="font-display text-xl mt-1">Built for construction delivery</p>
        </div>
      </div>

      <ConstructionHeroPanel
        title="Built for construction delivery"
        subtitle="Sharnam’s PMC portal keeps drawings, quality, field logs, and communications aligned across office, site, contractors, and clients."
        points={[
          "Open RFIs, Comms, and checklist logs on one dashboard",
          "Switch into one module at a time for focused work",
          "Four clear desks — Office, Site, Contractor, Client",
        ]}
      />

      <section id="signin" className="flex flex-col flex-1 min-h-0 lg:min-h-screen bg-white lg:border-l border-line">
        <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 xl:px-14 py-10">
          <div className="w-full max-w-md mx-auto">
            <BrandLockup />

            <div className="mt-8 flex items-center gap-2 text-xs text-steel-muted">
              <span className="login-live-dot inline-block h-2 w-2 rounded-full bg-brand" />
              Secure demo portal · password Demo@1234
            </div>

            <div className="mt-8 rounded-2xl border border-line bg-[#f7f8fa]/80 p-5 sm:p-6 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.2em] text-steel-muted font-semibold mb-3">
                Sign in as
              </p>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {HUB_ROLES.map((key) => {
                  const role = PORTAL_LOGINS[key];
                  const selected = active === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActive(key)}
                      className={`login-focus-ring rounded-xl px-3 py-3 text-left border transition ${
                        selected
                          ? "is-active bg-white border-brand shadow-sm"
                          : "bg-white/70 border-line text-steel-muted hover:border-brand/40 hover:text-ink"
                      }`}
                    >
                      <div className={`text-sm font-semibold ${selected ? "text-brand" : ""}`}>
                        {role.shortLabel === "Vendor" ? "Contractor" : role.shortLabel}
                      </div>
                      <div className="text-[11px] text-steel-muted mt-0.5 line-clamp-1">{role.points[0]}</div>
                    </button>
                  );
                })}
              </div>

              <div
                key={cfg.key}
                className="rise mb-5 rounded-xl border border-brand/20 bg-brand-soft/60 px-4 py-3"
              >
                <h2 className="font-display text-xl text-ink tracking-tight">{cfg.title}</h2>
                <p className="text-sm text-steel-muted mt-1 leading-relaxed">{cfg.subtitle}</p>
              </div>

              <div
                className={`login-focus-ring rounded-xl border border-line bg-white p-4 ${emailFocused ? "is-active" : ""}`}
                onFocus={() => setEmailFocused(true)}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setEmailFocused(false);
                }}
              >
                <PortalSignInForm cfg={cfg} />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2 text-center">
              {[
                ["01", "Dashboard"],
                ["02", "One module"],
                ["03", "Actions"],
              ].map(([n, label]) => (
                <div key={n} className="rounded-lg border border-line bg-white px-2 py-2.5">
                  <div className="text-[10px] font-mono text-brand font-semibold">{n}</div>
                  <div className="text-[11px] text-steel-muted mt-0.5 font-medium">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <footer className="px-6 sm:px-10 py-5 border-t border-line flex items-center justify-between gap-3 bg-[#f7f8fa]/50">
          <p className="text-xs text-steel-muted">© {new Date().getFullYear()} {BRAND_EN}</p>
          <p className="text-[11px] text-steel-muted/80 hidden sm:block">{BRAND_TAG}</p>
        </footer>
      </section>
    </div>
  );
}
