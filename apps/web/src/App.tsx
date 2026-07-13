import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { AppShell } from "./components/AppShell";
import { LoginHubPage, PortalLoginPage } from "./pages/PortalLogins";
import DashboardPage from "./pages/DashboardPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import ChecklistPage from "./pages/ChecklistPage";
import DiaryPage from "./pages/DiaryPage";
import CommsPage from "./pages/CommsPage";
import CostPage from "./pages/CostPage";
import DmsPage from "./pages/DmsPage";
import ReportsPage from "./pages/ReportsPage";
import AuditPage from "./pages/AuditPage";
import RolesPage from "./pages/RolesPage";
import CrmPage from "./pages/CrmPage";
import HrmPage from "./pages/HrmPage";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-steel-muted font-mono text-sm">
        Loading portal…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginHubPage />} />
      <Route path="/login/client" element={<PortalLoginPage portalKey="client" />} />
      <Route path="/login/site" element={<PortalLoginPage portalKey="site" />} />
      <Route path="/login/employee" element={<PortalLoginPage portalKey="employee" />} />
      <Route path="/login/office" element={<PortalLoginPage portalKey="office" />} />
      <Route
        path="/*"
        element={
          <Protected>
            <AppShell>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/projects/:id" element={<ProjectDetailPage />} />
                <Route path="/projects/:id/checklist" element={<ChecklistPage />} />
                <Route path="/projects/:id/diary" element={<DiaryPage />} />
                <Route path="/projects/:id/comms" element={<CommsPage />} />
                <Route path="/projects/:id/cost" element={<CostPage />} />
                <Route path="/projects/:id/dms" element={<DmsPage />} />
                <Route path="/projects/:id/reports" element={<ReportsPage />} />
                <Route path="/audit" element={<AuditPage />} />
                <Route path="/roles" element={<RolesPage />} />
                <Route path="/crm" element={<CrmPage />} />
                <Route path="/hrm" element={<HrmPage />} />
              </Routes>
            </AppShell>
          </Protected>
        }
      />
    </Routes>
  );
}
