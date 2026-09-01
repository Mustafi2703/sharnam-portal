/** Default portal policies shown on the left panel of every login screen. */
export const SHARNAM_PORTAL_POLICIES = [
  "All project data, drawings, and reports are confidential — distribute only through this portal.",
  "Access is role-based (Office, Site, Contractor, Client) and every action is audit-logged.",
  "File uploads — GFC sheets, BOQs, checklists — are versioned and attributed to your account.",
  "Site attendance may require selfie and GPS where enabled by your organisation.",
  "Do not share passwords. Contact the Sharnam office admin if your access needs to change.",
] as const;

export const HUB_POLICIES = [
  ...SHARNAM_PORTAL_POLICIES,
  "Choose the portal that matches your role on the project — each desk shows only the tools you need.",
] as const;
