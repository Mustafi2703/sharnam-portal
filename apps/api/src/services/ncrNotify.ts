import { queueProjectEmail } from "./email.js";

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
      ].join("\n"),
      context: `ncr.${opts.event}`,
      createdById: opts.createdById,
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
