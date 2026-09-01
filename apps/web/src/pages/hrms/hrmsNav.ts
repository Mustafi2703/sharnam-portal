/** HRMS desk — grouped left nav (mirrors CRM sections pattern). */
export const HRMS_ACCENT = "#0D9488";
export const HRMS_SOFT = "#CCFBF1";

export type HrmsTool = {
  to: string;
  label: string;
  end?: boolean;
  subtitle: string;
  adminOnly?: boolean;
};

export type HrmsSection = {
  id: string;
  label: string;
  tools: HrmsTool[];
};

export const HRMS_SECTIONS: HrmsSection[] = [
  {
    id: "lifecycle",
    label: "People lifecycle",
    tools: [
      {
        to: "",
        label: "Dashboard",
        end: true,
        subtitle: "Headcount, onboarded users, punches, leave queue, and quick links.",
      },
      {
        to: "recruitment",
        label: "Recruitment",
        subtitle: "Requisition → posting → screening → interview scorecard → offer letter.",
      },
      {
        to: "onboarding",
        label: "Onboarding",
        subtitle: "Pre-join checklist, document collection, and Day 1 joining formalities.",
      },
    ],
  },
  {
    id: "time",
    label: "Time & pay",
    tools: [
      {
        to: "attendance",
        label: "Attendance",
        subtitle: "Geo check-in/out with today's roster and site assignment.",
      },
      {
        to: "leave",
        label: "Leave",
        subtitle: "Request leave, view balances, and approve or reject as HR.",
      },
      {
        to: "payroll",
        label: "Payroll",
        subtitle: "Pay hikes with approval workflow and monthly payslip generation.",
      },
    ],
  },
  {
    id: "documents",
    label: "Documents & masters",
    tools: [
      {
        to: "documents",
        label: "Letters",
        subtitle: "Appointment, Relieving, Exit, Asset return, Warning — branded HTML + .xlsx.",
      },
      {
        to: "masters",
        label: "Masters",
        subtitle: "Leave types, holiday calendar, and HR reference data.",
      },
    ],
  },
  {
    id: "admin",
    label: "Administration",
    tools: [
      {
        to: "users",
        label: "Users",
        subtitle: "Create logins, activate accounts, and assign employees to projects.",
        adminOnly: true,
      },
      {
        to: "vendors",
        label: "Vendors",
        subtitle: "Office vendor directory for CRM bids and project assignment.",
        adminOnly: true,
      },
    ],
  },
];

/** Flat list for subtitle lookup */
export const HRMS_TOOLS = HRMS_SECTIONS.flatMap((s) => s.tools);
