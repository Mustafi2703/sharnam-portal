import { queueProjectEmail } from "./email.js";
import { portalOrigin } from "./rfiFlowNotify.js";
import { buildNcrFollowUpEmail, buildNcrRaisedEmail, type NcrEmailKind } from "./ncrEmailFormat.js";
import { prisma } from "../prisma.js";

/** Resolve contractor email from form JSON or project vendor directory. */
export async function resolveNcrContractorEmail(
  projectId: string,
  formParsed?: Record<string, unknown> | null,
  contractorName?: string | null
): Promise<string | null> {
  const fromForm = typeof formParsed?.contractorEmail === "string" ? formParsed.contractorEmail.trim() : "";
  if (fromForm && fromForm.includes("@")) return fromForm;

  const name = contractorName?.trim() || String(formParsed?.toParty || formParsed?.contractor || "").trim();
  if (name) {
    const vendor = await prisma.vendor.findFirst({
      where: {
        OR: [
          { name: { contains: name.slice(0, 40) } },
          { projects: { some: { projectId } } },
        ],
      },
      select: { email: true },
    });
    if (vendor?.email?.includes("@")) return vendor.email.trim();
  }

  const pv = await prisma.projectVendor.findFirst({
    where: { projectId },
    include: { vendor: { select: { email: true, name: true } } },
  });
  return pv?.vendor?.email?.trim() || null;
}

function formHasContractorAction(formParsed?: Record<string, unknown> | null) {
  if (!formParsed) return false;
  if (formParsed.contractorActed === true || formParsed.contractorActed === "yes") return true;
  const action = String(formParsed.correctiveAction || formParsed.actionTaken || formParsed.contractorResponse || "").trim();
  return action.length > 20;
}

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
  formParsed?: Record<string, unknown> | null;
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

  /** Contractor receives form link on raise and when form is saved while still open */
  const contractorEmail =
    opts.contractorEmail?.trim() ||
    (await resolveNcrContractorEmail(opts.projectId, opts.formParsed, opts.contractorName));

  if ((opts.event === "created" || opts.event === "updated") && contractorEmail && opts.status !== "Closed") {
    const contractorMail = buildNcrRaisedEmail({
      ctx: emailCtx,
      registerUrl: formUrl,
    });
    const contractorBody = [
      contractorMail.bodyText,
      "",
      opts.event === "created"
        ? "You are named on this notice. Complete the corrective action fields and sign off in the portal form."
        : "The form has been updated. Review the latest fields and respond in the portal.",
      "",
      `Open form: ${formUrl}`,
    ].join("\n");

    try {
      await queueProjectEmail({
        projectId: opts.projectId,
        subject:
          opts.event === "created"
            ? `[Action required] ${label} ${opts.number} — ${project?.code || "Project"}`
            : `[Form saved] ${label} ${opts.number} — please review / respond`,
        body: contractorBody,
        bodyHtml: contractorMail.bodyHtml.replace(/Open NCR \/ CAR register/g, "Open NCR / CAR form"),
        context: opts.event === "created" ? "ncr.contractor_notice" : "ncr.contractor_save",
        createdById: opts.createdById,
        toOverride: contractorEmail,
      });
    } catch {
      /* optional */
    }
  }

  /** When contractor marks action taken, notify SPDC office to review and close */
  if (opts.event === "updated" && opts.formParsed && formHasContractorAction(opts.formParsed)) {
    try {
      await queueProjectEmail({
        projectId: opts.projectId,
        subject: `[Review] ${label} ${opts.number} — contractor action submitted`,
        body: [
          `${label} ${opts.number} — contractor has submitted corrective action details.`,
          "",
          `Status: ${opts.status}`,
          `Description: ${opts.description}`,
          "",
          `Review and close when verified: ${formUrl}`,
        ].join("\n"),
        context: "ncr.office_action_review",
        createdById: opts.createdById,
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

  const contractorTo =
    opts.contractorEmail?.trim() ||
    (await resolveNcrContractorEmail(opts.projectId, null, opts.contractorName));

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

  if (contractorTo) {
    try {
      results.contractor = await queueProjectEmail({
        projectId: opts.projectId,
        subject: mail.subject,
        body: mail.bodyText,
        bodyHtml: mail.bodyHtml,
        context: "ncr.contractor_followup",
        createdById: opts.createdById,
        toOverride: contractorTo,
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
