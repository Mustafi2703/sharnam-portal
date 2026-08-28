/**
 * Send HTML mail via Graph with Sharnam logo as inline CID attachment.
 * Gmail/Outlook block data: URIs — inline attachments load reliably.
 */
import { graphConfig, graphFetch } from "./graph.js";
import {
  SHARNAM_EMAIL_LOGO_CID,
  sharnamEmailLogoInlineAttachment,
  ensureEmailHtmlUsesInlineLogo,
} from "./brandedExport.js";

export { SHARNAM_EMAIL_LOGO_CID };

export function buildGraphInlineLogoAttachment() {
  return sharnamEmailLogoInlineAttachment();
}

export async function sendGraphHtmlMail(opts: {
  to: string[];
  subject: string;
  bodyHtml: string;
  mailbox?: string;
  saveToSentItems?: boolean;
}) {
  const cfg = graphConfig();
  const mailbox = opts.mailbox || cfg.mailbox;
  if (!mailbox) throw new Error("GRAPH_MAIL_FROM not configured");

  const html = ensureEmailHtmlUsesInlineLogo(opts.bodyHtml);
  const attachment = buildGraphInlineLogoAttachment();

  const message: Record<string, unknown> = {
    subject: opts.subject,
    body: { contentType: "HTML", content: html },
    toRecipients: opts.to.map((address) => ({ emailAddress: { address } })),
  };
  if (attachment) message.attachments = [attachment];

  await graphFetch(`/users/${encodeURIComponent(mailbox)}/sendMail`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      saveToSentItems: opts.saveToSentItems !== false,
    }),
  });
}

/** Quick one-off logo proof email. */
export async function sendSharnamLogoTestEmail(to: string) {
  const portal = (process.env.WEB_ORIGIN || "https://portal.spdc.in").replace(/\/$/, "");
  const { wrapCommsPlainEmail } = await import("./rfiEmailFormat.js");
  const bodyHtml = wrapCommsPlainEmail({
    eyebrow: "Logo test",
    headline: "Sharnam official wordmark (inline attachment)",
    bodyText: [
      "The logo above is attached inline (CID) — it should display in Gmail and Outlook without loading external images.",
      "",
      "Asset: apps/web/public/logo-transparent.png",
      "",
      portal,
    ].join("\n"),
    primaryAction: { href: `${portal}/login/office`, label: "Open portal" },
  });

  await sendGraphHtmlMail({
    to: [to],
    subject: "[Sharnam] Logo test — inline CID attachment",
    bodyHtml,
  });

  const att = buildGraphInlineLogoAttachment();
  return {
    ok: true,
    to,
    attachment: att ? (att as { name: string }).name : null,
    cid: SHARNAM_EMAIL_LOGO_CID,
  };
}
