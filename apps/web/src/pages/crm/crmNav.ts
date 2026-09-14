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
      { to: "directory/stakeholders", label: "Consultants", subtitle: "Consultants and PMC firms. Stakeholder login is created here." },
      { to: "directory/vendors", label: "Vendors / contractors", subtitle: "Separate contractor master. Login at /login/vendor." },
      { to: "packages", label: "Package management", subtitle: "Org work-package catalogue. Tick packages on a job in Project setup." },
    ],
  },
  {
    id: "pipeline",
    label: "Projects",
    tools: [
      { to: "setup", label: "Project setup", subtitle: "Client card, consultants, vendors, packages, and SPDC staff. Open any time from Projects → Edit card & team to add more during the job." },
      { to: "projects", label: "Projects", subtitle: "Register of delivery jobs. Edit card & team adds consultants, vendors, and employees — during setup or after launch." },
      { to: "leads", label: "Leads", subtitle: "Market register · convert to a PMC proposal (SharePoint). Award later to open Project setup." },
      { to: "proposals", label: "Proposals", subtitle: "Client format in SharePoint. Add R0/R1/R2 on this register, then Award to the projects register." },
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

export const CRM_VENDOR_TOOLS: (CrmTool & { desk?: string })[] = [
  {
    to: "vendor-bids",
    label: "Bid management",
    end: true,
    subtitle: "Your BOQs, comparative totals, and award status — no clock-in.",
  },
  {
    to: "vendor-bids",
    desk: "projects",
    label: "My projects",
    subtitle: "Jobs opened after bid invite or award — fill checklists and RFIs on the project desk.",
  },
  {
    to: "vendor-bids",
    desk: "inbox",
    label: "Checklist / RFI inbox",
    subtitle: "Fill assigned checklists and RFIs — including Drawing Check.",
  },
];
