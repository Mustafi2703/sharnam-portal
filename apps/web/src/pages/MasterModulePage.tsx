import { Navigate, useSearchParams } from "react-router-dom";

const TAB_TO_CRM: Record<string, string> = {
  clients: "/crm/directory/clients",
  vendors: "/crm/directory/vendors",
  stakeholders: "/crm/directory/stakeholders",
  packages: "/crm/packages",
  projects: "/crm/projects",
};

/** Legacy /master company-directory URLs — everything lives on the CRM desk now. */
export default function MasterModulePage() {
  const [params] = useSearchParams();
  const tab = params.get("tab");
  const projectId = params.get("project");

  if (projectId) {
    return <Navigate to={`/crm/setup?projectId=${encodeURIComponent(projectId)}`} replace />;
  }

  if (tab && TAB_TO_CRM[tab]) {
    return <Navigate to={TAB_TO_CRM[tab]} replace />;
  }

  return <Navigate to="/crm" replace />;
}
