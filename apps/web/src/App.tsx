import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { AppShell } from "./components/AppShell";
import MasterModulePage from "./pages/MasterModulePage";
import { LoginHubPage, PortalLoginPage, consumeLoginLanding } from "./pages/PortalLogins";
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
import ProgressPage from "./pages/project/ProgressPage";
import ChecklistMasterPage from "./pages/project/ChecklistMasterPage";
import RevisionUploadPage from "./pages/project/RevisionUploadPage";
import ChecklistAssignPage from "./pages/project/ChecklistAssignPage";
import { applyThemeOption } from "./themes";

applyThemeOption("ui-2");

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
  if (user?.role === "admin" || user?.role === "office" || user?.portal === "office" || user?.portal === "admin") {
    try {
      const landing = localStorage.getItem("sharnam_login_landing");
      if (landing) return <Navigate to={consumeLoginLanding()} replace />;
    } catch {
      /* ignore */
    }
    return <Navigate to="/master" replace />;
  }
  if (
    user?.portal === "site" ||
    user?.role === "site_employee" ||
    user?.role === "vendor"
  ) {
    return <Navigate to={consumeLoginLanding()} replace />;
  }
  return <Navigate to={consumeLoginLanding()} replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Locked to Graphite Procore (ui-2) */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/options" element={<Navigate to="/login" replace />} />
      <Route path="/themes" element={<Navigate to="/workspace" replace />} />
      <Route path="/ui/:optionId" element={<Navigate to="/login" replace />} />

      <Route path="/login" element={<LoginHubPage />} />
      <Route path="/login/master" element={<PortalLoginPage portalKey="master" />} />
      <Route path="/login/drawings" element={<PortalLoginPage portalKey="drawings" />} />
      <Route path="/login/quality" element={<PortalLoginPage portalKey="quality" />} />
      <Route path="/login/comms" element={<PortalLoginPage portalKey="comms" />} />
      <Route path="/login/field" element={<PortalLoginPage portalKey="field" />} />
      <Route path="/login/client" element={<PortalLoginPage portalKey="client" />} />
      <Route path="/login/site" element={<PortalLoginPage portalKey="site" />} />
      <Route path="/login/employee" element={<PortalLoginPage portalKey="employee" />} />
      <Route path="/login/office" element={<PortalLoginPage portalKey="office" />} />
      <Route path="/login/vendor" element={<PortalLoginPage portalKey="vendor" />} />

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
                <Route path="/app" element={<HomeRedirect />} />
                <Route path="/workspace" element={<WorkspacePage />} />
                <Route path="/master" element={<MasterModulePage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/projects/:id" element={<ProjectToolsLayout />}>
                  <Route index element={<ProjectHomePage />} />
                  <Route path="directory" element={<DirectoryPage />} />
                  <Route path="vendors" element={<VendorsPage />} />
                  <Route path="drawings" element={<DrawingsPage />} />
                  <Route path="drawings/upload-revision" element={<RevisionUploadPage />} />
                  <Route path="drawings/upload-revision/:drawingId" element={<RevisionUploadPage />} />
                  <Route path="dms" element={<DmsPage />} />
                  <Route path="checklist" element={<ChecklistPage family="SiteExecution" />} />
                  <Route path="checklist/assign" element={<ChecklistAssignPage />} />
                  <Route path="quality-inspections" element={<ChecklistPage family="QualityInspection" />} />
                  <Route path="inspections" element={<InspectionsPage />} />
                  <Route path="safety" element={<SafetyPage />} />
                  <Route path="progress" element={<ProgressPage />} />
                  <Route path="checklist-master" element={<ChecklistMasterPage />} />
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
