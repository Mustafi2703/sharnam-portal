import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth";

const demos = [
  { email: "admin@sharnam.demo", label: "Admin" },
  { email: "office@sharnam.demo", label: "Office" },
  { email: "site@sharnam.demo", label: "Site Employee" },
  { email: "client@sharnam.demo", label: "Client" },
];

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const [email, setEmail] = useState("admin@sharnam.demo");
  const [password, setPassword] = useState("Demo@1234");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <section className="relative hidden lg:flex flex-col justify-between p-12 bg-steel text-white overflow-hidden">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(135deg, rgba(0,123,167,0.5), transparent 50%), repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 48px), repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 48px)",
          }}
        />
        <div className="relative">
          <div className="font-display text-6xl">शरणम्</div>
          <p className="mt-4 text-lg text-white/80 max-w-md">
            Project development consultants — checklists, drawings, daily diary, communications & cost tracking in one mobile-ready portal.
          </p>
        </div>
        <p className="relative text-sm text-white/50">Demo build for client walkthrough · Mock OneDrive DMS</p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <h1 className="font-display text-4xl text-ink mb-2">Sign in</h1>
          <p className="text-steel-muted mb-8">Choose a demo portal or enter credentials.</p>

          <div className="grid grid-cols-2 gap-2 mb-6">
            {demos.map((d) => (
              <button
                key={d.email}
                type="button"
                onClick={() => setEmail(d.email)}
                className={`rounded-xl border px-3 py-2 text-sm text-left ${
                  email === d.email ? "border-brand bg-brand-soft" : "border-black/10 bg-white"
                }`}
              >
                <div className="font-medium">{d.label}</div>
                <div className="text-xs text-steel-muted truncate">{d.email}</div>
              </button>
            ))}
          </div>

          <form
            className="space-y-4 bg-white/80 backdrop-blur rounded-2xl border border-black/5 p-6 shadow-sm"
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
              <span className="text-steel-muted">Email</span>
              <input
                className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-steel-muted">Password</span>
              <input
                type="password"
                className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              disabled={busy}
              className="w-full rounded-xl bg-brand hover:bg-brand-dark text-white py-3 font-medium disabled:opacity-60"
            >
              {busy ? "Signing in…" : "Enter portal"}
            </button>
            <p className="text-xs text-steel-muted text-center">Default password: Demo@1234</p>
          </form>
        </div>
      </section>
    </div>
  );
}
