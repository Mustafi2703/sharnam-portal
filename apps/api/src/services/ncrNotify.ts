import { queueProjectEmail } from "./email.js";
import { portalOrigin } from "./rfiFlowNotify.js";

export async function notifyNcrStatus(opts: {
  projectId: string;
  kind: "QualityNCR" | "QualityCAR" | "SafetyNCR";
  number: string;
  status: string;
  description: string;
  createdById?: string;
  event: "created" | "updated" | "closed";
}) {
  const label =
    opts.kind === "SafetyNCR" ? "Safety NCR" : opts.kind === "QualityCAR" ? "CAR" : "Quality NCR";
  const verb =
    opts.event === "created" ? "raised" : opts.event === "closed" ? "closed" : "updated";
  const registerUrl =
    opts.kind === "SafetyNCR"
      ? `${portalOrigin()}/projects/${opts.projectId}/safety`
      : `${portalOrigin()}/projects/${opts.projectId}/quality/ncr`;

  try {
    await queueProjectEmail({
      projectId: opts.projectId,
      subject: `${label} ${opts.number} ${verb}`,
      body: [
        `${label} ${opts.number} has been ${verb}.`,
        "",
        `Status: ${opts.status}`,
        `Description: ${opts.description.slice(0, 500)}`,
        "",
        "Review in the portal Quality / Safety module and complete the NCR form before closing.",
        "",
        registerUrl,
      ].join("\n"),
      context: `ncr.${opts.event}`,
      createdById: opts.createdById,
    });
  } catch {
    /* optional */
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
        registerUrl,
      }),
      context: `ncr.${opts.event}`,
    });
  } catch {
    /* optional */
  }
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
