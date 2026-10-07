/**
 * Portal mail switch. Mail goes out when Hostinger sets PORTAL_MAIL_LIVE=true, or when an admin
 * turns it on under UAT data. The admin switch always carries a recipient list (test mailboxes SPDC
 * owns) — mail to anyone else stays held — so UAT never emails real clients or vendors.
 */
import { prisma } from "../prisma.js";

let live = false;
let allow: string[] = [];

const KEY = "portalMail";

export async function loadMailSwitch() {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
    const v = row ? (JSON.parse(row.value) as { live?: boolean; allow?: string[] }) : {};
    live = Boolean(v.live);
    allow = Array.isArray(v.allow) ? v.allow : [];
  } catch {
    /* table not ready — env flag still applies */
  }
  return mailSwitchState();
}

export async function setMailSwitch(opts: { live: boolean; allow: string[] }, by?: string) {
  const list = [...new Set(opts.allow.map((s) => s.trim().toLowerCase()).filter((s) => /^(@[^\s@]+\.[^\s@]+|[^\s@]+@[^\s@]+\.[^\s@]+)$/.test(s)))];
  if (opts.live && !list.length) throw new Error("Add at least one test mailbox or @domain before switching mail on.");
  await prisma.appSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify({ live: opts.live, allow: list }), updatedBy: by || null },
    update: { value: JSON.stringify({ live: opts.live, allow: list }), updatedBy: by || null },
  });
  live = opts.live;
  allow = list;
  return mailSwitchState();
}

const envLive = () => process.env.PORTAL_MAIL_LIVE === "true";

export function mailSwitchState() {
  return { live: envLive() || live, source: envLive() ? "hosting" : live ? "admin" : "off", allow: envLive() ? [] : allow };
}

export function portalMailLive() {
  return envLive() || live;
}

/** Keep only recipients the switch allows. Hosting-level live mail is unrestricted. */
export function allowedRecipients(list: string[] | undefined): string[] {
  const items = list || [];
  if (envLive()) return items;
  return items.filter((a) => {
    const addr = a.trim().toLowerCase();
    return allow.some((rule) => (rule.startsWith("@") ? addr.endsWith(rule) : addr === rule));
  });
}
