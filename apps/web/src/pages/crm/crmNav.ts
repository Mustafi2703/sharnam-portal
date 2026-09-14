/** CRM desk — pipeline, bids, directories, and quotation tools in one shell. */
export const CRM_ACCENT = "#0B6A78";
export const CRM_SOFT = "#E6F4F6";

export type CrmTool = {
  to: string;
  label: string;
  end?: boolean;
  subtitle: string;
};

export type CrmSection = {
  id: string;
  label: string;
  tools: CrmTool[];
};

export const CRM_HUB = { to: "", label: "Hub", subtitle: "CRM desk — open each tool in its own window." };

export const CRM_SECTIONS: CrmSection[] = [
  {
    id: "directories",
    label: "People & companies",
    tools: [
      { to: "directory/clients", label: "Clients", subtitle: "Add the owner — company, contact, email, phone — client portal login is created here." },
      { to: "directory/stakeholders", label: "Consultants", subtitle: "Separate consultant list. Add type + contact; stakeholder login is created here." },
      { to: "directory/vendors", label: "Vendors / contractors", subtitle: "Separate contractor master. Login at /login/vendor. Pick them later when you open a bid." },
      { to: "directory/people", label: "External logins", subtitle: "Client, consultant, and vendor accounts only. SPDC staff stay in HRMS." },
    ],
  },
  {
    id: "pipeline",
    label: "Projects",
    tools: [
      { to: "setup", label: "Project setup", subtitle: "Code, name, pick client / consultants / vendors from the lists, then communication matrix." },
      { to: "projects", label: "Projects", subtitle: "All delivery projects — open the desk or continue setup." },
      { to: "leads", label: "Leads", subtitle: "Market register · convert to a delivery project." },
      { to: "proposals", label: "Proposals", subtitle: "PMC quotation register and letter export." },
    ],
  },
  {
    id: "bids",
    label: "Bids",
    tools: [
      {
        to: "bids",
        label: "Bid management",
        subtitle: "Separate from project setup. Pick a project, select vendors, open the bid — they see it on /login/vendor.",
      },
    ],
  },
];

/** Flat list for subtitle lookup */
export const CRM_TOOLS = CRM_SECTIONS.flatMap((s) => s.tools);

export const CRM_VENDOR_TOOLS = [
  {
    to: "vendor-bids",
    label: "Bid management",
    end: true,
    subtitle: "Your BOQs, comparative totals, and award status — no clock-in.",
  },
  {
    to: "vendor-bids?desk=projects",
    label: "My projects",
    subtitle: "Jobs opened after bid invite or award — fill checklists and RFIs on the project desk.",
  },
  {
    to: "vendor-bids?desk=inbox",
    label: "Checklist / RFI inbox",
    subtitle: "Fill assigned checklists and RFIs — including Drawing Check.",
  },
] as const;
