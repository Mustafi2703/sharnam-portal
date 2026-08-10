/** HRMS tool rail — matches MODULE_HRMS.md tab list. */
export const HRMS_TOOLS = [
  { to: "", label: "Dashboard", end: true, subtitle: "Headcount, punches, leave queue, and quick links into every HR workflow." },
  { to: "recruitment", label: "Recruitment", subtitle: "Requisition → posting → screening → interview scorecard → offer letter." },
  { to: "onboarding", label: "Onboarding", subtitle: "Pre-join checklist, document collection, and Day 1 joining formalities." },
  { to: "attendance", label: "Attendance", subtitle: "Geo check-in/out with today's roster and site assignment." },
  { to: "leave", label: "Leave", subtitle: "Request leave, view balances, and approve or reject as HR." },
  { to: "payroll", label: "Payroll", subtitle: "Pay hikes with approval workflow and monthly payslip generation." },
  { to: "masters", label: "Masters", subtitle: "Leave types, holiday calendar, and HR reference data." },
] as const;

export const HRMS_ACCENT = "#0D9488";
export const HRMS_SOFT = "#CCFBF1";
