import { prisma } from "../prisma.js";
import { graphConfig, graphFetch } from "./graph.js";
import { sendGraphHtmlMail } from "./graphHtmlMail.js";

function parseRecipients(raw: string): string[] {
  return raw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
}

function graphMailEnabled() {
  const cfg = graphConfig();
  if (process.env.GRAPH_MAIL_ENABLED === "false") return false;
  return cfg.configured && Boolean(cfg.mailbox);
}

function threadHeaders(opts: { messageId: string; inReplyTo?: string | null; references?: string | null }) {
  const headers: { name: string; value: string }[] = [{ name: "Message-ID", value: opts.messageId }];
  if (opts.inReplyTo) headers.push({ name: "In-Reply-To", value: opts.inReplyTo });
  if (opts.references) headers.push({ name: "References", value: opts.references });
  return headers;
}

async function sendViaGraph(opts: {
  to: string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  messageId: string;
  inReplyTo?: string | null;
  references?: string | null;
}) {
  const useHtml = Boolean(opts.bodyHtml?.trim());
  if (useHtml) {
    await sendGraphHtmlMail({
      to: opts.to,
      subject: opts.subject,
      bodyHtml: opts.bodyHtml!,
      internetMessageHeaders: threadHeaders(opts),
    });
    return;
  }
  const cfg = graphConfig();
  if (!cfg.mailbox) throw new Error("GRAPH_MAIL_FROM not configured");
  await graphFetch(`/users/${encodeURIComponent(cfg.mailbox)}/sendMail`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject: opts.subject,
        body: { contentType: "Text", content: opts.body },
        toRecipients: opts.to.map((address) => ({ emailAddress: { address } })),
        internetMessageHeaders: threadHeaders(opts),
      },
      saveToSentItems: true,
    }),
  });
}

export async function queueProjectEmail(opts: {
  projectId: string;
  subject: string;
  body: string;
  /** When set, Graph sends HTML; outbox stores plain text + HTML marker */
  bodyHtml?: string;
  context?: string;
  createdById?: string;
  toOverride?: string;
}) {
  const project = await prisma.project.findUnique({ where: { id: opts.projectId } });
  if (!project) return { skipped: true as const, reason: "no_project" };
  if (!project.emailEnabled && !opts.toOverride) {
    return { skipped: true as const, reason: "email_disabled" };
  }
  const toRaw = (opts.toOverride || project.notificationEmails || "").trim();
  if (!toRaw) return { skipped: true as const, reason: "no_recipients" };

  const fromName = project.emailFromName || "शरणम् Portal";
  const threadKey = opts.context || null;
  const prior = threadKey
    ? await prisma.emailOutbox.findFirst({
        where: {
          projectId: project.id,
          threadKey,
          internetMessageId: { not: null },
          status: { in: ["Sent", "Queued (mock)"] },
        },
        orderBy: { createdAt: "desc" },
      })
    : null;
  const subjectBase = opts.subject.replace(/^(Re:\s*)+/i, "").trim();
  const subject = prior
    ? `[${project.code}] Re: ${subjectBase.replace(new RegExp(`^\\[${project.code}\\]\\s*(Re:\\s*)?`, "i"), "")}`
    : `[${project.code}] ${opts.subject}`;
  const bodyPlain = `${opts.body}\n\n— ${fromName}`;
  const bodyStore = opts.bodyHtml
    ? `${bodyPlain}\n\n[HTML version sent via Graph]`
    : bodyPlain;
  const recipients = parseRecipients(toRaw);
  if (!recipients.length) return { skipped: true as const, reason: "no_valid_recipients" };

  const messageId = `<sharnam-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@spdc.in>`;
  const references = [prior?.internetMessageId, prior ? undefined : null]
    .filter(Boolean)
    .concat(messageId)
    .join(" ");

  const row = await prisma.emailOutbox.create({
    data: {
      projectId: project.id,
      toEmails: recipients.join(", "),
      subject,
      body: bodyStore,
      context: opts.context || null,
      status: "Queued",
      createdById: opts.createdById || null,
      internetMessageId: messageId,
      threadKey,
    },
  });

  if (graphMailEnabled()) {
    try {
      await sendViaGraph({
        to: recipients,
        subject,
        body: bodyPlain,
        bodyHtml: opts.bodyHtml ? `${opts.bodyHtml}` : undefined,
        messageId,
        inReplyTo: prior?.internetMessageId || null,
        references: prior?.internetMessageId ? references : messageId,
      });
      const sent = await prisma.emailOutbox.update({
        where: { id: row.id },
        data: { status: "Sent", sentAt: new Date() },
      });
      console.log(`[email] Graph sent → ${recipients.join(", ")} | ${subject}`);
      return { skipped: false as const, email: sent, transport: "graph" as const };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const failed = await prisma.emailOutbox.update({
        where: { id: row.id },
        data: { status: "Failed" },
      });
      console.error(`[email] Graph failed → ${recipients.join(", ")} | ${message}`);
      return { skipped: false as const, email: failed, transport: "graph" as const, error: message };
    }
  }

  const queued = await prisma.emailOutbox.update({
    where: { id: row.id },
    data: { status: "Queued (mock)", sentAt: null },
  });
  console.log(`[email] Queued (mock) → ${recipients.join(", ")} | ${subject}`);
  return { skipped: false as const, email: queued, transport: "mock" as const };
}
