/** CRM desk — pipeline, bids, directories, and quotation tools in one shell. */
import { uiCopy } from "../../lib/formatUiText";

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

function tool(t: CrmTool): CrmTool {
  return { ...t, label: uiCopy(t.label), subtitle: uiCopy(t.subtitle) };
}

function section(s: CrmSection): CrmSection {
  return { ...s, label: uiCopy(s.label), tools: s.tools.map(tool) };
}

export const CRM_HUB = {
  to: "",
  label: uiCopy("Hub"),
  subtitle: "",
};

export const CRM_SECTIONS: CrmSection[] = [
  section({
    id: "directories",
    label: "Directory",
    tools: [
      {
        to: "directory/clients",
        label: "Clients",
        subtitle: "",
      },
      {
        to: "directory/stakeholders",
        label: "Consultants",
        subtitle: "",
      },
      {
        to: "directory/vendors",
        label: "Vendors / contractors",
        subtitle: "",
      },
      {
        to: "packages",
        label: "Work packages",
        subtitle: "",
      },
    ],
  }),
  section({
    id: "pipeline",
    label: "Projects",
    tools: [
      {
        to: "setup",
        label: "Project setup",
        subtitle: "",
      },
      {
        to: "projects",
        label: "Projects",
        subtitle: "",
      },
      {
        to: "leads",
        label: "Leads",
        subtitle: "",
      },
      {
        to: "proposals",
        label: "Proposals",
        subtitle: "",
      },
    ],
  }),
  section({
    id: "bids",
    label: "Bids",
    tools: [
      {
        to: "bids",
        label: "Bid management",
        subtitle: "",
      },
    ],
  }),
];

/** Flat list for subtitle lookup */
export const CRM_TOOLS = CRM_SECTIONS.flatMap((s) => s.tools);

export const CRM_VENDOR_TOOLS: (CrmTool & { desk?: string })[] = [
  {
    ...tool({
      to: "vendor-bids",
      label: "Bid management",
      end: true,
      subtitle: "",
    }),
  },
  {
    ...tool({
      to: "vendor-bids",
      label: "My projects",
      subtitle: "",
    }),
    desk: "projects",
  },
  {
    ...tool({
      to: "vendor-bids",
      label: "Checklist / RFI inbox",
      subtitle: "",
    }),
    desk: "inbox",
  },
];
