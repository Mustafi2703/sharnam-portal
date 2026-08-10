import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { useAuth } from "./auth";
import { AppShell } from "./components/AppShell";
import MasterModulePage from "./pages/MasterModulePage";
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
import FinancePage from "./pages/FinancePage";
import DmsPage from "./pages/DmsPage";
import DrawingsLibraryPage from "./pages/DrawingsLibraryPage";
import ReportsPage from "./pages/ReportsPage";
import AuditPage from "./pages/AuditPage";
import RolesPage from "./pages/RolesPage";
import CrmPage from "./pages/CrmPage";
import CrmBidComparePage from "./pages/CrmBidComparePage";
import HrmPage from "./pages/HrmPage";
import HrmsLayout from "./pages/hrms/HrmsLayout";
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
import ChecklistLogsPage from "./pages/project/ChecklistLogsPage";
import RevisionUploadPage from "./pages/project/RevisionUploadPage";
import ChecklistAssignPage from "./pages/project/ChecklistAssignPage";
import ModuleHubPage from "./pages/project/ModuleHubPage";
import QapPage from "./pages/project/QapPage";
import DrawingPreCheckPage from "./pages/DrawingPreCheckPage";
import SitePilotPage from "./pages/SitePilotPage";
import QuotationMakerPage from "./pages/QuotationMakerPage";
import CustomSheetsPage, { CustomSheetEditorPage } from "./pages/CustomSheetsPage";
import RecruitmentPage from "./pages/RecruitmentPage";
import OnboardingPage from "./pages/OnboardingPage";
import PayrollPage from "./pages/PayrollPage";
import DprMakerPage from "./pages/DprMakerPage";
import WprMakerPage from "./pages/WprMakerPage";
import HrmsAttendancePage from "./pages/HrmsAttendancePage";
import HrmsLeavePage from "./pages/HrmsLeavePage";
import HrmsMastersPage from "./pages/HrmsMastersPage";
import UploadLabPage from "./pages/UploadLabPage";
import SiteAttendancePage from "./pages/SiteAttendancePage";

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
  return <Navigate to="/dashboard" replace />;
}

