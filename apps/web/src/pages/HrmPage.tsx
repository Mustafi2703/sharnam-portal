import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Card, Stat } from "../components/ui";

/** HRMS dashboard — KPIs and quick links into every HR workflow. */
export default function HrmPage() {
  const { token, user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "office";
  const [employees, setEmployees] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);

  const load = useCallback(async () => {
    const [e, dash] = await Promise.all([
      api<any[]>("/api/hrm/employees", { token }).catch(() => []),
      api<any>("/api/hrm/dashboard", { token }).catch(() => null),
    ]);
    setEmployees(e);
    setDashboard(dash);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
        <Stat label="Headcount" value={String(dashboard?.headcount ?? employees.length)} />
        <Stat label="Onboarded" value={String(dashboard?.onboardedUsers ?? 0)} />
        <Stat label="Onboarding active" value={String(dashboard?.onboardingInProgress ?? 0)} />
        <Stat label="Punches today" value={String(dashboard?.punchesToday ?? 0)} />
        <Stat label="Pending leave" value={String(dashboard?.pendingLeave ?? 0)} />
        <Stat label="Open offers" value={String(dashboard?.openOffers ?? 0)} />
        <Stat label="Open reqs" value={String(dashboard?.openReqs ?? 0)} />
        <Stat label="Candidates" value={String(dashboard?.activeCandidates ?? 0)} />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Link to="/hrm/recruitment" className="hrms-quick-card">
          <span className="hrms-quick-card__tag">Recruitment</span>
          <span className="hrms-quick-card__title">Requisition → Interview → Offer</span>
        </Link>
        <Link to="/hrm/onboarding" className="hrms-quick-card">
          <span className="hrms-quick-card__tag">Onboarding</span>
          <span className="hrms-quick-card__title">Pre-join checklist + Day 1</span>
        </Link>
        <Link to="/hrm/payroll" className="hrms-quick-card">
          <span className="hrms-quick-card__tag">Payroll</span>
          <span className="hrms-quick-card__title">Payslips + pay hike</span>
        </Link>
        <Link to="/hrm/attendance" className="hrms-quick-card">
          <span className="hrms-quick-card__tag">Attendance</span>
          <span className="hrms-quick-card__title">Geo check-in / out</span>
        </Link>
        <Link to="/hrm/leave" className="hrms-quick-card">
          <span className="hrms-quick-card__tag">Leave</span>
          <span className="hrms-quick-card__title">Request → Approve</span>
        </Link>
        <Link to="/hrm/documents" className="hrms-quick-card">
          <span className="hrms-quick-card__tag">Letters</span>
          <span className="hrms-quick-card__title">Appointment · Relieving · Exit</span>
        </Link>
        <Link to="/hrm/masters" className="hrms-quick-card">
          <span className="hrms-quick-card__tag">Masters</span>
          <span className="hrms-quick-card__title">Leave types + holidays</span>
        </Link>
        {canManage ? (
          <>
            <Link to="/hrm/users" className="hrms-quick-card">
              <span className="hrms-quick-card__tag">Users</span>
              <span className="hrms-quick-card__title">Logins + project assign</span>
            </Link>
            <Link to="/hrm/vendors" className="hrms-quick-card">
              <span className="hrms-quick-card__tag">Vendors</span>
              <span className="hrms-quick-card__title">Contractor directory</span>
            </Link>
          </>
        ) : null}
      </div>

      <Card padding={false}>
        <div className="px-4 py-3 border-b bg-sand/40 font-semibold flex items-center justify-between">
          <span>Recent employees ({employees.length})</span>
          {canManage ? (
            <Link to="/hrm/users" className="text-sm font-semibold text-brand">Manage users →</Link>
          ) : null}
        </div>
        <ul className="divide-y max-h-[360px] overflow-y-auto">
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
