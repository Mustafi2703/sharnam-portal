/** CRM desk tool rail — same pattern as project module strips. */
export const CRM_ACCENT = "#0B6A78";
export const CRM_SOFT = "#E6F4F6";

export const CRM_TOOLS = [
  { to: "leads", label: "Leads register", end: false, subtitle: "530+ market projects · filter · convert to SPDC delivery." },
  { to: "bids", label: "Bid management", end: false, subtitle: "Comparative Statement R2 — vendor BOQs and L1 award." },
  { to: "proposals", label: "PMC proposals", end: false, subtitle: "Client quotation maker and status log." },
  { to: "projects", label: "New project", end: false, subtitle: "Wizard to spin up a delivery project from a CRM win." },
] as const;

export const CRM_VENDOR_TOOLS = [
  { to: "vendor-bids", label: "My bid uploads", end: true, subtitle: "Fill discipline BOQs online or upload Excel — comparative updates for PMC." },
] as const;
