import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../auth";
import { homePathForUser, isJoiningEmployee } from "../../lib/portalAccounts";

/** HRMS — HR desk + new joiners on pre-joining / onboarding only. */
export default function HrmsProtected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="min-h-[40vh] grid place-items-center text-steel-muted font-mono text-sm">
        Loading HRMS…
      </div>
    );
  }
  if (!user) {
    if (loc.pathname.startsWith("/hrm/onboarding")) {
      return <Navigate to="/login/employee" replace />;
    }
    return <Navigate to="/login/hr" replace />;
  }

  if (isJoiningEmployee(user)) {
    if (loc.pathname.startsWith("/hrm/onboarding")) return <>{children}</>;
    return <Navigate to={`/hrm/onboarding/${user.joiningOfferId}`} replace />;
  }

  if (user.role !== "admin" && user.role !== "office") {
    if (user.role !== "hr" && !user.hrDeskOnly) {
      return <Navigate to={homePathForUser(user)} replace />;
    }
  }
  return <>{children}</>;
}
