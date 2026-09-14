/** Match apps/api/src/services/keepPortalUsers.ts — hide demo + Twinoxis from staff pickers. */
const KEEP = new Set(["baibhabmustafi@gmail.com"]);
const DEMO_SUFFIXES = ["@sharnam.demo", "@consultant.demo", "@arvind.demo", "@bhavanainfra.demo"];
const TWINOXIS_SUFFIXES = ["@twinoxis.com", "@twinoxis1.com"];

export function isHiddenPortalListUser(email?: string | null) {
  const lower = String(email || "").trim().toLowerCase();
  if (!lower || lower.startsWith("deleted.")) return true;
  if (KEEP.has(lower) || lower.endsWith("@spdc.in")) return false;
  if (DEMO_SUFFIXES.some((s) => lower.endsWith(s))) return true;
  if (TWINOXIS_SUFFIXES.some((s) => lower.endsWith(s))) return true;
  return false;
}
