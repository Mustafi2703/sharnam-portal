/**
 * Project-scoped WhatsApp notifications (MSG91 / Twilio via whatsappNotify).
 */
import { prisma } from "../prisma.js";
import { sendWhatsAppText, whatsAppConfigured } from "./whatsappNotify.js";

function parseMobiles(raw: string): string[] {
  return raw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter((s) => /^[\d+\s()-]{8,18}$/.test(s));
}

export async function queueProjectWhatsApp(opts: {
  projectId: string;
  text: string;
  context?: string;
  toOverride?: string;
}) {
  const project = await prisma.project.findUnique({ where: { id: opts.projectId } });
  if (!project || project.whatsAppEnabled === false) {
    return { skipped: true as const, reason: "whatsapp_disabled" };
  }

  const toRaw = (opts.toOverride || project.notificationWhatsApp || "").trim();
  if (!toRaw) return { skipped: true as const, reason: "no_recipients" };

  const mobiles = parseMobiles(toRaw);
  if (!mobiles.length) return { skipped: true as const, reason: "no_valid_recipients" };

  const cfg = whatsAppConfigured();
  if (!cfg.ready) {
    console.warn(`[whatsapp] Skipped (${opts.context || "notify"}) — API not configured`);
    return { skipped: true as const, reason: "api_not_configured" };
  }

  const prefix = project.code ? `[${project.code}] ` : "";
  const body = `${prefix}${opts.text}\n\n— ${project.emailFromName || "शरणम् Portal"}`;

  const results: { mobile: string; ok: boolean; error?: string }[] = [];
  for (const mobile of mobiles) {
    const result = await sendWhatsAppText(mobile, body);
    results.push({ mobile, ok: result.ok, error: result.ok ? undefined : result.error });
    if (result.ok) {
      console.log(`[whatsapp] Sent → ${mobile} | ${opts.context || "notify"}`);
    } else {
      console.error(`[whatsapp] Failed → ${mobile} | ${result.error}`);
    }
  }

  const sent = results.filter((r) => r.ok).length;
  return {
    skipped: sent === 0,
    reason: sent === 0 ? "send_failed" : undefined,
    sent,
    total: mobiles.length,
    results,
    provider: cfg.provider,
  };
}

export function whatsAppStatus() {
  return whatsAppConfigured();
}
