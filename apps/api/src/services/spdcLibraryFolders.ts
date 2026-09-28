/** SPDC_HRMS and SPDC_CRM library folders. Templates inside those folders are not copied — generated and uploaded files land here. */

const MONTHS = [
  "01_Jan",
  "02_Feb",
  "03_Mar",
  "04_Apr",
  "05_May",
  "06_Jun",
  "07_Jul",
  "08_Aug",
  "09_Sep",
  "10_Oct",
  "11_Nov",
  "12_Dec",
] as const;

/** Global SharePoint directories under Sharnam Portal — not a project folder. */
export const HR_DRIVE = "SPDC_HRMS";
export const CRM_DRIVE = "SPDC_CRM";

export const HR_LIBRARY_FOLDERS = [
  "00_Document_Control",
  "01_Procedures_and_Policies",
  "02_Templates_Letters",
  "03_Formats",
  "04_Registers",
  "05_Records_Recruitment",
  "05_Records_Recruitment/01_Resumes_Received",
  "05_Records_Recruitment/02_Shortlisted_and_Interviewed",
  "05_Records_Recruitment/03_Rejected",
  "06_Records_Employee_Files",
  "07_Records_Attendance_and_Leave",
  "08_Records_Payroll",
  "09_Records_Vouchers_and_Reimbursements",
  "99_Obsolete_Documents",
] as const;

export const CRM_LIBRARY_FOLDERS = [
  "01_Templates_and_Formats",
  "02_Registers",
  "03_Proposals",
  "04_Orders_Won",
  "05_Lost",
] as const;

export const EMPLOYEE_FILE_SUBFOLDERS = [
  "01_Joining",
  "02_KYC_and_Statutory",
  "03_Service_Letters",
  "04_Discipline",
  "05_Exit",
] as const;

export function indianFyFolder(d = new Date()) {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `FY_${y}-${String(y + 1).slice(2)}`;
}

export function monthFolder(d = new Date()) {
  return MONTHS[d.getMonth()];
}

function safeSeg(value: string) {
  const clean = value
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/\.+$/g, "")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48)
    .replace(/\.+$/g, "");
  return clean || "Unfiled";
}

export function employeeFolderName(empCode: string | null | undefined, fullName: string) {
  const code = (empCode || "").trim();
  const name = safeSeg(fullName || "Employee");
  return code ? `${safeSeg(code)}_${name}` : name;
}

export function employeeRecordRoot(empCode: string | null | undefined, fullName: string) {
  return `06_Records_Employee_Files/${employeeFolderName(empCode, fullName)}`;
}

/** Letter kind → employee file subfolder from SPDC_HRMS. */
export function letterRecordSubfolder(kind: string) {
  const k = kind.toLowerCase();
  if (/offer|appointment|ndajoining|joining/.test(k)) return "01_Joining";
  if (/warning|concern|discipline/.test(k)) return "04_Discipline";
  if (/reliev|exit|experience|ndapost|separation|assetreturn|asset_return/.test(k)) return "05_Exit";
  return "03_Service_Letters";
}

export function employeeLetterFolder(empCode: string | null | undefined, fullName: string, kind: string) {
  return `${employeeRecordRoot(empCode, fullName)}/${letterRecordSubfolder(kind)}`;
}

export function kycFolder(empCode: string | null | undefined, fullName: string) {
  return `${employeeRecordRoot(empCode, fullName)}/02_KYC_and_Statutory`;
}

export function attendanceRecordFolder(d = new Date()) {
  return `07_Records_Attendance_and_Leave/${indianFyFolder(d)}/${monthFolder(d)}`;
}

export function leaveApplicationFolder(d = new Date()) {
  return `${attendanceRecordFolder(d)}/Leave_Applications`;
}

export function payslipRecordFolder(d = new Date()) {
  return `08_Records_Payroll/${indianFyFolder(d)}/${monthFolder(d)}/Payslips`;
}

