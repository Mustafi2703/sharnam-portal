import type { RoleKey } from "@sharnam/shared";
import { formatUiText } from "./lib/formatUiText";

/** Workspace → tool path filters (Procore modules) */
export const WORKSPACE_KEY = "sharnam_workspace_key";
export const WORKSPACE_PROJECT_KEY = "sharnam_workspace_project";

export type WorkspaceKey =
  | "drawings"
  | "dms"
  | "quality"
  | "safety"
  | "photos"
  | "progress"
  | "comms"
  | "auditKpi"
  | "cost"
  | "finance"
  | "reports"
  | "closure";

export type ModuleToolItem = {
  to: string;
  label: string;
  end?: boolean;
  roles?: RoleKey[];
  query?: string;
  blurb?: string;
  /** Source Excel sheet name when this tool maps 1:1 from sheet mode */
  sheet?: string;
  /** live = seeded UI; ready = hub reserved, awaits client sheet drop */
  status?: "live" | "ready";
  /** Open the standalone checklist fill popup instead of navigating. */
  fillFamily?: "QualityInspection" | "Safety" | "SiteExecution" | "ActivityInspection" | "DrawingCheck";
};

/** Sub-tools for hub cards + horizontal strip (no left rail) — one card per sheet/tool */
export const MODULE_TOOLS: Record<WorkspaceKey | "home", ModuleToolItem[]> = {
  drawings: [
    {
      to: "drawings",
      label: "Approval & GFC log",
      blurb: "Upload drawings (checklist first, then revision and date). R0–R5 dates per drawing. Excel + PDF.",
      sheet: "Approval & GFC Drawing Log",
    },
    {
      to: "drawings/register",
      label: "Dashboard",
      blurb: "DRAWING REGISTER Dashboard charts — location wise, critical, delay, by org. Pick a week. Branded PDF.",
      sheet: "DRAWING REGISTER · Dashboard",
    },
    {
      to: "drawings/register/master",
      label: "Master register",
      blurb: "Updated by every GFC upload. Set planned dates and criticality; delays tracked. Dashboard, Excel + PDF.",
      sheet: "Master Drawing Register",
    },
    {
      to: "drawings/settings",
      label: "Drawing settings",
      roles: ["admin", "office"],
      blurb: "Pick-lists for the register, RFIs and design coordination; load DRAWING REGISTER, GFC log and RFI register workbooks; save to SharePoint.",
      sheet: "DRAWING REGISTER · Input",
    },
    {
      to: "drawings/coordination",
      label: "Design coordination",
      blurb: "Assign an issue — the assignee is emailed. Follow up up to 5 times; escalate to RFI any time.",
      sheet: "Design coordination register",
    },
    {
      to: "drawings/library",
      label: "Drawing files",
      blurb: "PDF/DWG in SharePoint design folders — not the general document manager.",
      sheet: "Drawing & GFC Drawing Log",
    },
    {
      to: "drawings/checklist-master",
      label: "Checklist manager",
      roles: ["admin", "office", "employee"],
      blurb: "Manage Drawing Check Master templates; upload opens checklist overlay then file dialog.",
      sheet: "Drawing check master",
    },
    {
      to: "drawings/checklist-logs",
      label: "Checklist fill log",
      blurb: "Information only — history of drawing-check fills. Fill from Drawing Check / register.",
    },
    {
      to: "rfis",
      label: "RFI register (log)",
      query: "view=register",
      roles: ["admin", "office", "site_employee", "employee", "vendor", "client"],
      blurb: "Log of open / answered / closed Requests for Information — SPDC_RFI_Form_and_Register.xlsx.",
      sheet: "SPDC_RFI_Form_and_Register.xlsx",
    },
    {
      to: "rfis",
      label: "Raise Request for Information",
      query: "kind=RequestForInformation&compose=1",
      roles: ["admin", "office", "site_employee", "employee", "vendor", "client"],
      blurb: "Design query — link drawing + revision, proposed solution, consultant on matrix.",
    },
  ],
  dms: [
    {
      to: "dms",
      label: "Document manager",
      blurb: "Browse ISO Rev 02 folder tree — contracts, HSE, daily records, MIS. Upload and preview PDFs.",
    },
  ],
  home: [
    { to: "", label: "Overview", end: true, blurb: "Project desk and module shortcuts." },
    {
      to: "setup",
      label: "Live project setup",
      roles: ["admin", "office"],
      blurb: "Allocate SPDC people, add vendors (email required), comms matrix, Complete setup, send invites.",
    },
    { to: "directory", label: "Directory · Office", query: "party=PMC", blurb: "Sharnam Office / PMC people." },
    { to: "directory", label: "Directory · Site", query: "party=Site", blurb: "Site staff on this project." },
    { to: "directory", label: "Directory · Client", query: "party=Client", blurb: "Client contacts." },
    { to: "directory", label: "Directory · Contractor", query: "party=Contractor", blurb: "Contractors on the job." },
    {
      to: "directory",
      label: "Sign-off register",
      blurb: "Upload your signature PNG — used in branded Excel exports (all roles).",
    },
    {
      to: "vendors",
      label: "Vendors",
      roles: ["admin", "office", "site_employee", "employee", "vendor"],
      blurb: "Vendor assignments.",
    },
    {
      to: "email",
      label: "Email",
      roles: ["admin", "office", "site_employee", "employee"],
      blurb: "Project email and WhatsApp notices. Separate from the communication matrix.",
    },
  ],
  quality: [
    {
      to: "actions",
      label: "NCR / CAR to answer",
      end: true,
      roles: ["vendor"],
      blurb: "Quality NCR / CAR issued to your company — root cause, corrective action, evidence.",
    },
    {
      to: "rfis",
      label: "Checklist fills & QI responses",
      end: true,
      roles: ["vendor"],
      blurb: "Complete quality checklists and IR responses assigned to your company.",
    },
    {
      to: "inspections",
      label: "Dashboard",
      roles: ["admin", "office", "site_employee", "employee", "client"],
      blurb: "Quality Dashboard KPIs — week, concreting, QI fills.",
      sheet: "Quality Dashboard.xlsx · Dashboard",
    },
    {
      to: "inspection-register",
      label: "Raise Quality IR (F-01)",
      query: "tab=quality-ir&lock=quality",
      roles: ["admin", "office", "site_employee", "employee"],
      blurb: "Request for Inspection — attach QI checklist + assignee (directory or matrix). Assignees fill from the register.",
      sheet: "SPDC_Request_for_Inspection_Form.xlsx",
    },
    {
      to: "inspection-register",
      label: "Raise Activity checklist (F-02)",
      query: "tab=activity-checklist&lock=quality",
      roles: ["admin", "office", "site_employee", "employee"],
      blurb: "F-02 enclosure linked to a Quality IR — contractor self-check, not a separate RFI type.",
      sheet: "SPDC_Activity_Inspection_Checklist_Format.xlsx",
    },
    {
      to: "quality/files",
      label: "Quality files",
      roles: ["admin", "office", "site_employee", "employee", "client"],
      blurb: "SharePoint ISO 08 tree + portal RFIs, NCR/CAR, QAP and cube exports.",
    },
    {
      to: "inspections",
      label: "SOR Log",
      query: "sheet=sor-log",
      roles: ["admin", "office", "site_employee", "employee", "client"],
      blurb: "Site observation summary — includes live portal entries.",
      sheet: "SOR Log",
    },
    {
      to: "inspections",
      label: "Site observation",
      query: "sheet=site-observation",
      blurb: "Log site observations — updates SOR Log totals.",
      sheet: "Site Observation",
    },
    {
      to: "inspections",
      label: "Site instruction",
      query: "sheet=site-instruction",
      blurb: "Site instruction register — updates SOR Log.",
      sheet: "Site Instruction",
    },
    {
      to: "inspections",
      label: "Checklist summary",
      query: "sheet=checklist-summary",
      blurb: "Sheet1 catalog status only — request fills via Quality IR, not from the catalog.",
      sheet: "Sheet1 / Sheet2",
    },
    {
      to: "inspections",
      label: "CAR / NCR register",
      query: "sheet=car-register",
      blurb: "Non-conformance / corrective action register.",
      sheet: "CAR register · NCR 01",
    },
    {
      to: "quality/ncr-fill-log",
      label: "NCR / CAR fill log",
      roles: ["admin", "office", "employee", "site_employee", "vendor"],
      blurb: "Fill NCR 01 forms like drawing checklists — save drafts, Sync SharePoint, nightly reconcile.",
      sheet: "NCR 01 · NCR CAR",
    },
    {
      to: "inspections",
      label: "Cube Test",
      query: "sheet=cube-test",
      blurb: "Cube cast / test results — SPDC CUBE REGISTER format.",
      sheet: "SPDC CUBE REGISTER",
    },
    {
      to: "qap",
      label: "Quality Assurance Plan",
      roles: ["admin", "office", "employee", "client", "site_employee"],
      blurb: "Full QAP sheet — activity sections, sign-offs, Week 50 upload.",
      sheet: "Quality Assurance Plan Week 50 · Detail",
    },
    {
      to: "quality/qap-master",
      label: "QAP master",
      roles: ["admin", "office", "employee", "site_employee"],
      blurb: "Upload the QAP master Excel; this project's QAP library (activity → checks) and pick-lists; download in Sharnam format.",
      sheet: "Quality Assurance Plan Week 50 · Sheet2",
    },
    {
      to: "quality/checklist-master",
      label: "Quality checklist master",
      roles: ["admin", "office", "site_employee", "employee", "client"],
      blurb: "QI types (Civil, HVAC, Electrical…) and SPDC F-01 templates — create / edit here; fill from the Quality IR register.",
      sheet: "SPDC_Request_for_Inspection_Form.xlsx",
    },
    {
      to: "quality/site-checklist-master",
      label: "Site checklist master",
      roles: ["admin", "office", "site_employee", "employee", "client"],
      blurb: "Field / Final Index templates — SPDC Activity format. Create types here; fill from the Quality register.",
      sheet: "SPDC_Activity_Inspection_Checklist_Format.xlsx",
    },
    {
      to: "quality/checklist-logs",
      label: "Quality fill log",
      blurb: "Information only — log of Quality checklist fills / IR-linked submissions. Raise & fill on the IR register.",
    },
    {
      to: "quality/site-checklist-logs",
      label: "Site execution fill log",
      blurb: "Information only — site checklist fill history. Fill from the Quality register.",
    },
  ],
  safety: [
    {
      to: "actions",
      label: "NCR & safety responses",
      end: true,
      roles: ["vendor"],
      blurb: "Safety NCR / NCN / observations issued to your company — respond; PMC verifies and closes.",
    },
    { to: "safety", label: "Dashboard", roles: ["admin", "office", "site_employee", "employee", "client"], blurb: "Safety Dashboard KPIs.", sheet: "Safety Dashboard.xlsx · One Pager" },
    {
      to: "inspection-register",
      label: "Raise Safety IR (F-01)",
      query: "tab=safety-ir&lock=safety",
      roles: ["admin", "office", "site_employee", "employee"],
      blurb: "Safety Request for Inspection — attach Safety checklist + assignee. Same pattern as Quality IR.",
      sheet: "SPDC_Safety_Inspection_Request_and_Checklists.xlsx",
    },
    {
      to: "safety/files",
      label: "Safety files",
      roles: ["admin", "office", "site_employee", "employee", "client"],
      blurb: "SharePoint HSE folder + safety RFIs and NCR forms — open in SharePoint anytime.",
    },
    {
      to: "safety",
      label: "Site Instruction",
      query: "sheet=site-instruction",
      roles: ["admin", "office", "site_employee", "employee", "client"],
      blurb: "Site instruction register.",
      sheet: "Site Instruction",
    },
    {
      to: "safety",
      label: "Unsafe Act Summary",
      query: "sheet=unsafe-act-summary",
      roles: ["admin", "office", "site_employee", "employee", "client"],
      blurb: "Unsafe act summary register.",
      sheet: "Unsafe Act Summary",
    },
    {
      to: "safety",
      label: "NCR Summary",
      query: "sheet=ncr-summary",
      roles: ["admin", "office", "site_employee", "employee", "client"],
      blurb: "NCR summary register.",
      sheet: "NCR Summary",
    },
    {
      to: "safety",
      label: "NCR Form",
      query: "sheet=ncr-form",
      roles: ["admin", "office", "site_employee", "employee", "client"],
      blurb: "Full NCR form (Safety NCR.xlsx).",
      sheet: "Safety NCR.xlsx",
    },
    {
      to: "safety",
      label: "Observation — Unsafe Act",
      query: "sheet=observation",
      roles: ["admin", "office", "site_employee", "employee", "client"],
      blurb: "Unsafe act observation sheet.",
      sheet: "Observation - Unsafe Act",
    },
    {
      to: "safety",
      label: "HIRA",
      query: "sheet=hira",
      roles: ["admin", "office", "site_employee", "employee", "client"],
      blurb: "Hazard identification & risk assessment.",
      sheet: "HIRA",
    },
    {
      to: "safety",
      label: "Safety Hours",
      query: "sheet=safety-hours",
      roles: ["admin", "office", "site_employee", "employee", "client"],
      blurb: "Safe man-hours & HSE indicators.",
      sheet: "Safety Hours",
    },
    {
      to: "safety/checklist-master",
      label: "Safety checklist master",
      roles: ["admin", "office", "site_employee", "employee", "client"],
      blurb: "Safety checklist types only (not Quality QI) — create / edit here; fill from the Safety IR register.",
    },
    {
      to: "safety/checklist-logs",
      label: "Safety fill log",
      blurb: "Information only — log of Safety checklist fills. Raise & fill on the Safety IR register.",
    },
    {
      to: "inspection-register",
      label: "Safety IR register (log)",
      query: "tab=safety-ir&lock=safety",
      roles: ["admin", "office", "site_employee", "employee", "client"],
      blurb: "Safety’s live register of clearances (F-01) — open / cleared / not cleared.",
      sheet: "SPDC_Safety_Inspection_Request_and_Checklists.xlsx",
    },
    {
      to: "inspection-register",
      label: "HSE register",
      query: "tab=hse-register&lock=safety",
      roles: ["admin", "office", "site_employee", "employee", "client"],
      blurb: "Safety IRs, findings and observations — the HSE log.",
      sheet: "HSE Register",
    },
  ],
  photos: [
    {
      to: "photos",
      label: "Site photos",
      end: true,
      roles: ["admin", "office", "site_employee", "employee", "vendor", "client"],
      blurb: "Day-wise site photos. Take a photo or upload from the phone. Each day is filed on the project drive.",
    },
  ],
  progress: [
    {
      to: "progress",
      label: "Overview",
      end: true,
      blurb: "Workday-style progress KPIs and charts.",
      sheet: "Progress Overview.xlsx",
    },
    {
      to: "progress/files",
      label: "Progress files",
      blurb: "DPR/WPR SharePoint folders, daily site records, published exports.",
    },
    {
      to: "diary",
      label: "Day log · manpower",
      roles: ["admin", "office", "site_employee", "employee", "client"],
      blurb: "Daily manpower and site notes. This feeds the DPR. It is not part of Communications.",
      sheet: "Day log",
    },
    {
      to: "progress",
      label: "Milestones",
      query: "tab=milestones",
      blurb: "Milestone register.",
      sheet: "Milestone tracking.xlsx",
    },
    {
      to: "progress",
      label: "Planned vs Actual",
      query: "tab=planned",
      blurb: "Cashflow · manpower · qty register (Planned Vs. Actual Dashboard).",
      sheet: "Planned Vs. Actual Dashboard",
    },
    {
      to: "progress",
      label: "PvsA · Cashflow",
      query: "tab=planned&pva=cashflow",
      blurb: "Monthly planned vs actual ₹ — syncs to Cost cashflow / WPR.",
      sheet: "Planned Vs. Actual Dashboard",
    },
    {
      to: "progress",
      label: "PvsA · Manpower",
      query: "tab=planned&pva=manpower",
      blurb: "Trade required vs available shortage chart.",
      sheet: "Planned Vs. Actual Dashboard",
    },
    {
      to: "progress",
      label: "PvsA · Activity qty",
      query: "tab=planned&pva=activity",
      blurb: "BOQ / GFC / weekly qty register.",
      sheet: "Planned Vs. Actual Dashboard",
    },
    {
      to: "progress",
      label: "Monthly progress",
      query: "tab=monthly",
      blurb: "SOR / monthly package progress.",
      sheet: "Monthly Progress Dashboard",
    },
    {
      to: "progress",
      label: "Hindrance",
      query: "tab=hindrance",
      blurb: "Hindrance register.",
      sheet: "Hindrance Register Dashboard",
    },
    { to: "progress", label: "Risk", query: "tab=risk", blurb: "Risk register.", sheet: "Risk Register - Dashboard 1.xlsx" },
    {
      to: "progress",
      label: "Legal approvals",
      query: "tab=legal",
      blurb: "Legal / approval tracker.",
      sheet: "Legal Approvals - Dashboard.xlsx",
    },
    {
      to: "progress",
      label: "WPR trackers",
      query: "tab=wpr-trackers",
      blurb: "Value Addition, Procurement, Site Materials — PR and invoices live in Finance.",
      sheet: "WPR-Client-Week-Template.xlsx",
    },
    {
      to: "progress",
      label: "S-curve",
      query: "tab=scurve",
      blurb: "Weekly planned vs actual % from MS Project — feeds DPR/WPR.",
      sheet: "MS Project XML",
    },
    {
      to: "progress",
      label: "MS Project",
      query: "tab=msproject",
      blurb: "Task register from MS Project XML import.",
      sheet: "MS Project XML",
    },
  ],
  comms: [
    {
      to: "comms",
      label: "Communication matrix",
      end: true,
      roles: ["admin", "office", "site_employee", "employee", "client"],
      blurb: "Who talks to whom (roles / channels).",
      sheet: "Communication Matrix_BPCL",
    },
    {
      to: "comms/files",
      label: "Comms files",
      roles: ["admin", "office", "site_employee", "employee", "client"],
      blurb: "MoM exports, meeting packs — SharePoint ISO 03.08 folder.",
    },
    { to: "comms", label: "Agenda", query: "tab=agenda", roles: ["admin", "office", "site_employee", "employee", "client"], blurb: "Create meeting → generate agenda before MoM." },
    { to: "comms", label: "MoM", query: "tab=mom", roles: ["admin", "office", "site_employee", "employee", "client"], blurb: "Minutes + action items." },
    { to: "comms", label: "Follow-up", query: "tab=followup", roles: ["admin", "office", "site_employee", "employee", "client"], blurb: "Open actions from MoM." },
    { to: "comms", label: "Comm log", query: "tab=log", roles: ["admin", "office", "site_employee", "employee", "client"], blurb: "Communication log entries." },
  ],
  auditKpi: [
    {
      to: "audit-kpi",
      label: "Audit dashboard",
      end: true,
      blurb: "Open/closed findings, RAG — SITE_AUDIT_Pack DASHBOARD.",
      sheet: "DASHBOARD",
    },
    {
      to: "audit-kpi/files",
      label: "Audit files",
      blurb: "SharePoint audit programme folder + KPI workbook exports.",
    },
    { to: "audit-kpi", label: "Audit plan", query: "tab=plan", blurb: "Desk review, the day on site, and follow-up.", sheet: "PLAN" },
    { to: "audit-kpi", label: "Findings", query: "tab=findings", blurb: "NC / observation + CAPA.", sheet: "FINDINGS" },
    { to: "audit-kpi", label: "Site walk", query: "tab=site-walk", blurb: "Walkthrough checklist and evidence.", sheet: "SITE_WALK" },
    { to: "audit-kpi", label: "Folder sample", query: "tab=folder-sample", blurb: "Folder-by-folder sampling. Score only what you inspected.", sheet: "FOLDER_SAMPLE" },
    { to: "audit-kpi", label: "DC interview", query: "tab=dc-interview", blurb: "Document controller interview.", sheet: "DC_INTERVIEW" },
    { to: "audit-kpi", label: "KPI dashboard", query: "tab=kpi-dashboard", blurb: "Open, closed, and RAG rolled up from subject data.", sheet: "00_KPI_DASHBOARD" },
    { to: "audit-kpi", label: "ISO folder map", query: "tab=iso-map", blurb: "ISO area, folder, clause, and custodian.", sheet: "01_ISO_FOLDER_MAP" },
    { to: "audit-kpi", label: "Subject data", query: "tab=subjects", blurb: "Per-subject records, open, closed, overdue, and KRA.", sheet: "03_SUBJECT_DATA" },
    { to: "audit-kpi", label: "Weekly trend", query: "tab=trend", blurb: "Friday snapshot. Overdue movement is calculated.", sheet: "04_TREND" },
    { to: "audit-kpi", label: "Role KRA", query: "tab=role-kra", blurb: "Appraisal scorecard by role.", sheet: "06_ROLE_KRA" },
  ],
  cost: [
    {
      to: "cost",
      label: "BOQ / Monitoring",
      end: true,
      blurb: "Monitoring packages — GFC qty, excess / saving.",
      sheet: "Cashflow Dashboard · Monitoring",
    },
    {
      to: "cost/files",
      label: "Cost files",
      blurb: "BOQ, MB/BBS, vendor bills — SharePoint commercial ISO tree.",
    },
    { to: "cost", label: "MB sheets", query: "tab=mb", blurb: "Measurement books by package.", sheet: "SPDC Budget · MB" },
    { to: "cost", label: "BBS", query: "tab=bbs", blurb: "Bar bending schedule.", sheet: "SPDC Budget · BBS" },
    { to: "cost", label: "BBS master", query: "tab=bbs-master", blurb: "Shape codes and diagrams.", sheet: "BBS shape library" },
    {
      to: "cost",
      label: "Project CAPEX / monthly budget",
      query: "tab=budget",
      blurb: "CAPEX is the project budget. Upload the SPDC budget workbook each month.",
      sheet: "SPDC_Budget · Budget",
    },
    {
      to: "cost",
      label: "Cash Flow Chart",
      query: "tab=cashflow&cf=chart",
      blurb: "Planned vs actual chart (INR).",
      sheet: "Cashflow - Dashboard · Chart",
    },
    {
      to: "cost",
      label: "Cash Flow Forecast",
      query: "tab=cashflow&cf=forecast",
      blurb: "Forecast periods.",
      sheet: "Cashflow - Dashboard · Forecast",
    },
    {
      to: "cost",
      label: "Cashflow Tracking",
      query: "tab=cashflow&cf=tracking",
      blurb: "Tracking sheet rows.",
      sheet: "Cashflow - Dashboard · Tracking",
    },
    {
      to: "cost",
      label: "Rate difference",
      query: "tab=rates",
      blurb: "Steel / Cement / Tiles variance.",
      sheet: "Rate difference sheets",
    },
    {
      to: "cost",
      label: "COP / Bills",
      query: "tab=bills",
      blurb: "Payment summary / vendor bills.",
      sheet: "Payment Summary",
    },
    {
      to: "cost",
      label: "Structure upload",
      query: "tab=boq",
      blurb: "Import BOQ structure into monitoring.",
    },
  ],
  finance: [
    { to: "finance", label: "Bill registers", query: "tab=bills", blurb: "Sharnam Payment Summary sheets — create & edit per discipline." },
    {
      to: "finance/files",
      label: "Finance files",
      blurb: "RA certified/submission workbooks, COP — open in SharePoint.",
    },
    { to: "finance", label: "Overview", end: true, blurb: "Open invoices, POs, RA bills, COPs." },
    { to: "finance", label: "PR Tracker", query: "tab=pr-tracker", blurb: "SAP PR register — files to ISO 05.01, feeds WPR." },
    { to: "finance", label: "Invoice processing", query: "tab=invoice-processing", blurb: "Client invoice tracker + COP status — ISO 09.01." },
    { to: "finance", label: "Project CAPEX", query: "tab=capex", blurb: "Monthly budget (same as Cost CAPEX). Upload the budget workbook each month." },
    { to: "finance", label: "RA Bills & COP", query: "tab=ra", blurb: "RA bill tracker (3 stages) and certificates of payment." },
    { to: "finance", label: "RA Bill Tracker", query: "tab=ra", blurb: "Running account bills." },
    { to: "finance", label: "COP", query: "tab=cop", blurb: "Certificate of payment." },
    { to: "finance", label: "Material invoices", query: "tab=invoices", blurb: "PEB / steel / fire tax invoices." },
    { to: "finance", label: "Payment Summary", query: "tab=summary", blurb: "Payment summary rollup." },
    { to: "finance", label: "Audit Sheets", query: "tab=audit", blurb: "Audit sheets → drive export." },
    {
      to: "expense-vouchers",
      label: "Daily expense voucher",
      roles: ["admin", "office", "site_employee", "employee"],
      blurb: "Today's site expenses. HR approves. Separate from Communications.",
    },
  ],
  reports: [
    { to: "dpr-maker", label: "DPR maker", blurb: "Fill SPDC INPUT → publish template XLSX per discipline.", sheet: "SPDC_DPR_*_DASHBOARD" },
    { to: "dpr/files", label: "DPR files", blurb: "Review every published DPR (per discipline, per day) and its SharePoint copy — ISO 07.02." },
    { to: "wpr-maker", label: "WPR maker", blurb: "24-section weekly pack · photos · sign-off.", sheet: "WPR File" },
    { to: "wpr/files", label: "WPR files", blurb: "Review every published WPR — Sharnam workbook, client pack, PPTX, PDF — ISO 10.01." },
    {
      to: "reports/files",
      label: "Reports files",
      blurb: "MIS exports and other report files in SharePoint.",
    },
    { to: "reports", label: "DPR dashboard", query: "kind=dpr", blurb: "Live KPIs + downloadable client pack.", sheet: "DPR-Sharnam PMC" },
    { to: "reports", label: "WPR dashboard", query: "kind=wpr", blurb: "Weekly register + downloadable pack.", sheet: "WPR File" },
  ],
  closure: [
    { to: "closure", label: "Overview", end: true, blurb: "Snag, lessons learnt, closure report KPIs." },
    {
      to: "closure",
      label: "Snaglist",
      query: "sheet=snaglist",
      blurb: "Snag register — open/close gate for handover.",
      sheet: "Snaglist - Sharnam PMC.xlsx",
    },
    {
      to: "closure",
      label: "Lessons learnt",
      query: "sheet=lessons",
      blurb: "Lessons learnt register — add rows; changes are audit-logged.",
      sheet: "Lessons Learnt - Sharnam PMC.xls",
    },
    {
      to: "closure",
      label: "Closure report",
      query: "sheet=closure-report",
      blurb: "Editable sections + upload Project Closure Report.docx.",
      sheet: "Project Closure Report.docx",
    },
  ],
};

