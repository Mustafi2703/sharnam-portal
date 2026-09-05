import { queueProjectEmail } from "./email.js";
import { portalOrigin } from "./rfiFlowNotify.js";
import { buildNcrFollowUpEmail, buildNcrRaisedEmail, type NcrEmailKind } from "./ncrEmailFormat.js";
import { prisma } from "../prisma.js";

export async function notifyNcrStatus(opts: {
  projectId: string;
  recordId?: string;
  kind: NcrEmailKind;
  number: string;
  status: string;
  description: string;
  createdById?: string;
  event: "created" | "updated" | "closed";
  contractorEmail?: string | null;
  contractorName?: string | null;
  location?: string | null;
  plannedClosure?: Date | string | null;
}) {
  const label =
    opts.kind === "SafetyNCR" ? "Safety NCR" : opts.kind === "QualityCAR" ? "CAR" : "Quality NCR";
  const verb =
    opts.event === "created" ? "raised" : opts.event === "closed" ? "closed" : "updated";

  const registerUrl =
    opts.kind === "SafetyNCR"
      ? `${portalOrigin()}/projects/${opts.projectId}/safety?sheet=ncr-summary`
      : `${portalOrigin()}/projects/${opts.projectId}/inspections?sheet=car-register`;

  const formUrl =
    opts.recordId && opts.kind !== "SafetyNCR"
      ? `${portalOrigin()}/projects/${opts.projectId}/ncr-form/quality/${opts.recordId}`
      : opts.recordId && opts.kind === "SafetyNCR"
        ? `${portalOrigin()}/projects/${opts.projectId}/ncr-form/safety/${opts.recordId}`
        : registerUrl;

  const project = await prisma.project.findUnique({
    where: { id: opts.projectId },
    select: { code: true, name: true },
  });

  let raisedByName: string | null = null;
  if (opts.createdById) {
    const u = await prisma.user.findUnique({
      where: { id: opts.createdById },
      select: { fullName: true },
    });
    raisedByName = u?.fullName || null;
  }

  const emailCtx = {
    projectCode: project?.code,
    projectName: project?.name,
    number: opts.number,
    kind: opts.kind,
    status: opts.status,
    description: opts.description,
    location: opts.location,
    responsibleParty: opts.contractorName,
    targetCompletion: opts.plannedClosure,
    raisedByName,
    raisedAt: new Date(),
  };

  const primaryUrl = opts.event === "created" ? formUrl : registerUrl;
  const { bodyHtml, bodyText, subject } = buildNcrRaisedEmail({
    ctx: emailCtx,
    registerUrl: primaryUrl,
  });

  try {
    await queueProjectEmail({
      projectId: opts.projectId,
      subject: opts.event === "created" ? `${label} raised — ${opts.number}` : `${label} ${opts.number} ${verb}`,
      body: bodyText,
      bodyHtml,
      context: `ncr.${opts.event}`,
      createdById: opts.createdById,
    });
  } catch {
    /* optional */
  }

  /** Contractor / vendor on the notice receives the form link directly when NCR/CAR is raised */
  if (opts.event === "created" && opts.contractorEmail?.trim()) {
    const contractorMail = buildNcrRaisedEmail({
      ctx: emailCtx,
      registerUrl: formUrl,
    });
    const contractorBody = [
      contractorMail.bodyText,
      "",
      "You are named on this notice. Complete the corrective action fields and sign off in the portal form.",
      "",
      `Open form: ${formUrl}`,
    ].join("\n");

    try {
      await queueProjectEmail({
        projectId: opts.projectId,
        subject: `[Action required] ${label} ${opts.number} — ${project?.code || "Project"}`,
        body: contractorBody,
        bodyHtml: contractorMail.bodyHtml.replace(
          "Open NCR / CAR register",
          "Open NCR / CAR form"
        ),
        context: "ncr.contractor_notice",
        createdById: opts.createdById,
        toOverride: opts.contractorEmail.trim(),
      });
    } catch {
      /* optional */
    }
  }

  try {
    const { queueProjectWhatsApp } = await import("./projectWhatsApp.js");
    const { whatsAppNcrStatus } = await import("./whatsappMessages.js");
    await queueProjectWhatsApp({
      projectId: opts.projectId,
      text: whatsAppNcrStatus({
        kind: opts.kind,
        number: opts.number,
        status: opts.status,
        description: opts.description,
        event: opts.event,
        registerUrl: formUrl,
      }),
      context: `ncr.${opts.event}`,
    });
  } catch {
    /* optional */
  }
}

export async function notifyNcrFollowUp(opts: {
  projectId: string;
  recordId: string;
  kind: NcrEmailKind;
  number: string;
  status: string;
  description: string;
  createdById?: string;
  contractorEmail?: string | null;
  contractorName?: string | null;
  location?: string | null;
  plannedClosure?: Date | string | null;
  followUpNumber: number;
  note?: string | null;
}) {
  const label =
    opts.kind === "SafetyNCR" ? "Safety NCR" : opts.kind === "QualityCAR" ? "CAR" : "Quality NCR";

  const formUrl =
    opts.kind === "SafetyNCR"
      ? `${portalOrigin()}/projects/${opts.projectId}/ncr-form/safety/${opts.recordId}`
      : `${portalOrigin()}/projects/${opts.projectId}/ncr-form/quality/${opts.recordId}`;

  const project = await prisma.project.findUnique({
    where: { id: opts.projectId },
    select: { code: true, name: true },
  });

  let raisedByName: string | null = null;
  if (opts.createdById) {
    const u = await prisma.user.findUnique({
      where: { id: opts.createdById },
      select: { fullName: true },
    });
    raisedByName = u?.fullName || null;
  }

  const emailCtx = {
    projectCode: project?.code,
    projectName: project?.name,
    number: opts.number,
    kind: opts.kind,
    status: opts.status,
    description: opts.description,
    location: opts.location,
    responsibleParty: opts.contractorName,
    targetCompletion: opts.plannedClosure,
    raisedByName,
    raisedAt: new Date(),
  };

  const mail = buildNcrFollowUpEmail({
    ctx: emailCtx,
    formUrl,
    followUpNumber: opts.followUpNumber,
    note: opts.note,
  });

  const results: { project?: unknown; contractor?: unknown } = {};

  try {
    results.project = await queueProjectEmail({
      projectId: opts.projectId,
      subject: `${label} follow-up ${opts.followUpNumber} — ${opts.number}`,
      body: mail.bodyText,
      bodyHtml: mail.bodyHtml,
      context: "ncr.follow-up",
      createdById: opts.createdById,
    });
  } catch {
    /* optional */
  }

  if (opts.contractorEmail?.trim()) {
    try {
      results.contractor = await queueProjectEmail({
        projectId: opts.projectId,
        subject: mail.subject,
        body: mail.bodyText,
        bodyHtml: mail.bodyHtml,
        context: "ncr.contractor_followup",
        createdById: opts.createdById,
        toOverride: opts.contractorEmail.trim(),
      });
    } catch {
      /* optional */
    }
  }

  return results;
}

export async function notifyRfiStatus(opts: {
  projectId: string;
  number: string;
  subject: string;
  status: string;
  createdById?: string;
}) {
  try {
    await queueProjectEmail({
      projectId: opts.projectId,
      subject: `RFI ${opts.number} — ${opts.status}`,
      body: [`RFI ${opts.number} status changed to ${opts.status}.`, "", `Subject: ${opts.subject}`].join("\n"),
      context: "rfi.status",
      createdById: opts.createdById,
    });
  } catch {
    /* optional */
  }
}
