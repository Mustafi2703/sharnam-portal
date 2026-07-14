import { prisma } from "../prisma.js";

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
  const to = (opts.toOverride || project.notificationEmails || "").trim();
  if (!to) return { skipped: true as const, reason: "no_recipients" };

  const fromName = project.emailFromName || "शरणम् Portal";
  const row = await prisma.emailOutbox.create({
    data: {
      projectId: project.id,
      toEmails: to,
      subject: `[${project.code}] ${opts.subject}`,
      body: `${opts.body}\n\n— ${fromName}`,
      context: opts.context || null,
      status: "Sent",
      createdById: opts.createdById || null,
      sentAt: new Date(),
    },
  });
  // Mock transport: persisted to EmailOutbox (swap for SMTP/Graph later)
  console.log(`[email] → ${to} | ${row.subject}`);
  return { skipped: false as const, email: row };
}