export const MODULE_META: Record<
  WorkspaceKey,
  {
    title: string;
    desc: string;
    path: string;
    accent: string;
    soft: string;
    glow: string;
    ink: string;
    icon: string;
  }
> = {
  drawings: {
    title: "Drawings",
    desc: "GFC register (upload with checklist gate), Drawing Check Master, fill log for assigned people, coordination, RFI register, and Ask (PMC RFI).",
    path: "hub/drawings",
    accent: "#2563EB",
    soft: "#DBEAFE",
    glow: "rgba(37,99,235,0.35)",
    ink: "#1E3A8A",
    icon: "DWG",
  },
  dms: {
    title: "Documents",
    desc: "ISO folder tree — contracts, HSE, daily records, MIS. Browse, upload, and preview. Separate from Drawings GFC workflow.",
    path: "hub/dms",
    accent: "#3D4450",
    soft: "#E8EAED",
    glow: "rgba(61,68,80,0.32)",
    ink: "#1F2937",
    icon: "DOC",
  },
  quality: {
    title: "Quality",
    desc: "QI dashboard, NCR / CAR, Cube register, QAP, Excel checklists, and Request QI fill — each sheet is its own tool.",
    path: "hub/quality",
    accent: "#0D9488",
    soft: "#CCFBF1",
    glow: "rgba(13,148,136,0.35)",
    ink: "#115E59",
    icon: "QA",
  },
  safety: {
    title: "Safety",
    desc: "Safety dashboard, Safety NCR, Excel checklists, and safety RFIs — separate tools per sheet.",
    path: "hub/safety",
    accent: "#DC2626",
    soft: "#FEE2E2",
    glow: "rgba(220,38,38,0.32)",
    ink: "#7F1D1D",
    icon: "HSE",
  },
  photos: {
    title: "Photos",
    desc: "Day-wise site photos for this project. Take a picture or upload from the phone. Each day is kept and filed on the project drive.",
    path: "hub/photos",
    accent: "#0369A1",
    soft: "#E0F2FE",
    glow: "rgba(3,105,161,0.32)",
    ink: "#0C4A6E",
    icon: "PIC",
  },
  progress: {
    title: "Progress",
    desc: "Overview, milestones, planned vs actual, site execution checklists, monthly, hindrance, risk, legal, plus S-curve and MS Project for DPR/WPR.",
    path: "hub/progress",
    accent: "#3D4450",
    soft: "#E8EAED",
    glow: "rgba(61,68,80,0.32)",
    ink: "#1F2937",
    icon: "PRG",
  },
  auditKpi: {
    title: "Audit & KPI",
    desc: "Site document audit pack + Master KPI dashboard — findings, walk, folder sample, subjects, role KRA.",
    path: "hub/auditKpi",
    accent: "#9333EA",
    soft: "#F3E8FF",
    glow: "rgba(147,51,234,0.32)",
    ink: "#581C87",
    icon: "KPI",
  },
  comms: {
    title: "Comms",
    desc: "Communication matrix, meeting agenda, minutes, follow-up, and the communication log.",
    path: "hub/comms",
    accent: "#0891B2",
    soft: "#CFFAFE",
    glow: "rgba(8,145,178,0.32)",
    ink: "#155E75",
    icon: "MTG",
  },
  cost: {
    title: "Cost",
    desc: "Monitoring, MB, BBS, Budget, Cashflow Chart / Forecast / Tracking, Rates, COP — sheet-mode tools. Commercial registers live in Finance.",
    path: "hub/cost",
    accent: "#0B6A78",
    soft: "#CCFBF1",
    glow: "rgba(11,106,120,0.35)",
    ink: "#134E4A",
    icon: "₹",
  },
  finance: {
    title: "Finance",
    desc: "Invoice, PO, RA bill, and COP tracking — separate from engineering Cost sheets.",
    path: "hub/finance",
    accent: "#0369A1",
    soft: "#E0F2FE",
    glow: "rgba(3,105,161,0.32)",
    ink: "#0C4A6E",
    icon: "FIN",
  },
  reports: {
    title: "Reports",
    desc: "DPR and WPR packs as separate tools from live registers.",
    path: "hub/reports",
    accent: "#EA580C",
    soft: "#FFEDD5",
    glow: "rgba(234,88,12,0.32)",
    ink: "#9A3412",
    icon: "RPT",
  },
  closure: {
    title: "Project closure",
    desc: "Snaglist, lessons learnt, and project closure report — handover and client sign-off pack.",
    path: "hub/closure",
    accent: "#4F46E5",
    soft: "#E0E7FF",
    glow: "rgba(79,70,229,0.32)",
    ink: "#312E81",
    icon: "CLS",
  },
};

