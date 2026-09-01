import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { useAuth } from "./auth";
import { AppShell } from "./components/AppShell";
import MasterModulePage from "./pages/MasterModulePage";
import GlobalVendorsPage from "./pages/GlobalVendorsPage";
import { LoginHubPage, PortalLoginPage, DynamicPortalLoginRoute } from "./pages/PortalLogins";
import StakeholderDeskPage from "./pages/StakeholderDeskPage";
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
import CrmLayout from "./pages/crm/CrmLayout";
import CrmPage from "./pages/CrmPage";
import CrmBidComparePage from "./pages/CrmBidComparePage";
import CrmVendorBidsPage from "./pages/CrmVendorBidsPage";
import HrmPage from "./pages/HrmPage";
import HrmsProtected from "./pages/hrms/HrmsProtected";
import HrmsLayout from "./pages/hrms/HrmsLayout";
import HrmsShell from "./pages/hrms/HrmsShell";
import ProjectToolsLayout from "./pages/project/ProjectToolsLayout";
import ProjectHomePage from "./pages/project/ProjectHomePage";
import VendorsPage from "./pages/project/VendorsPage";
import RfisPage from "./pages/project/RfisPage";
import InspectionsPage from "./pages/project/InspectionsPage";
import InspectionRegisterPage from "./pages/project/InspectionRegisterPage";
import NcrFormPage from "./pages/project/NcrFormPage";
import DirectoryPage from "./pages/project/DirectoryPage";
import DrawingsPage from "./pages/project/DrawingsPage";
import { SubmittalsPage, PhotosPage, CoordinationPage } from "./pages/project/ExtraToolsPages";
import SafetyPage from "./pages/project/SafetyPage";
import DrawingRegisterPage from "./pages/project/DrawingRegisterPage";
import ProjectClosurePage from "./pages/project/ProjectClosurePage";
import ProgressPage from "./pages/project/ProgressPage";
import AuditKpiPage from "./pages/project/AuditKpiPage";
import ChecklistMasterPage from "./pages/project/ChecklistMasterPage";
import ChecklistLogsPage from "./pages/project/ChecklistLogsPage";
import RevisionUploadPage from "./pages/project/RevisionUploadPage";
import ChecklistAssignPage from "./pages/project/ChecklistAssignPage";
import ModuleHubPage from "./pages/project/ModuleHubPage";
import QapPage from "./pages/project/QapPage";
import DrawingPreCheckPage from "./pages/DrawingPreCheckPage";
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
import HrmsDocumentsPage from "./pages/hrms/HrmsDocumentsPage";
import HrmsUsersPage from "./pages/hrms/HrmsUsersPage";
import HrmsVendorsPage from "./pages/hrms/HrmsVendorsPage";
import CrmDirectoryPage from "./pages/crm/CrmDirectoryPage";
import SiteAttendancePage from "./pages/SiteAttendancePage";
import TrainingPage from "./pages/TrainingPage";
import { SiteAttendanceGate } from "./components/SiteAttendanceGate";

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
  if (user?.role === "site_employee") return <Navigate to="/attendance" replace />;
  return <Navigate to="/dashboard" replace />;
}

function RedirectCrmQuotation() {
  const { id } = useParams();
  return <Navigate to={`/crm/proposals/${id || ""}`} replace />;
}

function RedirectHrmsOnboarding() {
  const { offerId } = useParams();
  return <Navigate to={`/hrm/onboarding/${offerId || ""}`} replace />;
}

function RedirectCrmBidPackage() {
  const { id } = useParams();
  return <Navigate to={`/crm/bids/${id || ""}`} replace />;
}

