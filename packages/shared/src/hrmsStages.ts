/** Candidate pipeline shown on the HRMS recruitment register. */
export const CANDIDATE_STAGES = [
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
  if (status === "Interview" || status === "Interviewed" || status === "Shortlisted") return "warn";
  return "neutral";
}

/** Seats on an HR interview meeting (interviewer side). Interviewee is always the candidate. */
export const INTERVIEWER_SEATS = [
  { id: "Technical", label: "Technical interviewer" },
  { id: "HR", label: "HR interviewer" },
  { id: "Management", label: "Management interviewer" },
  { id: "Client", label: "Client interviewer" },
] as const;

export type InterviewerSeatId = (typeof INTERVIEWER_SEATS)[number]["id"];

