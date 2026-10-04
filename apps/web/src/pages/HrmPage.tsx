import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { canManageHrms } from "../lib/portalAccounts";
import { Card } from "../components/ui";
import { StatusNote } from "../components/StatusNote";
import { formatUiText } from "../lib/formatUiText";
import { HRMS_ACCENT } from "./hrms/hrmsNav";

type Dashboard = {
  headcount?: number;
  openOffers?: number;
  pendingLeave?: number;
  punchesToday?: number;
  openReqs?: number;
  activeCandidates?: number;
  onboardedUsers?: number;
  onboardingInProgress?: number;
};

/** The employee journey, in the order HR actually works it. */
const JOURNEY_RAW: {
  n: number;
  title: string;
  what: string;
  to: string;
  cta: string;
  metric: keyof Dashboard;
  metricLabel: string;
}[] = [
  {
    n: 1,
    title: "Requisition",
    what: "Raise the manpower request for a role.",
    to: "/hrm/recruitment?tab=requisitions",
    cta: "Raise requisition",
    metric: "openReqs",
    metricLabel: "open",
  },
  {
    n: 2,
    title: "Candidates & interviews",
    what: "Add resumes, schedule Teams interviews, fill scorecards.",
    to: "/hrm/recruitment?tab=candidates",
    cta: "Add candidate",
    metric: "activeCandidates",
    metricLabel: "in pipeline",
  },
  {
    n: 3,
    title: "Offer",
    what: "Compute CTC, draft the offer letter with Annexure I.",
    to: "/hrm/recruitment?tab=offers",
    cta: "Draft offer",
    metric: "openOffers",
    metricLabel: "open",
  },
  {
    n: 4,
    title: "Onboarding",
    what: "Collect documents, appointment letter, NDA, Day-1 checklist.",
    to: "/hrm/onboarding",
    cta: "Open onboarding",
    metric: "onboardingInProgress",
    metricLabel: "in progress",
  },
  {
    n: 5,
    title: "Employee",
    what: "Login, project assignment, attendance, leave, payroll.",
    to: "/hrm/users",
    cta: "Manage staff",
    metric: "headcount",
    metricLabel: "staff",
  },
  {
    n: 6,
    title: "Letters & exit",
    what: "Confirmation, promotion, warning, relieving, experience.",
    to: "/hrm/documents",
    cta: "Generate letter",
    metric: "onboardedUsers",
    metricLabel: "onboarded",
  },
];

const QUICK_RAW: { label: string; to: string }[] = [
  { label: "Team attendance calendar", to: "/hrm/attendance?view=team" },
  { label: "Approve leave", to: "/hrm/leave" },
  { label: "Generate a letter", to: "/hrm/documents" },
  { label: "Run payroll / payslips", to: "/hrm/payroll" },
  { label: "Employee files", to: "/hrm/files" },
  { label: "Holidays & leave types", to: "/hrm/masters" },
];

// HRMS copy is Title Case everywhere (every word capitalised).
const JOURNEY = JOURNEY_RAW.map((j) => ({
  ...j,
  title: formatUiText(j.title),
  what: formatUiText(j.what),
  cta: formatUiText(j.cta),
  metricLabel: formatUiText(j.metricLabel),
}));
const QUICK = QUICK_RAW.map((q) => ({ ...q, label: formatUiText(q.label) }));
const T = formatUiText;

