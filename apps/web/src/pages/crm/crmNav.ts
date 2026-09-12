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
    id: "pipeline",
    label: "Pipeline",
    tools: [
      { to: "setup", label: "Project setup", subtitle: "Create and save the delivery project card, parties, matrix, then launch portals, folders, DPR / WPR." },
      { to: "leads", label: "Leads", subtitle: "Market register · filter · convert to SPDC delivery project." },
      { to: "proposals", label: "Proposals", subtitle: "PMC quotation register, status log, and letter export." },
      { to: "projects", label: "Projects", subtitle: "All delivery projects with client cards — open module boxes, create a project, or continue setup." },
    ],
  },
  {
    id: "bids",
    label: "Bid management",
    tools: [
      {
        to: "bids",
        label: "Comparative bids",
        subtitle: "Pick a project · add vendors · upload BOQs · comparative statement · vendors see what they applied for.",
      },
    ],
  },
  {
    id: "directories",
    label: "Directories",
    tools: [
      { to: "directory/vendors", label: "Vendors", subtitle: "Contractors & suppliers for comparative packages." },
      { to: "directory/clients", label: "Clients", subtitle: "Owner organisations · portal logins." },
      { to: "directory/stakeholders", label: "Stakeholders", subtitle: "Consultants, designers, and PMC partners." },
      { to: "directory/people", label: "People & access", subtitle: "Office, site, vendor, and client portal accounts." },
    ],
  },
];

/** Flat list for subtitle lookup */
export const CRM_TOOLS = CRM_SECTIONS.flatMap((s) => s.tools);

export const CRM_VENDOR_TOOLS = [
  {
    to: "vendor-bids",
    label: "My bid uploads",
    end: true,
    subtitle: "Fill discipline BOQs online or upload Excel — comparative updates for PMC.",
  },
  {
    to: "vendor-bids?desk=projects",
    label: "My projects",
    subtitle: "Jobs opened to your company after bid invite or assignment.",
  },
  {
    to: "vendor-bids?desk=inbox",
    label: "Checklist / RFI inbox",
    subtitle: "Fill assigned checklists and RFIs — including Drawing Check.",
  },
] as const;
