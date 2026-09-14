import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../auth";
import { homePathForUser } from "../../lib/portalAccounts";

/** HRMS is for office/admin and the HR role (HR portal only). */
export default function HrmsProtected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-[40vh] grid place-items-center text-steel-muted font-mono text-sm">
        Loading HRMS…
      </div>
    );
  }
  if (!user) return <Navigate to="/login/hr" replace />;
  if (user.role !== "admin" && user.role !== "office") {
    if (user.role !== "hr" && !user.hrDeskOnly) {
      return <Navigate to={homePathForUser(user)} replace />;
    }
  }
  return <>{children}</>;
}