/** HRMS home — the hiring-to-exit journey with live counts and what needs attention today. */
export default function HrmPage() {
  const { token, user } = useAuth();
  const canManage = canManageHrms(user);
  const [employees, setEmployees] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [e, dash] = await Promise.all([
        api<any[]>("/api/hrm/employees", { token }),
        api<Dashboard>("/api/hrm/dashboard", { token }),
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

  const num = (k: keyof Dashboard) => (loading ? "…" : String(dashboard?.[k] ?? (k === "headcount" ? employees.length : 0)));

  const attention = [
    { n: dashboard?.pendingLeave ?? 0, label: "leave requests waiting for approval", to: "/hrm/leave" },
    { n: dashboard?.onboardingInProgress ?? 0, label: "joiners with onboarding in progress", to: "/hrm/onboarding" },
    { n: dashboard?.openOffers ?? 0, label: "offers sent and not yet accepted", to: "/hrm/recruitment?tab=offers" },
    { n: dashboard?.openReqs ?? 0, label: "open requisitions to fill", to: "/hrm/recruitment?tab=requisitions" },
  ].filter((a) => a.n > 0);

  return (
    <div className="hr-home space-y-5 min-w-0" style={{ ["--module-accent" as string]: HRMS_ACCENT }}>
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold" style={{ color: HRMS_ACCENT }}>
            {T("HR desk")} · {user?.fullName}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl text-ink font-semibold tracking-tight">Human Resources</h1>
          <p className="text-sm text-steel-muted mt-1 max-w-2xl">
            {T("Follow the steps left to right — every hire moves from requisition to employee. Click a step to work on it.")}
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <div className="hr-home__kpi">
            <span className="hr-home__kpi-value">{num("headcount")}</span>
            <span className="hr-home__kpi-label">{T("Staff")}</span>
          </div>
          <div className="hr-home__kpi">
            <span className="hr-home__kpi-value">{num("punchesToday")}</span>
            <span className="hr-home__kpi-label">{T("Checked in today")}</span>
          </div>
        </div>
      </div>

      <StatusNote msg={loadError} tone="danger" />

      <ol className="hr-journey" aria-label="Employee journey">
        {JOURNEY.map((step) => (
          <li key={step.n} className="hr-journey__step">
            <Link to={step.to} className="hr-journey__card">
              <span className="hr-journey__num">{step.n}</span>
              <span className="hr-journey__title">{step.title}</span>
              <span className="hr-journey__what">{step.what}</span>
              <span className="hr-journey__metric">
                <strong>{num(step.metric)}</strong> {step.metricLabel}
              </span>
              <span className="hr-journey__cta">
                {step.cta} <span aria-hidden>→</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2" padding={false}>
          <div className="px-4 py-3 border-b border-line font-semibold">{T("Needs your attention")}</div>
          {loading ? (
            <p className="px-4 py-5 text-sm text-steel-muted">{T("Loading")}…</p>
          ) : attention.length === 0 ? (
            <p className="px-4 py-5 text-sm text-steel-muted">{T("Nothing waiting right now.")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {attention.map((a) => (
                <li key={a.label}>
                  <Link to={a.to} className="hr-attention__row">
                    <span className="hr-attention__count">{a.n}</span>
                    <span className="flex-1">{T(a.label)}</span>
                    <span className="hr-attention__go">{T("Open")} →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padding={false}>
          <div className="px-4 py-3 border-b border-line font-semibold">{T("Quick actions")}</div>
          <div className="p-3 grid gap-2">
            {QUICK.map((q) => (
              <Link key={q.to} to={q.to} className="hr-quick__btn">
                {q.label}
                <span aria-hidden>→</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <Card padding={false}>
        <div className="px-4 py-3 border-b border-line font-semibold flex items-center justify-between">
          <span>{T("Team")} ({employees.length})</span>
          {canManage ? (
            <Link to="/hrm/users" className="text-sm font-semibold" style={{ color: HRMS_ACCENT }}>
              {T("Manage users")} →
            </Link>
          ) : null}
        </div>
        <ul className="divide-y divide-line max-h-[360px] overflow-y-auto">
          {!loading && employees.length === 0 ? (
            <li className="px-4 py-6 text-sm text-steel-muted">{T("No staff logins yet. Convert a candidate in Onboarding to add one.")}</li>
          ) : null}
          {employees.slice(0, 15).map((e) => (
            <li key={e.id}>
              <Link
                to={`/hrm/attendance?view=person&user=${encodeURIComponent(e.id)}`}
                className="px-4 py-2.5 text-sm flex items-center justify-between gap-3 hover:bg-sand/50"
                title={T("Open attendance & leave calendar")}
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{e.fullName}</div>
                  <div className="text-xs text-steel-muted capitalize truncate">
                    {[e.profile?.empCode, e.profile?.designation || e.role?.replace("_", " "), e.profile?.department]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <span className="text-xs text-steel-muted shrink-0">{T("Calendar")} →</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
