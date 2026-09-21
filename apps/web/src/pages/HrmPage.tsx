import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { canManageHrms } from "../lib/portalAccounts";
import { Card, Stat } from "../components/ui";
import { formatUiText } from "../lib/formatUiText";
import { HRMS_ACCENT, HRMS_SECTIONS } from "./hrms/hrmsNav";

/** HRMS dashboard — module-hub pattern aligned with project tools and CRM desk. */
export default function HrmPage() {
  const { token, user } = useAuth();
  const canManage = canManageHrms(user);
  const [employees, setEmployees] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [e, dash] = await Promise.all([
        api<any[]>("/api/hrm/employees", { token }),
        api<any>("/api/hrm/dashboard", { token }),
      ]);
      setEmployees(e);
      setDashboard(dash);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load HR dashboard");
      setEmployees([]);
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="module-hub space-y-5 min-w-0" style={{ ["--module-accent" as string]: HRMS_ACCENT }}>
      <div className="module-hub__hero border border-line bg-paper rounded-xl overflow-hidden">
        <div className="module-hub__hero-bar h-1" style={{ background: HRMS_ACCENT }} aria-hidden />
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-start gap-4">
          <span
            className="module-hub__icon h-12 w-12 rounded-xl grid place-items-center text-white text-base font-display shrink-0 shadow-sm"
            style={{ background: HRMS_ACCENT }}
          >
            HR
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-mono uppercase tracking-wider text-steel-muted mb-1">HRMS · Tool desk</p>
            <h1 className="font-display text-2xl text-ink">Human Resources</h1>
            <p className="text-sm text-steel-muted mt-2 leading-relaxed max-w-3xl">
              {formatUiText(
                "Recruitment through separation — letters, payroll, attendance, and employee files on the _HR vault. HR runs pre-joining and onboarding; there is no separate candidate portal.",
              )}
            </p>
          </div>
        </div>
        <div className="module-hub__workflow border-t border-line bg-sand/80 px-5 sm:px-6 py-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-steel-muted">
          <span>
            <strong className="text-ink font-semibold">1.</strong> Recruit → offer
          </span>
          <span>
            <strong className="text-ink font-semibold">2.</strong> Pre-join + letters
          </span>
          <span>
            <strong className="text-ink font-semibold">3.</strong> Onboard + employee vault
          </span>
          <span>
            <strong className="text-ink font-semibold">4.</strong> Time, pay, separation
          </span>
        </div>
      </div>

      {loadError ? (
        <p className="text-sm rounded-lg px-3 py-2 bg-[color-mix(in_srgb,var(--color-danger)_12%,var(--color-paper))] text-danger border border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)]">
          {loadError}
        </p>
      ) : null}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
        <Stat label="Headcount" value={loading ? "…" : String(dashboard?.headcount ?? employees.length)} />
        <Stat label="Onboarded" value={loading ? "…" : String(dashboard?.onboardedUsers ?? 0)} />
        <Stat label="Onboarding active" value={loading ? "…" : String(dashboard?.onboardingInProgress ?? 0)} />
        <Stat label="Punches today" value={loading ? "…" : String(dashboard?.punchesToday ?? 0)} />
        <Stat label="Pending leave" value={loading ? "…" : String(dashboard?.pendingLeave ?? 0)} />
        <Stat label="Open offers" value={loading ? "…" : String(dashboard?.openOffers ?? 0)} />
        <Stat label="Open reqs" value={loading ? "…" : String(dashboard?.openReqs ?? 0)} />
        <Stat label="Candidates" value={loading ? "…" : String(dashboard?.activeCandidates ?? 0)} />
      </div>

      {HRMS_SECTIONS.map((section) => {
        const tools = section.tools.filter((t) => !t.adminOnly || canManage);
        if (!tools.length) return null;
        return (
          <div key={section.id} className="space-y-3">
            <h2 className="text-[11px] font-mono uppercase tracking-wider text-steel-muted">{section.label}</h2>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {tools.map((t) => {
                const href = t.to ? `/hrm/${t.to}` : "/hrm";
                return (
                  <Link key={t.to || "home"} to={href} className="module-hub__card group block h-full">
                    <div className="h-full rounded-xl border border-line bg-paper p-4 sm:p-5 transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-brand/50">
                      <div className="font-display text-base font-semibold text-ink group-hover:text-brand leading-snug">
                        {formatUiText(t.label)}
                      </div>
                      <p className="text-sm text-steel-muted mt-2 leading-relaxed line-clamp-3">{t.subtitle}</p>
                      <div className="mt-4 pt-3 border-t border-line/80 text-sm font-semibold text-brand flex items-center justify-between gap-2">
                        <span>Open</span>
                        <span aria-hidden className="group-hover:translate-x-0.5 transition-transform">
                          →
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}

      <Card padding={false}>
        <div className="px-4 py-3 border-b bg-sand/40 font-semibold flex items-center justify-between">
          <span>Recent staff ({employees.length})</span>
          {canManage ? (
            <Link to="/hrm/users" className="text-sm font-semibold text-brand">
              Manage users →
            </Link>
          ) : null}
        </div>
        <ul className="divide-y max-h-[360px] overflow-y-auto">
          {employees.length === 0 ? (
            <li className="px-4 py-6 text-sm text-steel-muted">No staff logins yet.</li>
          ) : null}
          {employees.slice(0, 12).map((e) => (
            <li key={e.id} className="px-4 py-2.5 text-sm flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{e.fullName}</div>
                <div className="text-xs text-steel-muted capitalize truncate">
                  {e.role?.replace("_", " ")} · {e.profile?.department || "—"}
                </div>
              </div>
              {e.memberships?.length > 0 ? (
                <span className="text-[10px] font-mono text-brand bg-brand-soft px-1.5 py-0.5 rounded shrink-0">
                  {e.memberships.length} project{e.memberships.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
