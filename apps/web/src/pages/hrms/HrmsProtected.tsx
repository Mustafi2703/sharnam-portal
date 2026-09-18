import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../auth";
import { homePathForUser, isJoiningEmployee } from "../../lib/portalAccounts";
import { Card } from "../../components/ui";

/** HRMS — HR desk only. Pre-joining and onboarding are completed by HR, not a separate joiner portal. */
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
    return <Navigate to="/login/hr" replace state={{ from: loc.pathname }} />;
  }

  if (isJoiningEmployee(user)) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4">
        <Card className="!p-6 space-y-3">
          <h1 className="font-display text-xl text-ink">Pre-joining handled by HR</h1>
          <p className="text-sm text-steel-muted leading-relaxed">
            SPDC HR completes document collection, appointment letter, and Day 1 onboarding with you directly.
            You do not need a separate portal login before joining.
          </p>
          <p className="text-sm text-steel-muted">
            After your joining date, HR will share your staff login for site and office tools.
          </p>
        </Card>
      </div>
    );
  }

  if (user.role !== "admin" && user.role !== "office") {
    if (user.role !== "hr" && !user.hrDeskOnly) {
      return <Navigate to={homePathForUser(user)} replace />;
    }
  }
  return <>{children}</>;
}