function RedirectHrmsOnboarding() {
  const { offerId } = useParams();
  return <Navigate to={`/hrm/onboarding/${offerId || ""}`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/options" element={<Navigate to="/login" replace />} />
      <Route path="/themes" element={<Navigate to="/workspace" replace />} />
      <Route path="/ui/:optionId" element={<Navigate to="/login" replace />} />

      <Route path="/login" element={<LoginHubPage />} />
      <Route path="/login/office" element={<PortalLoginPage portalKey="office" />} />
      <Route path="/login/site" element={<PortalLoginPage portalKey="site" />} />
      <Route path="/login/vendor" element={<PortalLoginPage portalKey="vendor" />} />
      <Route path="/login/client" element={<PortalLoginPage portalKey="client" />} />
      <Route path="/login/:portalKey" element={<Navigate to="/login" replace />} />

      <Route
        path="/projects/:id/checklist/fill/:assignmentId"
        element={
          <Protected>
            <ChecklistFillPage />
          </Protected>
        }
      />
      <Route
        path="/projects/:id/drawings/precheck"
        element={
          <Protected>
            <DrawingPreCheckPage />
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
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/workspace" element={<WorkspacePage />} />
                <Route path="/master" element={<MasterModulePage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/projects/:id" element={<ProjectToolsLayout />}>
                  <Route index element={<ProjectHomePage />} />
                  <Route path="hub/drawings" element={<ModuleHubPage moduleKey="drawings" />} />
                  <Route path="hub/quality" element={<ModuleHubPage moduleKey="quality" />} />
                  <Route path="hub/safety" element={<ModuleHubPage moduleKey="safety" />} />
                  <Route path="hub/progress" element={<ModuleHubPage moduleKey="progress" />} />
                  <Route path="hub/field" element={<ModuleHubPage moduleKey="field" />} />
                  <Route path="hub/comms" element={<ModuleHubPage moduleKey="comms" />} />
                  <Route path="hub/cost" element={<ModuleHubPage moduleKey="cost" />} />
                  <Route path="hub/finance" element={<ModuleHubPage moduleKey="finance" />} />
                  <Route path="hub/reports" element={<ModuleHubPage moduleKey="reports" />} />
                  <Route path="directory" element={<DirectoryPage />} />
                  <Route path="vendors" element={<VendorsPage />} />
                  <Route path="drawings" element={<DrawingsPage />} />
                  <Route path="drawings/upload-revision" element={<RevisionUploadPage />} />
                  <Route path="drawings/upload-revision/:drawingId" element={<RevisionUploadPage />} />
                  <Route path="drawings/library" element={<DrawingsLibraryPage />} />
                  <Route path="dms" element={<DmsPage mode="documents" />} />
                  <Route path="checklist" element={<ChecklistPage family="SiteExecution" />} />
                  <Route path="checklist/assign" element={<ChecklistAssignPage />} />
                  <Route path="quality-inspections" element={<ChecklistPage family="QualityInspection" />} />
                  <Route path="inspections" element={<InspectionsPage />} />
                  <Route path="qap" element={<QapPage />} />
                  <Route path="safety" element={<SafetyPage />} />
                  <Route path="progress" element={<ProgressPage />} />
                  <Route path="checklist-master" element={<ChecklistMasterPage />} />
                  <Route path="checklist-logs" element={<ChecklistLogsPage />} />
                  <Route path="rfis" element={<RfisPage />} />
                  <Route path="submittals" element={<SubmittalsPage />} />
                  <Route path="photos" element={<PhotosPage />} />
                  <Route path="diary" element={<DiaryPage />} />
                  <Route path="comms" element={<CommsPage />} />
                  <Route path="coordination" element={<CoordinationPage />} />
                  <Route path="email" element={<ProjectEmailSettingsPage />} />
                  <Route path="cost" element={<CostPage />} />
                  <Route path="finance" element={<FinancePage />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="site-pilot" element={<SitePilotPage />} />
                  <Route path="dpr-maker" element={<DprMakerPage />} />
                  <Route path="wpr-maker" element={<WprMakerPage />} />
                </Route>
                <Route path="/audit" element={<AuditPage />} />
                <Route path="/roles" element={<RolesPage />} />
                <Route path="/crm" element={<CrmPage />} />
                <Route path="/crm/bid-compare" element={<CrmBidComparePage />} />
                <Route path="/hrm" element={<HrmsLayout />}>
                  <Route index element={<HrmPage />} />
                  <Route path="recruitment" element={<RecruitmentPage />} />
                  <Route path="onboarding" element={<OnboardingPage />} />
                  <Route path="onboarding/:offerId" element={<OnboardingPage />} />
                  <Route path="payroll" element={<PayrollPage />} />
                  <Route path="attendance" element={<HrmsAttendancePage />} />
                  <Route path="leave" element={<HrmsLeavePage />} />
                  <Route path="masters" element={<HrmsMastersPage />} />
                </Route>
                {/* Legacy HRMS URLs → unified /hrm/* */}
                <Route path="/hrms/recruitment" element={<Navigate to="/hrm/recruitment" replace />} />
                <Route path="/hrms/onboarding" element={<Navigate to="/hrm/onboarding" replace />} />
                <Route path="/hrms/onboarding/:offerId" element={<RedirectHrmsOnboarding />} />
                <Route path="/hrms/payroll" element={<Navigate to="/hrm/payroll" replace />} />
                <Route path="/hrms/attendance" element={<Navigate to="/hrm/attendance" replace />} />
                <Route path="/hrms/leave" element={<Navigate to="/hrm/leave" replace />} />
                <Route path="/hrms/masters" element={<Navigate to="/hrm/masters" replace />} />
                <Route path="/quotations/new" element={<QuotationMakerPage />} />
                <Route path="/quotations/:id" element={<QuotationMakerPage />} />
                <Route path="/custom-sheets" element={<CustomSheetsPage />} />
                <Route path="/custom-sheets/:id" element={<CustomSheetEditorPage />} />
                <Route path="/upload-lab" element={<UploadLabPage />} />
                <Route path="/attendance" element={<SiteAttendancePage />} />
              </Routes>
            </AppShell>
          </Protected>
        }
      />
    </Routes>
  );
}
