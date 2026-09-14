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
    label: "Directory",
    tools: [
      { to: "directory/clients", label: "Clients", subtitle: "Client master — company, contact, portal login. Edits sync to linked projects." },
      { to: "directory/stakeholders", label: "Consultants", subtitle: "Consultants and PMC firms. Stakeholder login is created here." },
      { to: "directory/vendors", label: "Vendors / contractors", subtitle: "Contractor master for bid packages and project assignment." },
      { to: "packages", label: "Work packages", subtitle: "Org catalogue — tick packages on a job in Project setup." },
    ],
  },
  {
    id: "pipeline",
    label: "Projects",
    tools: [
      { to: "setup", label: "Project setup", subtitle: "Client card, consultants, vendors, packages, and SPDC staff. Open any time from Projects → Edit card & team to add more during the job." },
      { to: "projects", label: "Projects", subtitle: "Register of delivery jobs. Edit card & team adds consultants, vendors, and employees — during setup or after launch." },
      { to: "leads", label: "Leads", subtitle: "Market register · convert to a PMC proposal (SharePoint). Award later to open Project setup." },
      { to: "proposals", label: "Proposals", subtitle: "SharePoint PMC format — edit in Word, mark sent, Award to Planning on Projects." },
    ],
  },
  {
    id: "bids",
    label: "Bids",
    tools: [
      {
        to: "bids",
        label: "Bid management",
        subtitle: "Pick a project, add CRM vendors, open the bid — contractors upload BOQs at /login/vendor.",
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
