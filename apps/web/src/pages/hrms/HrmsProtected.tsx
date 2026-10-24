import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../auth";
import { homePathForUser } from "../../lib/portalAccounts";

/** HRMS — HR desk only. Pre-joining and onboarding are completed by HR staff. */
export default function HrmsProtected({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const loc = useLocation();

  if (!user) {
    return <Navigate to="/login/hr" replace state={{ from: loc.pathname }} />;
  }

  if (user.role !== "admin" && user.role !== "office") {
    if (user.role !== "hr" && !user.hrDeskOnly) {
      return <Navigate to={homePathForUser(user)} replace />;
    }
  }
  return <>{children}</>;
}
