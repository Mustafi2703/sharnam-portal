import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../auth";

/** HRMS is only for Sharnam office admins and HR desk users (admin / office roles). */
export default function HrmsProtected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login/hr" replace />;
  if (user.role !== "admin" && user.role !== "office") {
    return <Navigate to="/login/hr" replace state={{ denied: true }} />;
  }
  return <>{children}</>;
}
