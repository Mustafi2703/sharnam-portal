import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input } from "../components/ui";

const demos = [
  {
    email: "office@sharnam.demo",
    label: "Office",
    desc: "Publish drawings · review checklists · cost",
  },
  {
    email: "site@sharnam.demo",
    label: "Site",
    desc: "Daily diary · fill gated checklists",
  },
  {
    email: "client@sharnam.demo",
    label: "Client",
    desc: "Progress, approvals & weekly reports",
  },
  {
    email: "admin@sharnam.demo",
    label: "Admin",
    desc: "Roles, audit, full control",
  },
];

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const [email, setEmail] = useState("office@sharnam.demo");
  const [password, setPassword] = useState("Demo@1234");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <section className="relative hidden lg:flex flex-col justify-between p-12 surface-dark blueprint-grid overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,rgba(61,180,216,0.22),transparent_50%)]" />
        <div className="relative">
          <Badge tone="brand">PMC field system</Badge>
          <h1 className="font-display text-6xl xl:text-7xl mt-6 leading-[0.95] max-w-lg">
            Drawings unlock the site.
          </h1>
          <p className="mt-6 text-lg text-white/70 max-w-md leading-relaxed">
            Upload & publish drawings → site engineers fill checklists → office approves → client sees the trail.
            Cost, diary, and communications sit on the same project spine.
          </p>
        </div>
        <div className="relative grid grid-cols-3 gap-3 max-w-lg">
          {[
            ["01", "Drawings"],
            ["02", "Checklists"],
            ["03", "Sign-off"],
          ].map(([n, t]) => (
            <div key={n} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="font-mono text-brand-glow text-xs">{n}</div>
              <div className="mt-2 font-medium">{t}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md rise">
          <div className="lg:hidden mb-8">
            <div className="font-display text-4xl">शरणम्</div>
            <p className="text-steel-muted mt-1">Site Command</p>
          </div>
          <h2 className="font-display text-4xl text-ink">Enter portal</h2>
          <p className="text-steel-muted mt-2 mb-6">Pick a demo role — same password for all.</p>

          <div className="grid grid-cols-2 gap-2 mb-6">
            {demos.map((d) => (
              <button
                key={d.email}
                type="button"
                onClick={() => setEmail(d.email)}
                className={`rounded-2xl border p-3 text-left transition ${
                  email === d.email
                    ? "border-brand bg-brand-soft shadow-[0_0_0_1px_rgba(10,126,164,0.25)]"
                    : "border-line bg-white/70 hover:border-brand/40"
                }`}
              >
                <div className="font-semibold text-sm">{d.label}</div>
                <div className="text-[11px] text-steel-muted mt-1 leading-snug">{d.desc}</div>
              </button>
            ))}
          </div>

          <Card>
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  await login(email, password);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Login failed");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="block text-sm">
                <span className="text-steel-muted text-xs font-mono uppercase tracking-wider">Email</span>
                <Input className="mt-1.5" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="text-steel-muted text-xs font-mono uppercase tracking-wider">Password</span>
                <Input
                  type="password"
                  className="mt-1.5"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button disabled={busy} className="w-full !py-3">
                {busy ? "Opening…" : "Open Site Command"}
              </Button>
              <p className="text-center font-mono text-[11px] text-steel-muted">Demo@1234</p>
            </form>
          </Card>
        </div>
      </section>
    </div>
  );
}
