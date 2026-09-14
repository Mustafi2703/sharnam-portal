import { Navigate } from "react-router-dom";
import { useAuth } from "../../auth";

/** Office CRM uses /crm/projects for the register — not the legacy portfolio page. */
export default function CrmProjectsRedirect() {
  const { user } = useAuth();
  if (user?.role === "admin" || user?.role === "office") {
    return <Navigate to="/crm/projects" replace />;
  }
  return <Navigate to="/dashboard" replace />;
}