function RedirectDrawingsCoordination() {
  const { id } = useParams();
  return <Navigate to={`/projects/${id}/drawings/coordination`} replace />;
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
      <Route path="/login/hr" element={<PortalLoginPage portalKey="hr" />} />
      <Route path="/login/stakeholder" element={<PortalLoginPage portalKey="stakeholder" />} />
      <Route path="/login/:portalKey" element={<DynamicPortalLoginRoute />} />

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

      {/* HRMS — standalone portal (HR login at /login/hr) */}
      <Route
        path="/hrm"
        element={
          <Protected>
            <HrmsProtected>
              <HrmsShell />
            </HrmsProtected>
          </Protected>
        }
      >
        <Route element={<HrmsLayout />}>
          <Route index element={<HrmPage />} />
          <Route path="recruitment" element={<RecruitmentPage />} />
          <Route path="onboarding" element={<OnboardingPage />} />
          <Route path="onboarding/:offerId" element={<OnboardingPage />} />
          <Route path="payroll" element={<PayrollPage />} />
          <Route path="attendance" element={<HrmsAttendancePage />} />
          <Route path="leave" element={<HrmsLeavePage />} />
          <Route path="documents" element={<HrmsDocumentsPage />} />
          <Route path="masters" element={<HrmsMastersPage />} />
          <Route path="users" element={<HrmsUsersPage />} />
          <Route path="vendors" element={<HrmsVendorsPage />} />
        </Route>
      </Route>

      <Route
        path="/*"
        element={
          <Protected>
            <SiteAttendanceGate>
            <AppShell>
              <Routes>
                <Route path="/app" element={<HomeRedirect />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/workspace" element={<WorkspacePage />} />
                <Route path="/training" element={<TrainingPage />} />
                <Route path="/master" element={<MasterModulePage />} />
                <Route path="/master/vendors" element={<GlobalVendorsPage />} />
                <Route path="/master/checklists" element={<ChecklistMasterPage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/projects/:id" element={<ProjectToolsLayout />}>
                  <Route index element={<ProjectHomePage />} />
                  <Route path="hub/drawings" element={<ModuleHubPage moduleKey="drawings" />} />
                  <Route path="hub/dms" element={<ModuleHubPage moduleKey="dms" />} />
                  <Route path="hub/quality" element={<ModuleHubPage moduleKey="quality" />} />
                  <Route path="hub/safety" element={<ModuleHubPage moduleKey="safety" />} />
                  <Route path="hub/inspection" element={<ModuleHubPage moduleKey="inspection" />} />
                  <Route path="hub/progress" element={<ModuleHubPage moduleKey="progress" />} />
                  <Route path="hub/auditKpi" element={<ModuleHubPage moduleKey="auditKpi" />} />
                  <Route path="hub/comms" element={<ModuleHubPage moduleKey="comms" />} />
                  <Route path="hub/cost" element={<ModuleHubPage moduleKey="cost" />} />
                  <Route path="hub/finance" element={<ModuleHubPage moduleKey="finance" />} />
                  <Route path="hub/reports" element={<ModuleHubPage moduleKey="reports" />} />
                  <Route path="hub/closure" element={<ModuleHubPage moduleKey="closure" />} />
                  <Route path="directory" element={<DirectoryPage />} />
                  <Route path="vendors" element={<VendorsPage />} />
                  <Route path="drawings" element={<DrawingsPage />} />
                  <Route path="drawings/register" element={<DrawingRegisterPage />} />
                  <Route path="drawings/upload-revision" element={<RevisionUploadPage />} />
                  <Route path="drawings/upload-revision/:drawingId" element={<RevisionUploadPage />} />
                  <Route path="drawings/library" element={<DrawingsLibraryPage />} />
                  <Route path="drawings/coordination" element={<CoordinationPage />} />
                  <Route path="drawings/checklist-master" element={<ChecklistMasterPage lockedFamily="DrawingCheck" />} />
                  <Route path="drawings/checklist-logs" element={<ChecklistLogsPage lockedFamily="DrawingCheck" />} />
                  <Route path="dms" element={<DmsPage mode="documents" />} />
                  <Route path="checklist" element={<ChecklistPage family="SiteExecution" />} />
                  <Route path="checklist/assign" element={<ChecklistAssignPage />} />
                  <Route path="quality-inspections" element={<ChecklistPage family="QualityInspection" />} />
                  <Route path="inspections" element={<InspectionsPage />} />
                  <Route path="inspection-register" element={<InspectionRegisterPage />} />
                  <Route path="ncr-form/:scope/:recordId" element={<NcrFormPage />} />
                  <Route path="qap" element={<QapPage />} />
                  <Route path="safety" element={<SafetyPage />} />
                  <Route path="closure" element={<ProjectClosurePage />} />
                  <Route path="progress" element={<ProgressPage />} />
                  <Route path="quality/checklist-master" element={<ChecklistMasterPage lockedFamily="QualityInspection" />} />
                  <Route path="safety/checklist-master" element={<ChecklistMasterPage lockedFamily="Safety" />} />
                  <Route path="inspection/checklist-master" element={<ChecklistMasterPage lockedFamily="ActivityInspection" />} />
                  <Route path="progress/checklist-master" element={<ChecklistMasterPage lockedFamily="SiteExecution" />} />
                  <Route path="quality/checklist-logs" element={<ChecklistLogsPage lockedFamily="QualityInspection" />} />
                  <Route path="safety/checklist-logs" element={<ChecklistLogsPage lockedFamily="Safety" />} />
                  <Route path="inspection/checklist-logs" element={<ChecklistLogsPage lockedFamily="ActivityInspection" />} />
                  <Route path="progress/checklist-logs" element={<ChecklistLogsPage lockedFamily="SiteExecution" />} />
                  <Route path="checklist-master" element={<ChecklistMasterPage />} />
                  <Route path="checklist-logs" element={<ChecklistLogsPage />} />
                  <Route path="rfis" element={<RfisPage />} />
                  <Route path="submittals" element={<SubmittalsPage />} />
                  <Route path="photos" element={<PhotosPage />} />
                  <Route path="diary" element={<DiaryPage />} />
                  <Route path="comms" element={<CommsPage />} />
                  <Route path="coordination" element={<RedirectDrawingsCoordination />} />
                  <Route path="email" element={<ProjectEmailSettingsPage />} />
                  <Route path="cost" element={<CostPage />} />
                  <Route path="finance" element={<FinancePage />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="audit-kpi" element={<AuditKpiPage />} />
                  <Route path="dpr-maker" element={<DprMakerPage />} />
                  <Route path="wpr-maker" element={<WprMakerPage />} />
                </Route>
                <Route path="/audit" element={<AuditPage />} />
                <Route path="/roles" element={<RolesPage />} />
                <Route path="/crm" element={<CrmLayout />}>
                  <Route index element={<Navigate to="/crm/leads" replace />} />
                  <Route path="leads" element={<CrmPage />} />
                  <Route path="proposals/new" element={<QuotationMakerPage />} />
                  <Route path="proposals/:id" element={<QuotationMakerPage />} />
                  <Route path="proposals" element={<CrmPage />} />
                  <Route path="projects" element={<CrmPage />} />
                  <Route path="directory/:tab" element={<CrmDirectoryPage />} />
                  <Route path="directory" element={<Navigate to="/crm/directory/vendors" replace />} />
                  <Route path="bids" element={<CrmBidComparePage />} />
                  <Route path="bids/:id" element={<CrmBidComparePage />} />
                  <Route path="vendor-bids" element={<CrmVendorBidsPage />} />
                </Route>
                <Route path="/crm/bid-compare" element={<Navigate to="/crm/bids" replace />} />
                <Route path="/crm/bid-compare/:id" element={<RedirectCrmBidPackage />} />
                {/* Legacy HRMS URLs → unified /hrm/* (standalone portal) */}
                <Route path="/hrms/recruitment" element={<Navigate to="/hrm/recruitment" replace />} />
                <Route path="/hrms/onboarding" element={<Navigate to="/hrm/onboarding" replace />} />
                <Route path="/hrms/onboarding/:offerId" element={<RedirectHrmsOnboarding />} />
                <Route path="/hrms/payroll" element={<Navigate to="/hrm/payroll" replace />} />
                <Route path="/hrms/attendance" element={<Navigate to="/hrm/attendance" replace />} />
                <Route path="/hrms/leave" element={<Navigate to="/hrm/leave" replace />} />
                <Route path="/hrms/masters" element={<Navigate to="/hrm/masters" replace />} />
                <Route path="/quotations/new" element={<Navigate to="/crm/proposals/new" replace />} />
                <Route path="/quotations/:id" element={<RedirectCrmQuotation />} />
                <Route path="/custom-sheets" element={<CustomSheetsPage />} />
                <Route path="/custom-sheets/:id" element={<CustomSheetEditorPage />} />
                <Route path="/stakeholder" element={<StakeholderDeskPage />} />
                <Route path="/attendance" element={<SiteAttendancePage />} />
              </Routes>
            </AppShell>
            </SiteAttendanceGate>
          </Protected>
        }
      />
    </Routes>
  );
}
