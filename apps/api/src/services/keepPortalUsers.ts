import { LIVE_TEAM } from "./spdcLiveTeamSeed.js";

/** Production SPDC logins — cannot be deleted from HRMS. Twinoxis test emails are NOT kept. */
export const KEEP_PORTAL_EMAILS = Array.from(
  new Set([
    "baibhabmustafi@gmail.com",
    ...LIVE_TEAM.map((t) => t.email.toLowerCase()).filter((e) => e.endsWith("@spdc.in")),
  ])
);

/** Twinoxis UAT / duplicate test logins — safe to remove when cleaning the portal. */
export const TWINOXIS_TEST_EMAIL_SUFFIXES = ["@twinoxis.com", "@twinoxis1.com"] as const;

/** Seeded UAT accounts — hidden from Access / HRMS lists on the live portal. */
export const DEMO_LOGIN_SUFFIXES = ["@sharnam.demo", "@consultant.demo", "@arvind.demo", "@bhavanainfra.demo"] as const;

export function isKeptPortalEmail(email?: string | null) {
  return KEEP_PORTAL_EMAILS.includes(String(email || "").trim().toLowerCase());
}

export function isTwinoxisTestEmail(email?: string | null) {
  const lower = String(email || "").trim().toLowerCase();
  if (!lower || lower.startsWith("deleted.")) return false;
  return TWINOXIS_TEST_EMAIL_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

export function isDemoSeedLoginEmail(email?: string | null) {
  const lower = String(email || "").trim().toLowerCase();
  if (!lower || lower.startsWith("deleted.")) return false;
  if (isKeptPortalEmail(lower)) return false;
  return DEMO_LOGIN_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

/** Hide from Access, HRMS, and project staff pickers — demo seed + Twinoxis UAT duplicates. */
export function isHiddenPortalListUser(email?: string | null) {
  return isDemoSeedLoginEmail(email) || isTwinoxisTestEmail(email);
}
