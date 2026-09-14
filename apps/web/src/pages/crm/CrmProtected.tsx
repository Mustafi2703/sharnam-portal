import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../auth";
import { homePathForUser } from "../../lib/portalAccounts";

/** CRM desk: office/admin full desk; vendors only bid tools; everyone else stays on their own portal. */
export default function CrmProtected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="min-h-[40vh] grid place-items-center text-steel-muted font-mono text-sm">
        Loading CRM…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.hrDeskOnly) return <Navigate to="/hrm" replace />;

  const vendorBids = loc.pathname.startsWith("/crm/vendor-bids");
  if (user.role === "vendor") {
    if (vendorBids) return <>{children}</>;
    return <Navigate to="/crm/vendor-bids" replace />;
  }
  if (user.role === "admin" || user.role === "office") return <>{children}</>;
  return <Navigate to={homePathForUser(user)} replace />;
}
