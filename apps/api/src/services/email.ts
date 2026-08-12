import { prisma } from "../prisma.js";
import { graphConfig, graphFetch } from "./graph.js";

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

async function sendViaGraph(opts: { to: string[]; subject: string; body: string }) {
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
      },
      saveToSentItems: true,
    }),
  });
}

export async function queueProjectEmail(opts: {
  projectId: string;
  subject: string;
  body: string;
  context?: string;
  createdById?: string;
  toOverride?: string;
}) {
  const project = await prisma.project.findUnique({ where: { id: opts.projectId } });
  if (!project || !project.emailEnabled) {
    return { skipped: true as const, reason: "email_disabled" };
  }
  const toRaw = (opts.toOverride || project.notificationEmails || "").trim();
  if (!toRaw) return { skipped: true as const, reason: "no_recipients" };

  const fromName = project.emailFromName || "शरणम् Portal";
  const subject = `[${project.code}] ${opts.subject}`;
  const body = `${opts.body}\n\n— ${fromName}`;
  const recipients = parseRecipients(toRaw);
  if (!recipients.length) return { skipped: true as const, reason: "no_valid_recipients" };

  const row = await prisma.emailOutbox.create({
    data: {
      projectId: project.id,
      toEmails: recipients.join(", "),
      subject,
      body,
      context: opts.context || null,
      status: "Queued",
      createdById: opts.createdById || null,
    },
  });

  if (graphMailEnabled()) {
    try {
      await sendViaGraph({ to: recipients, subject, body });
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
