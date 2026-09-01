/** Default portal policies — kept short for the left panel. */
export const SHARNAM_PORTAL_POLICIES = [
  "Project data is confidential — share only through this portal.",
  "Access is role-based and every action is audit-logged.",
  "Uploads are versioned and tied to your account.",
  "Do not share passwords — contact Sharnam admin for access changes.",
] as const;

export const HUB_POLICIES = [
  "Choose the portal that matches your role on the project.",
  "Each desk shows only the tools you need.",
  ...SHARNAM_PORTAL_POLICIES.slice(0, 2),
] as const;
