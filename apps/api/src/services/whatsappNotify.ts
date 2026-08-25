/**
 * WhatsApp outbound — MSG91 (preferred for India) or Twilio.
 * Set WHATSAPP_PROVIDER=msg91|twilio and credentials in .env.
 */

export type WhatsAppSendResult =
  | { ok: true; provider: string; messageId?: string }
  | { ok: false; error: string; dryRun?: boolean };

function normalizeIndianMobile(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

export function whatsAppConfigured(): { provider: string | null; ready: boolean } {
  const provider = (process.env.WHATSAPP_PROVIDER || "").trim().toLowerCase();
  if (provider === "msg91" && process.env.MSG91_AUTH_KEY && process.env.MSG91_WHATSAPP_SENDER) {
    return { provider: "msg91", ready: true };
  }
  if (provider === "twilio" && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM) {
    return { provider: "twilio", ready: true };
  }
  return { provider: provider || null, ready: false };
}

async function sendViaMsg91(to: string, text: string): Promise<WhatsAppSendResult> {
  const authKey = process.env.MSG91_AUTH_KEY!;
  const sender = process.env.MSG91_WHATSAPP_SENDER!;
  const integratedNumber = process.env.MSG91_INTEGRATED_NUMBER || sender;
  const templateId = process.env.MSG91_WHATSAPP_TEMPLATE_ID;

  // Template route (approved WhatsApp template required for first contact)
  if (templateId) {
    const res = await fetch("https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: authKey,
      },
      body: JSON.stringify({
        integrated_number: integratedNumber,
        content_type: "template",
        payload: {
          messaging_product: "whatsapp",
          type: "template",
          template: {
            name: templateId,
            language: { code: "en", policy: "deterministic" },
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: text.slice(0, 1024) }],
              },
            ],
          },
          to: to,
        },
      }),
    });
    const body = await res.text();
    if (!res.ok) return { ok: false, error: `MSG91 ${res.status}: ${body.slice(0, 300)}` };
    return { ok: true, provider: "msg91", messageId: body.slice(0, 80) };
  }

  // Session / text route (requires open 24h window or approved session)
  const res = await fetch("https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authkey: authKey,
    },
    body: JSON.stringify({
      integrated_number: integratedNumber,
      content_type: "text",
      payload: {
        messaging_product: "whatsapp",
        type: "text",
        text: { body: text },
        to: to,
      },
    }),
  });
  const body = await res.text();
  if (!res.ok) return { ok: false, error: `MSG91 ${res.status}: ${body.slice(0, 300)}` };
  return { ok: true, provider: "msg91", messageId: body.slice(0, 80) };
}

async function sendViaTwilio(to: string, text: string): Promise<WhatsAppSendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_WHATSAPP_FROM!;
  const toWa = to.startsWith("whatsapp:") ? to : `whatsapp:+${to.replace(/^\+/, "")}`;

  const params = new URLSearchParams();
  params.set("From", from.startsWith("whatsapp:") ? from : `whatsapp:${from}`);
  params.set("To", toWa);
  params.set("Body", text);

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const json = (await res.json()) as { sid?: string; message?: string };
  if (!res.ok) return { ok: false, error: json.message || `Twilio ${res.status}` };
  return { ok: true, provider: "twilio", messageId: json.sid };
}

export async function sendWhatsAppText(mobile: string, text: string): Promise<WhatsAppSendResult> {
  const to = normalizeIndianMobile(mobile);
  if (!to || to.length < 11) return { ok: false, error: `Invalid mobile: ${mobile}` };

  const cfg = whatsAppConfigured();
  if (!cfg.ready) {
    return { ok: false, error: "WhatsApp API not configured (set WHATSAPP_PROVIDER + credentials)", dryRun: true };
  }

  if (cfg.provider === "msg91") return sendViaMsg91(to, text);
  if (cfg.provider === "twilio") return sendViaTwilio(to, text);
  return { ok: false, error: `Unknown provider: ${cfg.provider}` };
}

export function waMeLink(mobile: string, text: string) {
  const to = normalizeIndianMobile(mobile);
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}
