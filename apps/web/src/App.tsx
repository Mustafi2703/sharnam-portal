import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { AppShell } from "./components/AppShell";
import { LoginHubPage, PortalLoginPage } from "./pages/PortalLogins";
import DashboardPage from "./pages/DashboardPage";
import ProjectsPage from "./pages/ProjectsPage";
import ChecklistPage from "./pages/ChecklistPage";
import ChecklistFillPage from "./pages/ChecklistFillPage";
import WorkspacePage from "./pages/WorkspacePage";
import ProjectEmailSettingsPage from "./pages/ProjectEmailSettingsPage";
import DiaryPage from "./pages/DiaryPage";
import CommsPage from "./pages/CommsPage";
import CostPage from "./pages/CostPage";
import DmsPage from "./pages/DmsPage";
import ReportsPage from "./pages/ReportsPage";
import AuditPage from "./pages/AuditPage";
import RolesPage from "./pages/RolesPage";
import CrmPage from "./pages/CrmPage";
import HrmPage from "./pages/HrmPage";
import ProjectToolsLayout from "./pages/project/ProjectToolsLayout";
import ProjectHomePage from "./pages/project/ProjectHomePage";
import VendorsPage from "./pages/project/VendorsPage";
import RfisPage from "./pages/project/RfisPage";
import InspectionsPage from "./pages/project/InspectionsPage";
import DirectoryPage from "./pages/project/DirectoryPage";
import DrawingsPage from "./pages/project/DrawingsPage";
import { SubmittalsPage, PhotosPage, CoordinationPage } from "./pages/project/ExtraToolsPages";
import SafetyPage from "./pages/project/SafetyPage";

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

function HomeRedirect() {
  const { user } = useAuth();
  if (user?.portal === "office" || user?.portal === "site" || user?.role === "site_employee" || user?.role === "office" || user?.role === "vendor") {
    return <Navigate to="/workspace" replace />;
  }
  return <DashboardPage />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginHubPage />} />
      <Route path="/login/client" element={<PortalLoginPage portalKey="client" />} />
      <Route path="/login/site" element={<PortalLoginPage portalKey="site" />} />
      <Route path="/login/employee" element={<PortalLoginPage portalKey="employee" />} />
      <Route path="/login/office" element={<PortalLoginPage portalKey="office" />} />
      <Route path="/login/vendor" element={<PortalLoginPage portalKey="vendor" />} />

      {/* Spacious checklist fill — own chrome, no tool sidebar */}
      <Route
        path="/projects/:id/checklist/fill/:assignmentId"
        element={
          <Protected>
            <ChecklistFillPage />
          </Protected>
        }
      />

      <Route
        path="/*"
        element={
          <Protected>
            <AppShell>
              <Routes>
                <Route path="/" element={<HomeRedirect />} />
                <Route path="/workspace" element={<WorkspacePage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/projects/:id" element={<ProjectToolsLayout />}>
                  <Route index element={<ProjectHomePage />} />
                  <Route path="directory" element={<DirectoryPage />} />
                  <Route path="vendors" element={<VendorsPage />} />
                  <Route path="drawings" element={<DrawingsPage />} />
                  <Route path="dms" element={<DmsPage />} />
                  <Route path="checklist" element={<ChecklistPage family="SiteExecution" />} />
                  <Route path="quality-inspections" element={<ChecklistPage family="QualityInspection" />} />
                  <Route path="inspections" element={<InspectionsPage />} />
                  <Route path="safety" element={<SafetyPage />} />
                  <Route path="rfis" element={<RfisPage />} />
                  <Route path="submittals" element={<SubmittalsPage />} />
                  <Route path="photos" element={<PhotosPage />} />
                  <Route path="diary" element={<DiaryPage />} />
                  <Route path="comms" element={<CommsPage />} />
                  <Route path="coordination" element={<CoordinationPage />} />
                  <Route path="email" element={<ProjectEmailSettingsPage />} />
                  <Route path="cost" element={<CostPage />} />
                  <Route path="reports" element={<ReportsPage />} />
                </Route>
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
