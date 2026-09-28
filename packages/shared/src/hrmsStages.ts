/** Candidate pipeline shown on the HRMS recruitment register. */
export const CANDIDATE_STAGES = [
  { id: "Upload", label: "Upload resume" },
  { id: "New", label: "Resume received" },
  { id: "Screened", label: "Resume screened" },
  { id: "Shortlisted", label: "Shortlisted" },
  { id: "Interview", label: "Interview scheduled" },
  { id: "Interviewed", label: "Interview feedback" },
  { id: "Selected", label: "Final selection" },
  { id: "SalaryDiscussion", label: "Salary discussion" },
  { id: "Offered", label: "Offer issued" },
  { id: "Accepted", label: "Offer accepted" },
  { id: "Joined", label: "Joined" },
  { id: "Rejected", label: "Rejected" },
  { id: "Withdrawn", label: "Withdrawn" },
] as const;

export type CandidateStageId = (typeof CANDIDATE_STAGES)[number]["id"];

export const CANDIDATE_STAGE_IDS = CANDIDATE_STAGES.map((s) => s.id);

export const ACTIVE_CANDIDATE_STAGES: CandidateStageId[] = [
  "Upload",
  "New",
  "Screened",
  "Shortlisted",
  "Interview",
  "Interviewed",
  "Selected",
  "SalaryDiscussion",
  "Offered",
  "Accepted",
];

const LABEL_BY_ID = Object.fromEntries(CANDIDATE_STAGES.map((s) => [s.id, s.label])) as Record<string, string>;

export function candidateStageLabel(status?: string | null): string {
  if (!status) return "—";
  return LABEL_BY_ID[status] || status;
}

export function candidateStageTone(
  status?: string | null,
): "ok" | "warn" | "danger" | "brand" | "neutral" {
  if (status === "Joined" || status === "Accepted") return "ok";
  if (status === "Rejected" || status === "Withdrawn") return "danger";
  if (status === "Offered" || status === "Selected" || status === "SalaryDiscussion") return "brand";
  if (status === "Upload" || status === "Interview" || status === "Interviewed" || status === "Shortlisted") return "warn";
  return "neutral";
}

/** Scorecard weight columns. A designation maps onto one of these so the Excel file still calculates. */
export const SPDC_HIRING_ROLES = [
  "Project Manager (Site)",
  "Planning Engineer",
  "Billing / QS Engineer",
  "Project Coordinator",
  "Senior Site Engineer (Civil)",
  "Junior Engineer",
  "QA/QC Engineer",
  "MEP Engineer",
  "Safety Officer",
  "HR & Admin Executive",
] as const;

export type SpdcHiringRole = (typeof SPDC_HIRING_ROLES)[number];

export function isSpdcHiringRole(value: string | null | undefined): value is SpdcHiringRole {
  if (!value) return false;
  return (SPDC_HIRING_ROLES as readonly string[]).includes(value.trim());
}

/** Hiring departments. Each of the 23 designations sits in one of these. */
export const SPDC_HIRING_DEPARTMENTS = ["Office", "Site", "HR"] as const;

export type SpdcHiringDepartment = (typeof SPDC_HIRING_DEPARTMENTS)[number];

export type SpdcDesignation = {
  title: string;
  department: SpdcHiringDepartment;
  scorecardRole: SpdcHiringRole;
};

/** 23 designations. scorecardRole is the workbook column used when this person is scored. */
export const SPDC_DESIGNATIONS: readonly SpdcDesignation[] = [
  { title: "Director", department: "Office", scorecardRole: "Project Manager (Site)" },
  { title: "Project Coordinator", department: "Office", scorecardRole: "Project Coordinator" },
  { title: "Planning Engineer", department: "Office", scorecardRole: "Planning Engineer" },
  { title: "Billing / QS Engineer", department: "Office", scorecardRole: "Billing / QS Engineer" },
  { title: "Estimation Engineer", department: "Office", scorecardRole: "Planning Engineer" },
  { title: "Contracts Engineer", department: "Office", scorecardRole: "Billing / QS Engineer" },
  { title: "Document Controller", department: "Office", scorecardRole: "Project Coordinator" },
  { title: "Accountant", department: "Office", scorecardRole: "Billing / QS Engineer" },
  { title: "Project Manager (Site)", department: "Site", scorecardRole: "Project Manager (Site)" },
  { title: "Senior Site Engineer (Civil)", department: "Site", scorecardRole: "Senior Site Engineer (Civil)" },
  { title: "Site Engineer – Civil", department: "Site", scorecardRole: "Senior Site Engineer (Civil)" },
  { title: "Junior Engineer", department: "Site", scorecardRole: "Junior Engineer" },
  { title: "Site Supervisor", department: "Site", scorecardRole: "Senior Site Engineer (Civil)" },
  { title: "QA/QC Engineer", department: "Site", scorecardRole: "QA/QC Engineer" },
  { title: "MEP Engineer", department: "Site", scorecardRole: "MEP Engineer" },
  { title: "Safety Officer", department: "Site", scorecardRole: "Safety Officer" },
  { title: "Store Keeper", department: "Site", scorecardRole: "Junior Engineer" },
  { title: "Surveyor", department: "Site", scorecardRole: "Junior Engineer" },
  { title: "Foreman", department: "Site", scorecardRole: "Senior Site Engineer (Civil)" },
  { title: "HR & Admin Executive", department: "HR", scorecardRole: "HR & Admin Executive" },
  { title: "HR Executive", department: "HR", scorecardRole: "HR & Admin Executive" },
  { title: "Admin Executive", department: "HR", scorecardRole: "HR & Admin Executive" },
  { title: "Payroll Executive", department: "HR", scorecardRole: "HR & Admin Executive" },
];

export function isSpdcDesignation(value: string | null | undefined): boolean {
  if (!value) return false;
  return SPDC_DESIGNATIONS.some((row) => row.title === value.trim());
}

export function designationRow(title: string | null | undefined): SpdcDesignation | null {
  if (!title) return null;
  return SPDC_DESIGNATIONS.find((row) => row.title === title.trim()) || null;
}

export function designationsForDepartment(department: string | null | undefined): SpdcDesignation[] {
  return SPDC_DESIGNATIONS.filter((row) => row.department === department);
}

export function scorecardRoleForDesignation(title: string | null | undefined): SpdcHiringRole {
  const row = designationRow(title);
  if (row) return row.scorecardRole;
  if (isSpdcHiringRole(title)) return title.trim() as SpdcHiringRole;
  return SPDC_HIRING_ROLES[0];
}

/** Seats on an HR interview meeting (interviewer side). Interviewee is always the candidate. */
export const INTERVIEWER_SEATS = [
  { id: "Technical", label: "Technical interviewer" },
  { id: "HR", label: "HR interviewer" },
  { id: "Management", label: "Management interviewer" },
  { id: "Client", label: "Client interviewer" },
] as const;

export type InterviewerSeatId = (typeof INTERVIEWER_SEATS)[number]["id"];