export function voucherRecordFolder(d = new Date()) {
  return `09_Records_Vouchers_and_Reimbursements/${indianFyFolder(d)}/${monthFolder(d)}`;
}

/** Current FY month folders from SPDC_HRMS. Templates and the sample employee are not copied. */
export function hrFyRecordFolders(d = new Date()) {
  const fy = indianFyFolder(d);
  const folders: string[] = [
    `07_Records_Attendance_and_Leave/${fy}`,
    `08_Records_Payroll/${fy}`,
    `08_Records_Payroll/${fy}/Annual_Form16_Bonus_Gratuity`,
    `09_Records_Vouchers_and_Reimbursements/${fy}`,
  ];
  for (const month of MONTHS) {
    folders.push(`07_Records_Attendance_and_Leave/${fy}/${month}`);
    folders.push(`07_Records_Attendance_and_Leave/${fy}/${month}/Leave_Applications`);
    folders.push(`08_Records_Payroll/${fy}/${month}/Payslips`);
    folders.push(`08_Records_Payroll/${fy}/${month}/Statutory_Challans`);
    folders.push(`09_Records_Vouchers_and_Reimbursements/${fy}/${month}`);
  }
  return folders;
}

export function requisitionFolderSeg(requisitionNo: string | null | undefined, designation: string | null | undefined) {
  return safeSeg(`${(requisitionNo || "Req").trim()}_${(designation || "Role").trim()}`).slice(0, 64);
}

/** One folder per person inside the requisition pack under recruitment records. */
export function candidateRecruitmentFolder(opts: {
  fullName: string;
  status?: string | null;
  requisitionNo?: string | null;
  designation?: string | null;
  interviewed?: boolean;
}) {
  const rejected = /reject|withdraw/i.test(opts.status || "");
  const shortlisted = !!opts.interviewed || !/^(upload|new)$/i.test(opts.status || "");
  const bucket = rejected
    ? "05_Records_Recruitment/03_Rejected"
    : shortlisted
      ? "05_Records_Recruitment/02_Shortlisted_and_Interviewed"
      : "05_Records_Recruitment/01_Resumes_Received";
  return `${bucket}/${requisitionFolderSeg(opts.requisitionNo, opts.designation)}/${safeSeg(opts.fullName || "Candidate")}`;
}

export function resumeFolder() {
  return "05_Records_Recruitment/01_Resumes_Received";
}

export function interviewRecordFolder() {
  return "05_Records_Recruitment/02_Shortlisted_and_Interviewed";
}

export function inquiryFolderName(quotationNo: string | null | undefined, clientName: string | null | undefined) {
  const raw = (quotationNo || "").trim();
  const inq = raw.match(/INQ[^\s/]*\/?(\d+)/i)?.[1] || raw.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 24);
  const client = safeSeg(clientName || "Client");
  const code = inq ? `INQ-${inq.padStart(3, "0")}` : "INQ";
  return `${code}_${client}`.slice(0, 64);
}

/** Won project card — leads stay under proposals; a project card is an order. */
export function wonOrderFolder(projectCode: string, clientName?: string | null) {
  const code = safeSeg(projectCode || "Project");
  const client = safeSeg(clientName || "Client");
  return `04_Orders_Won/${code}_${client}`.slice(0, 90);
}

/** 03_Proposals / 04_Orders_Won / 05_Lost, with working vs submitted inside an inquiry. */
export function crmProposalFolder(opts: {
  quotationNo?: string | null;
  clientName?: string | null;
  status?: string | null;
  stage?: "inputs" | "working" | "submitted";
}) {
  const inq = inquiryFolderName(opts.quotationNo, opts.clientName);
  const status = (opts.status || "").toLowerCase();
  if (/won|awarded/.test(status)) return `04_Orders_Won/${inq}`;
  if (/lost|regret/.test(status)) return `05_Lost/${inq}`;
  const stage =
    opts.stage === "inputs" ? "01_Client_Inputs" : opts.stage === "working" ? "02_Working" : "03_Submitted";
  return `03_Proposals/${inq}/${stage}`;
}
