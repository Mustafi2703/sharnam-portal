import { prisma } from "../prisma.js";

/** Consume one-time Drawing Check Master unlock token; returns submission id or throws-like error string */
export async function consumeDrawingUnlockToken(opts: {
  projectId: string;
  unlockToken?: string | null;
  userId: string;
}): Promise<{ ok: true; submissionId: string } | { ok: false; error: string }> {
  const token = String(opts.unlockToken || "").trim();
  if (!token) {
    return {
      ok: false,
      error: "Complete the Drawing Check Master checklist before uploading. Unlock token missing.",
    };
  }
  const submission = await prisma.checklistSubmission.findFirst({
    where: {
      unlockToken: token,
      purpose: "PreUploadDrawing",
      unlockUsedAt: null,
      assignment: { projectId: opts.projectId },
    },
  });
  if (!submission) {
    return { ok: false, error: "Invalid or already-used Drawing Check unlock. Fill the checklist again." };
  }
  await prisma.checklistSubmission.update({
    where: { id: submission.id },
    data: { unlockUsedAt: new Date() },
  });
  return { ok: true, submissionId: submission.id };
}
