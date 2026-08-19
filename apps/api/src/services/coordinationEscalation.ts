import { prisma } from "../prisma.js";
import { queueProjectEmail } from "./email.js";

const MAX_FOLLOW_UPS = 5;

export async function createRfiFromCoordinationIssue(opts: {
  issueId: string;
  projectId: string;
  userId: string;
}) {
  const issue = await prisma.designCoordinationIssue.findFirst({
    where: { id: opts.issueId, projectId: opts.projectId },
  });
  if (!issue) throw new Error("Coordination issue not found");
  if (issue.escalatedRfiId) {
    const existing = await prisma.rfi.findUnique({ where: { id: issue.escalatedRfiId } });
    if (existing) return existing;
  }

  const count = await prisma.rfi.count({ where: { projectId: opts.projectId } });
  const number = `RFI-${String(count + 1).padStart(3, "0")}`;
  const question = [
    issue.description || "",
    issue.location ? `Location: ${issue.location}` : "",
    issue.discipline ? `Discipline: ${issue.discipline}` : "",
    `Escalated from design coordination issue (${issue.followUpCount} follow-up(s) sent).`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const rfi = await prisma.rfi.create({
    data: {
      projectId: opts.projectId,
      number,
      subject: issue.title,
      question: question || issue.title,
      rfiKind: "RequestForInformation",
      status: "Open",
      ballInCourt: "Assignee",
      createdById: opts.userId,
      dueDate: issue.dueDate || new Date(Date.now() + 7 * 86400000),
      linkedDrawingId: issue.linkedDrawingId || null,
      scheduleImpact: "TBD",
      costImpact: "TBD",
    },
  });

  await prisma.designCoordinationIssue.update({
    where: { id: issue.id },
    data: { status: "Escalated", escalatedRfiId: rfi.id },
  });

  await queueProjectEmail({
    projectId: opts.projectId,
    subject: `Coordination escalated to ${number} — ${issue.title}`,
    body: `Design coordination issue was escalated to RFI.\n\n${number}: ${issue.title}\n\n${question}`,
    context: "coordination.escalate-rfi",
    createdById: opts.userId,
  });

  return rfi;
}

export async function sendCoordinationFollowUp(opts: {
  issueId: string;
  projectId: string;
  userId: string;
}) {
  const issue = await prisma.designCoordinationIssue.findFirst({
    where: { id: opts.issueId, projectId: opts.projectId },
  });
  if (!issue) throw new Error("Coordination issue not found");
  if (issue.status === "Escalated" && issue.escalatedRfiId) {
    throw new Error("Issue already escalated to RFI");
  }
  if (issue.status === "Closed") throw new Error("Issue is closed");
  if (issue.followUpCount >= MAX_FOLLOW_UPS) {
    throw new Error(`Maximum ${MAX_FOLLOW_UPS} follow-ups reached — escalate to RFI`);
  }

  const nextCount = issue.followUpCount + 1;
  const toEmail = issue.assignedToEmail?.trim();
  if (!toEmail) throw new Error("Assignee email required for follow-up");

  await queueProjectEmail({
    projectId: opts.projectId,
    subject: `Follow-up ${nextCount}/${MAX_FOLLOW_UPS} — ${issue.title}`,
    body: [
      `Design coordination follow-up ${nextCount} of ${MAX_FOLLOW_UPS}.`,
      "",
      `Issue: ${issue.title}`,
      issue.description ? `Details: ${issue.description}` : "",
      issue.dueDate ? `Due: ${new Date(issue.dueDate).toLocaleDateString()}` : "",
      issue.assignedToName ? `Assigned to: ${issue.assignedToName}` : "",
      "",
      "Please address this in the portal or reply to the project team.",
    ]
      .filter(Boolean)
      .join("\n"),
    context: "coordination.follow-up",
    createdById: opts.userId,
    toOverride: toEmail,
  });

  const updated = await prisma.designCoordinationIssue.update({
    where: { id: issue.id },
    data: { followUpCount: nextCount, lastFollowUpAt: new Date() },
  });

  if (nextCount >= MAX_FOLLOW_UPS) {
    const rfi = await createRfiFromCoordinationIssue(opts);
    return { issue: updated, autoEscalated: true, rfi };
  }

  return { issue: updated, autoEscalated: false };
}

export { MAX_FOLLOW_UPS };