for (const key of Object.keys(MODULE_TOOLS) as (WorkspaceKey | "home")[]) {
  MODULE_TOOLS[key] = MODULE_TOOLS[key].map((t) => ({
    ...t,
    label: formatUiText(t.label),
    blurb: t.blurb ? formatUiText(t.blurb) : t.blurb,
  }));
}

MODULE_TOOLS.cost = MODULE_TOOLS.cost.map((t) => {
  if (t.roles) return t;
  const measurement = t.label === "BOQ / Monitoring" || /tab=(mb|bbs|bbs-master)(&|$)/.test(t.query || "");
  return { ...t, roles: measurement ? ["admin", "office", "employee", "site_employee"] : ["admin", "office", "employee"] };
});

for (const key of Object.keys(MODULE_META) as WorkspaceKey[]) {
  MODULE_META[key].title = formatUiText(MODULE_META[key].title);
  MODULE_META[key].desc = formatUiText(MODULE_META[key].desc);
}

export const WORKSPACES: {
  key: WorkspaceKey;
  title: string;
  desc: string;
  path: string;
  accent: string;
  soft: string;
  icon: string;
  tools: string[];
  roles: string[];
}[] = (Object.keys(MODULE_META) as WorkspaceKey[]).map((key) => {
  const m = MODULE_META[key];
  let roles = ["admin", "office", "site_employee", "employee", "vendor", "client"];
  if (key === "drawings") roles = ["admin", "office", "site_employee", "employee", "client"];
  if (key === "dms") roles = ["admin", "office", "site_employee", "employee", "vendor", "client"];
  if (key === "photos") roles = ["admin", "office", "site_employee", "employee", "vendor", "client"];
  // Site employees enter measurements (BOQ achieved qty, MB, BBS); budget / cashflow / bills stay office-only.
  if (key === "cost") roles = ["admin", "office", "employee", "site_employee"];
  if (key === "finance") roles = ["admin", "office", "employee"];
  if (key === "progress" || key === "reports") roles = ["admin", "office", "site_employee", "employee", "client"];
  if (key === "auditKpi") roles = ["admin", "office", "employee"];
  if (key === "closure") roles = ["admin", "office", "site_employee", "employee", "client"];
  // vendor: project fills + bid desk — RFIs, checklists, quality/safety/comms (no DPR / cost / clock-in)
  return {
    key,
    title: m.title,
    desc: m.desc,
    path: m.path,
    accent: m.accent,
    soft: m.soft,
    icon: m.icon,
    tools: [...new Set(MODULE_TOOLS[key].map((t) => t.to).filter(Boolean)), "hub"],
    roles,
  };
});

