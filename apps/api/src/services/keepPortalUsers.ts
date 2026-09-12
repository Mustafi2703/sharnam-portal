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

export function isKeptPortalEmail(email?: string | null) {
  return KEEP_PORTAL_EMAILS.includes(String(email || "").trim().toLowerCase());
}
