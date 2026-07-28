import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import type { AuthUser, RoleKey } from "@sharnam/shared";
import { Button, Card, Input } from "../components/ui";
import { BrandLink, BrandMark, BRAND_EN, BRAND_HI, BRAND_TAG } from "../components/Brand";
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
    <Card className="brand-frame !rounded-xl !p-6">
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
          <span className="text-steel-muted text-xs font-mono uppercase tracking-wider">Email</span>
          <Input className="mt-1.5" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        </label>
        <label className="block text-sm">
          <span className="text-steel-muted text-xs font-mono uppercase tracking-wider">Password</span>
          <Input
            type="password"
            className="mt-1.5"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && <p className="text-sm text-danger bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>}
        <Button disabled={busy} className="w-full !py-3.5 !text-[15px]" style={{ background: cfg.tone }}>
          {busy ? "Signing in…" : cfg.cta}
        </Button>
        <p className="text-center font-mono text-[11px] text-steel-muted">
          Demo · {cfg.demoEmail} · Demo@1234
        </p>
      </form>
    </Card>
  );
}

export function PortalLoginPage({ portalKey }: { portalKey: keyof typeof PORTAL_LOGINS }) {
  const cfg = PORTAL_LOGINS[portalKey];
  const { user, loading } = useAuth();
  if (!cfg) return <Navigate to="/login" replace />;
  if (!loading && user) return <Navigate to={consumeLoginLanding()} replace />;

  return (
    <div className="min-h-screen flex flex-col bg-sand">
      <header className="sticky top-0 z-40 bg-white border-b border-line">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between gap-3">
          <BrandLink to="/login" tagTone="light" />
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-xs font-medium text-steel-muted hover:text-brand">
              All logins
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1 grid lg:grid-cols-[1.05fr_0.95fr] max-w-6xl mx-auto w-full">
        <aside className="hidden lg:flex m-6 rounded-2xl border border-line bg-white p-8 flex-col justify-between">
          <div>
            <span
              className="inline-flex h-14 w-14 items-center justify-center rounded-xl text-white font-display text-lg"
              style={{ background: cfg.tone }}
            >
              {cfg.icon}
            </span>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-brand mt-6">
              {BRAND_HI} · {cfg.title}
            </p>
            <h1 className="font-display text-4xl mt-3 leading-tight text-ink">{cfg.headline}</h1>
            <p className="mt-3 text-sm text-steel-muted max-w-sm leading-relaxed">{cfg.subtitle}</p>
            <ul className="mt-6 space-y-2">
              {cfg.points.map((p) => (
                <li key={p} className="text-sm flex gap-2 text-ink">
                  <span className="text-brand">▸</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <BrandMark size="sm" tagTone="light" />
        </aside>

        <section className="flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md rise">
            <div className="lg:hidden mb-6">
              <BrandMark size="lg" tagTone="light" />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-brand mb-2">{BRAND_EN} sign in</p>
            <h2 className="font-display text-3xl text-ink tracking-tight">{cfg.title}</h2>
            <p className="text-steel-muted mt-2 mb-6 text-sm leading-relaxed">{cfg.subtitle}</p>
            <PortalSignInForm cfg={cfg} />
          </div>
        </section>
      </div>
    </div>
  );
}

const MODULE_KEYS: (keyof typeof PORTAL_LOGINS)[] = ["master", "drawings", "quality", "comms", "field"];
const ROLE_KEYS: (keyof typeof PORTAL_LOGINS)[] = ["office", "site", "vendor", "client"];

/** Black chrome + Sharnam logo — construction PMC login */
export function LoginHubPage() {
  const { user, loading } = useAuth();
  const [active, setActive] = useState<keyof typeof PORTAL_LOGINS>("office");

  if (!loading && user) return <Navigate to={consumeLoginLanding()} replace />;

  const cfg = PORTAL_LOGINS[active];

  function openPortal(key: keyof typeof PORTAL_LOGINS) {
    setActive(key);
  }

  return (
    <div className="min-h-screen bg-sand text-ink">
      <header className="sticky top-0 z-50 bg-black text-white border-b border-white/10">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandMark size="md" tagTone="dark" showTag={false} />
            <span className="font-display text-white hidden sm:inline">{BRAND_EN}</span>
          </div>
          <a href="#signin" className="text-sm text-white/70 hover:text-white font-medium">
            Sign in
          </a>
        </div>
      </header>

      <section className="bg-black text-white">
        <div className="max-w-5xl mx-auto px-5 py-14 grid lg:grid-cols-2 gap-10 items-center">
          <div className="space-y-5">
            <div className="logo-plate inline-block">
              <img src="/logo.png" alt={`${BRAND_HI} ${BRAND_EN}`} className="h-16 sm:h-20 w-auto object-contain" />
            </div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-white/50">
              {BRAND_HI} · {BRAND_TAG}
            </p>
            <h1 className="font-display text-4xl sm:text-5xl tracking-tight">
              {BRAND_EN}
              <span className="block text-xl sm:text-2xl text-white/75 mt-3 font-semibold">Construction PMC portal</span>
            </h1>
            <p className="text-white/65 text-base max-w-md leading-relaxed">
              Dashboard for open RFIs, Comms, and checklist logs. Modules for full project detail.
            </p>
            <p className="text-xs font-mono text-white/40">Demo password · Demo@1234</p>
          </div>
          <div id="signin" className="bg-white text-ink rounded-xl p-6 sm:p-8">
            <p className="text-[11px] uppercase tracking-wider text-steel-muted font-semibold mb-2">Sign in as</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {[...MODULE_KEYS, ...ROLE_KEYS].map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => openPortal(key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold border ${
                    active === key ? "bg-ink text-white border-ink" : "bg-white border-line text-steel-muted"
                  }`}
                >
                  {PORTAL_LOGINS[key].shortLabel}
                </button>
              ))}
            </div>
            <h2 className="font-display text-2xl mb-1">{cfg.title}</h2>
            <p className="text-sm text-steel-muted mb-4">{cfg.subtitle}</p>
            <PortalSignInForm cfg={cfg} />
          </div>
        </div>
      </section>

      <footer className="border-t border-line bg-white">
        <div className="max-w-5xl mx-auto px-5 py-6 flex items-center justify-between gap-4">
          <BrandMark size="sm" tagTone="light" />
          <p className="text-xs text-steel-muted">© {BRAND_EN}</p>
        </div>
      </footer>
    </div>
  );
}