export function getActiveWorkspace(): WorkspaceKey | null {
  try {
    const k = localStorage.getItem(WORKSPACE_KEY);
    if (WORKSPACES.some((w) => w.key === k)) return k as WorkspaceKey;
  } catch {
    /* ignore */
  }
  return null;
}

export function setActiveWorkspace(key: WorkspaceKey | null) {
  try {
    if (!key) localStorage.removeItem(WORKSPACE_KEY);
    else localStorage.setItem(WORKSPACE_KEY, key);
  } catch {
    /* ignore */
  }
}

/** Keep stored project id in sync with what the API still returns. */
export function resolveStoredProjectId(list: { id: string; code?: string }[]): string {
  try {
    const stored = localStorage.getItem(WORKSPACE_PROJECT_KEY);
    if (stored && list.some((p) => p.id === stored)) return stored;
    const preferred = list[0];
    if (preferred) {
      localStorage.setItem(WORKSPACE_PROJECT_KEY, preferred.id);
      return preferred.id;
    }
    localStorage.removeItem(WORKSPACE_PROJECT_KEY);
  } catch {
    /* ignore */
  }
  return list[0]?.id || "";
}

export function clearStoredProjectId() {
  try {
    localStorage.removeItem(WORKSPACE_PROJECT_KEY);
  } catch {
    /* ignore */
  }
}

export function toolsForWorkspace(key: WorkspaceKey | null): string[] | null {
  if (!key) return null;
  return WORKSPACES.find((w) => w.key === key)?.tools ?? null;
}

export const DEFAULT_ENABLED_MODULES: WorkspaceKey[] = [
  "drawings",
  "dms",
  "quality",
  "safety",
  "photos",
  "progress",
  "comms",
  "auditKpi",
  "cost",
  "finance",
  "reports",
  "closure",
];
