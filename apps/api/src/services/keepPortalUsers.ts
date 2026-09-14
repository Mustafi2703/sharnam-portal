import { LIVE_TEAM } from "./spdcLiveTeamSeed.js";

/** Logins that stay on the live portal — Baibhab, Twinoxis test, and the SPDC list. */
export const KEEP_PORTAL_EMAILS = Array.from(
  new Set([
    "baibhabmustafi@gmail.com",
    "hello@twinoxis.com",
    "admin@twinoxis.com",
    ...LIVE_TEAM.map((t) => t.email.toLowerCase()),
  ])
);

/** Seeded UAT accounts — hidden from Access / HRMS lists on the live portal. */
export const DEMO_LOGIN_SUFFIXES = ["@sharnam.demo", "@consultant.demo", "@arvind.demo", "@bhavanainfra.demo"] as const;

export function isKeptPortalEmail(email?: string | null) {
  return KEEP_PORTAL_EMAILS.includes(String(email || "").trim().toLowerCase());
}

export function isDemoSeedLoginEmail(email?: string | null) {
  const lower = String(email || "").trim().toLowerCase();
  if (!lower || lower.startsWith("deleted.")) return false;
  if (isKeptPortalEmail(lower)) return false;
  return DEMO_LOGIN_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}
