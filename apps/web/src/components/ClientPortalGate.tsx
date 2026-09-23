import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { clientPortalRedirect, isClientPortalUser } from "../lib/clientPortal";

/** Keeps client logins on read-only project modules — blocks CRM, HRMS, makers, and admin desks. */
export default function ClientPortalGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { pathname } = useLocation();

  if (!isClientPortalUser(user?.role)) return <>{children}</>;

  const redirect = clientPortalRedirect(pathname);
  if (redirect && redirect !== pathname) {
    return <Navigate to={redirect} replace />;
  }

  return <>{children}</>;
}
