import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

const EXEMPT_PREFIXES = ["/attendance", "/login", "/hrm"];

/** Site employees must check in (selfie + GPS) before using the rest of the portal. */
export function SiteAttendanceGate({ children }: { children: ReactNode }) {
  const { user, token, loading } = useAuth();
  const location = useLocation();
  const [checkedIn, setCheckedIn] = useState<boolean | null>(null);

  const isSiteEmployee = user?.role === "site_employee";
  const exempt = EXEMPT_PREFIXES.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`));

  useEffect(() => {
    if (!isSiteEmployee || !token || exempt) {
      setCheckedIn(null);
      return;
    }
    let cancelled = false;
    api<any>("/api/hrm/attendance/today", { token })
      .then((row) => {
        if (!cancelled) setCheckedIn(Boolean(row?.checkIn));
      })
      .catch(() => {
        if (!cancelled) setCheckedIn(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSiteEmployee, token, exempt, location.pathname]);

  if (loading || !isSiteEmployee || exempt) return <>{children}</>;
  if (checkedIn === null) {
    return (
      <div className="min-h-[40vh] grid place-items-center text-steel-muted text-sm">
        Checking attendance…
      </div>
    );
  }
  if (!checkedIn) return <Navigate to="/attendance" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
